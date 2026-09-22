process.env.NODE_ENV = 'test';
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const app = require('./src/server');

// Inicia servidor de teste em porta temporária
const TEST_PORT = 3001;
const server = http.createServer(app);

server.listen(TEST_PORT, async () => {
  console.log(`[TESTE] Servidor iniciado na porta ${TEST_PORT}\n`);

  async function fetchJson(endpoint, options = {}) {
    const res = await fetch(`http://localhost:${TEST_PORT}${endpoint}`, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

  try {
    const TEST_TOKEN = 'segredo-teste-cotador-2026';
    config.API_SECRET_TOKEN = TEST_TOKEN;

    // 1. Testa /api/status (deve ser PÚBLICA, sem necessidade de token)
    console.log('1. Testando GET /api/status (público, sem token)...');
    const statusRes = await fetchJson('/api/status');
    console.log('   Status HTTP:', statusRes.status);
    console.log('   Payload:', statusRes.data);
    if (statusRes.status !== 200 || statusRes.data.status !== 'online' || statusRes.data.autenticacaoAtiva !== true) {
      throw new Error('Falha em /api/status');
    }

    // 2. Testa bloqueio 401 em rotas protegidas sem token
    console.log('\n2. Testando bloqueio 401 sem token em /api/operadoras...');
    const noTokenRes = await fetchJson('/api/operadoras');
    console.log('   Status HTTP:', noTokenRes.status);
    console.log('   Mensagem de Erro:', noTokenRes.data.erro);
    if (noTokenRes.status !== 401) {
      throw new Error('Esperava status 401 sem token');
    }

    // 3. Testa bloqueio 401 com token inválido
    console.log('\n3. Testando bloqueio 401 com token errado...');
    const wrongTokenRes = await fetchJson('/api/operadoras', {
      headers: { 'Authorization': 'Bearer token_invalido_123' }
    });
    console.log('   Status HTTP:', wrongTokenRes.status);
    if (wrongTokenRes.status !== 401) {
      throw new Error('Esperava status 401 para token inválido');
    }

    // 4. Testa sucesso com header Authorization: Bearer <TOKEN>
    console.log('\n4. Testando GET /api/operadoras com Authorization: Bearer <TOKEN>...');
    const opsRes = await fetchJson('/api/operadoras', {
      headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
    });
    console.log('   Status HTTP:', opsRes.status);
    console.log(`   Total de operadoras: ${opsRes.data.total}`);
    opsRes.data.operadoras.forEach(op => {
      console.log(`   - ${op.operadora}: ${op.totalPlanos} planos mapeados (${op.linhas.length} linhas)`);
    });
    if (opsRes.status !== 200 || opsRes.data.total < 6) {
      throw new Error('Falha ao autenticar com Bearer Token');
    }

    // 5. Testa sucesso com header customizado x-api-key
    console.log('\n5. Testando GET /api/catalogo com x-api-key...');
    const catRes = await fetchJson('/api/catalogo?operadora=Amil&acomodacao=apartamento', {
      headers: { 'x-api-key': TEST_TOKEN }
    });
    console.log('   Status HTTP:', catRes.status);
    console.log(`   Total retornado no filtro: ${catRes.data.total}`);
    console.log('   Exemplo do primeiro plano retornado:');
    console.log('  ', catRes.data.planos[0]);
    if (catRes.status !== 200 || catRes.data.total === 0) {
      throw new Error('Falha ao autenticar com x-api-key');
    }

    // 6. Testa endpoint de PDF com proteção por token via URL (?token=...)
    console.log('\n6. Testando download de PDF em /api/cotacao/:id/pdf...');
    const dummyId = '01a0c871-5895-7e0d-9816-ec733d9acf7e';
    const dummyPdfPath = path.join(config.PDF_DIR, `cotacao-${dummyId}.pdf`);
    fs.writeFileSync(dummyPdfPath, '%PDF-1.4 teste', 'utf-8');

    // 6.1 PDF sem token -> deve dar 401
    const pdfNoToken = await fetch(`http://localhost:${TEST_PORT}/api/cotacao/${dummyId}/pdf`);
    console.log('   Status HTTP para PDF sem token:', pdfNoToken.status);
    if (pdfNoToken.status !== 401) {
      throw new Error('PDF sem token deveria retornar 401');
    }

    // 6.2 PDF com ?token=... correto -> deve dar 200
    const pdfWithQueryToken = await fetch(`http://localhost:${TEST_PORT}/api/cotacao/${dummyId}/pdf?token=${TEST_TOKEN}`);
    console.log('   Status HTTP para PDF com ?token=...:', pdfWithQueryToken.status);
    console.log('   Content-Type:', pdfWithQueryToken.headers.get('content-type'));
    if (pdfWithQueryToken.status !== 200 || !pdfWithQueryToken.headers.get('content-type').includes('application/pdf')) {
      throw new Error('Falha ao baixar PDF com ?token=...');
    }

    // 6.3 PDF inexistente com token correto -> deve dar 404
    const notFoundRes = await fetch(`http://localhost:${TEST_PORT}/api/cotacao/id-inexistente/pdf?token=${TEST_TOKEN}`);
    console.log('   Status HTTP para PDF inexistente:', notFoundRes.status);
    if (notFoundRes.status !== 404) {
      throw new Error('Esperava 404 para PDF inexistente');
    }

    console.log('\n=====================================================');
    console.log('🎉 TODOS OS TESTES (INCLUINDO AUTENTICAÇÃO POR TOKEN) APROVADOS!');
    console.log('=====================================================\n');
  } catch (err) {
    console.error('❌ ERRO NO TESTE:', err.message);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      process.exit(process.exitCode || 0);
    });
    setTimeout(() => process.exit(process.exitCode || 0), 500).unref();
  }
});
