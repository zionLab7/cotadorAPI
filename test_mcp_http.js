/** Tests Streamable HTTP and resource-server authentication without the live panel. */
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const http = require('node:http');
const config = require('./src/config');
const cotador = require('./src/cotador');
cotador.executarCotacao = async () => ({
  cotacaoId: 'id-teste', titulo: 'Teste', totalPlanos: 1,
  planos: [{ operadora: 'Amil', plano: 'Exemplo', valorTotal: 100 }],
  resumoHospitais: [],
  pdf: { nomeArquivo: 'cotacao-id-teste.pdf', caminhoLocal: __filename,
    urlDownload: '/api/cotacao/id-teste/pdf' }
});
const app = require('./src/server');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

async function main() {
  const { generateKeyPair, exportJWK, SignJWT } = await import('jose');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  const jwksServer = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise(resolve => jwksServer.listen(0, '127.0.0.1', resolve));
  const api = http.createServer(app);
  await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${api.address().port}`;
  try {
    config.MCP_PUBLIC_URL = `${base}/mcp`;
    config.MCP_OAUTH_ISSUER = 'https://issuer.example.test';
    config.MCP_OAUTH_JWKS_URI = `http://127.0.0.1:${jwksServer.address().port}/jwks`;
    config.MCP_ALLOWED_EMAILS = ['tester@example.test'];
    config.API_SECRET_TOKEN = 'do-not-expose-this-api-key';

    const meta = await fetch(`${base}/.well-known/oauth-protected-resource`);
    assert.equal(meta.status, 200);
    assert.equal((await meta.json()).resource, `${base}/mcp`);

    async function rawMcp(method, params = {}, token) {
      const response = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream'
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      });
      const text = await response.text();
      const dataLine = text.split(/\r?\n/).find(line => line.startsWith('data:'));
      return {
        response,
        body: JSON.parse(dataLine ? dataLine.slice(5).trim() : text)
      };
    }

    const initialize = await rawMcp('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'discovery-test', version: '1' }
    });
    assert.equal(initialize.response.status, 200);

    const anonymousTools = await rawMcp('tools/list');
    assert.equal(anonymousTools.response.status, 200);
    assert.equal(anonymousTools.body.result.tools.length, 4);
    for (const tool of anonymousTools.body.result.tools) {
      assert.deepEqual(tool.securitySchemes, [{ type: 'oauth2', scopes: ['cotador:use'] }]);
    }

    const anonymousResources = await rawMcp('resources/list');
    assert.equal(anonymousResources.response.status, 200);
    assert.equal(anonymousResources.body.error.code, -32601);

    const anonymousCall = await rawMcp('tools/call', {
      name: 'listar_operadoras',
      arguments: {}
    });
    assert.equal(anonymousCall.response.status, 200);
    assert.equal(anonymousCall.body.result.isError, true);
    assert.match(
      anonymousCall.body.result._meta['mcp/www_authenticate'][0],
      /oauth-protected-resource.*insufficient_scope/
    );

    async function sign(overrides = {}) {
      return new SignJWT({ email: 'tester@example.test', email_verified: true, scope: 'cotador:use', ...overrides })
        .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
        .setIssuer(config.MCP_OAUTH_ISSUER)
        .setAudience(config.MCP_PUBLIC_URL)
        .setIssuedAt().setExpirationTime('5m').sign(privateKey);
    }
    const otherUser = await fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${await sign({ email: 'outsider@example.test' })}` } });
    assert.equal(otherUser.status, 403);
    const invalidScope = await fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${await sign({ scope: 'other' })}` } });
    assert.equal(invalidScope.status, 403);
    const wrongAudience = await new SignJWT({ email: 'tester@example.test', email_verified: true, scope: 'cotador:use' })
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid }).setIssuer(config.MCP_OAUTH_ISSUER)
      .setAudience('https://other-service.example.test').setIssuedAt().setExpirationTime('5m').sign(privateKey);
    const rejectedAudience = await fetch(`${base}/mcp`, { method: 'POST', headers: { Authorization: `Bearer ${wrongAudience}` } });
    assert.equal(rejectedAudience.status, 401);

    const namespaced = await sign({
      email: undefined, email_verified: undefined,
      [`${config.MCP_PUBLIC_URL}/claims/email`]: 'tester@example.test',
      [`${config.MCP_PUBLIC_URL}/claims/email_verified`]: true
    });
    const namespacedResponse = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${namespaced}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
    });
    assert.equal(namespacedResponse.status, 200);

    const invalidToken = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer not-a-jwt' }
    });
    assert.equal(invalidToken.status, 401);
    assert.match(invalidToken.headers.get('www-authenticate'), /invalid_token/);

    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${await sign()}` } }
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);
    const tools = (await client.listTools()).tools.map(tool => tool.name);
    assert.deepEqual(tools.sort(), ['listar_operadoras', 'consultar_catalogo', 'cotar_planos', 'verificar_status_cotador'].sort());
    const result = await client.callTool({ name: 'listar_operadoras', arguments: {} });
    assert.ok(JSON.parse(result.content[0].text).total >= 6);
    assert.ok(!JSON.stringify(result).includes(config.API_SECRET_TOKEN));
    const quote = await client.callTool({ name: 'cotar_planos', arguments: {
      cidade: 'Guarulhos - SP', modalidade: 2, vidas: [{ faixa: '29-33', quantidade: 1 }]
    } });
    const quoteText = quote.content[0].text;
    assert.ok(!quote.isError);
    assert.equal(JSON.parse(quoteText).pdf.disponivel, true);
    assert.ok(!quoteText.includes(config.API_SECRET_TOKEN));
    assert.ok(!quoteText.includes('caminhoLocal'));
    assert.ok(!quoteText.includes('urlDownload'));
    await client.close();
    console.log('MCP HTTP/OAuth: metadados, bloqueios e chamada autenticada OK');
  } finally {
    await new Promise(resolve => api.close(resolve));
    await new Promise(resolve => jwksServer.close(resolve));
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
