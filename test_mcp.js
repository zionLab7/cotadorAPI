/**
 * Testes Automatizados para o Servidor MCP (Model Context Protocol)
 * Valida criação de tools, schemas, execução de ferramentas e transporte SSE
 */

process.env.NODE_ENV = 'test';
const http = require('http');
const config = require('./src/config');
const app = require('./src/server');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

const TEST_PORT = 3002;
const TEST_TOKEN = 'mcp-secret-token-test-2026';
config.API_SECRET_TOKEN = TEST_TOKEN;

const server = http.createServer(app);

server.listen(TEST_PORT, async () => {
  console.log('\n=== TESTES DO SERVIDOR MCP ===');
  console.log(`[TESTE MCP] Servidor iniciado na porta ${TEST_PORT}\n`);

  try {
    // 1. Testa bloqueio 401 sem token no endpoint SSE
    console.log('1. Testando bloqueio 401 no /mcp/sse sem token...');
    const unauthRes = await fetch(`http://localhost:${TEST_PORT}/mcp/sse`);
    console.log('   Status HTTP:', unauthRes.status);
    if (unauthRes.status !== 401) {
      throw new Error('Endpoint /mcp/sse deveria retornar 401 sem token');
    }

    // 2. Conecta Cliente MCP oficial via SSE autenticado com ?token=...
    console.log('\n2. Conectando Cliente MCP oficial via SSE (com token)...');
    const sseUrl = new URL(`http://localhost:${TEST_PORT}/mcp/sse?token=${TEST_TOKEN}`);
    const clientTransport = new SSEClientTransport(sseUrl);
    const client = new Client(
      { name: 'test-ai-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(clientTransport);
    console.log('   Conexão SSE estabelecida com sucesso!');

    // 3. Lista Tools registradas
    console.log('\n3. Listando Tools do Servidor MCP...');
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);
    console.log('   Tools encontradas (' + toolNames.length + '):', toolNames);

    const requiredTools = ['listar_operadoras', 'consultar_catalogo', 'cotar_planos', 'verificar_status_cotador'];
    for (const reqTool of requiredTools) {
      if (!toolNames.includes(reqTool)) {
        throw new Error(`Tool obrigatória ausente: ${reqTool}`);
      }
    }

    // 4. Executa Tool: verificar_status_cotador
    console.log('\n4. Executando Tool: verificar_status_cotador...');
    const statusResult = await client.callTool({
      name: 'verificar_status_cotador',
      arguments: {}
    });
    const statusData = JSON.parse(statusResult.content[0].text);
    console.log('   Status retornado:', statusData);
    if (statusData.status !== 'online' || statusData.totalOperadoras < 6) {
      throw new Error('Falha no retorno da tool verificar_status_cotador');
    }

    // 5. Executa Tool: listar_operadoras
    console.log('\n5. Executando Tool: listar_operadoras...');
    const opResult = await client.callTool({
      name: 'listar_operadoras',
      arguments: {}
    });
    const opData = JSON.parse(opResult.content[0].text);
    console.log(`   Total de operadoras: ${opData.total}`);
    if (opData.total < 6) {
      throw new Error('Esperava pelo menos 6 operadoras');
    }

    // 6. Executa Tool: consultar_catalogo com filtro
    console.log('\n6. Executando Tool: consultar_catalogo (Amil + Apartamento)...');
    const catResult = await client.callTool({
      name: 'consultar_catalogo',
      arguments: {
        operadora: 'Amil',
        acomodacao: 'apartamento'
      }
    });
    const catData = JSON.parse(catResult.content[0].text);
    console.log(`   Total encontrados: ${catData.totalEncontrados}`);
    console.log('   Exemplo do primeiro plano retornado:');
    console.log('  ', catData.planos[0]);
    if (catData.totalEncontrados === 0) {
      throw new Error('Filtro de catálogo via MCP retornou vazio');
    }

    // Fecha o cliente MCP
    await client.close();
    console.log('\n=====================================================');
    console.log('🎉 TODOS OS TESTES DO SERVIDOR MCP FORAM APROVADOS!');
    console.log('=====================================================\n');
  } catch (err) {
    console.error('❌ ERRO NO TESTE MCP:', err.message);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      process.exit(process.exitCode || 0);
    });
    setTimeout(() => process.exit(process.exitCode || 0), 500).unref();
  }
});
