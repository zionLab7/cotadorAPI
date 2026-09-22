const app = require('./src/server');
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');

// Inicia servidor de teste em porta temporária
const TEST_PORT = 3001;
const server = http.createServer(app);

server.listen(TEST_PORT, async () => {
  console.log(`[TESTE] Servidor iniciado na porta ${TEST_PORT}\n`);

  async function fetchJson(endpoint) {
    const res = await fetch(`http://localhost:${TEST_PORT}${endpoint}`);
    return { status: res.status, data: await res.json() };
  }

  try {
    // 1. Testa /api/status
    console.log('1. Testando GET /api/status...');
    const statusRes = await fetchJson('/api/status');
    console.log('   Status HTTP:', statusRes.status);
    console.log('   Payload:', statusRes.data);
    if (statusRes.status !== 200 || statusRes.data.status !== 'online') {
      throw new Error('Falha em /api/status');
    }

    // 2. Testa /api/operadoras
    console.log('\n2. Testando GET /api/operadoras...');
    const opsRes = await fetchJson('/api/operadoras');
    console.log('   Status HTTP:', opsRes.status);
    console.log(`   Total de operadoras: ${opsRes.data.total}`);
    opsRes.data.operadoras.forEach(op => {
      console.log(`   - ${op.operadora}: ${op.totalPlanos} planos mapeados (${op.linhas.length} linhas)`);
    });
    if (opsRes.data.total < 6) throw new Error('Menos de 6 operadoras encontradas');

    // 3. Testa /api/catalogo com filtro
    console.log('\n3. Testando GET /api/catalogo?operadora=Amil&acomodacao=apartamento...');
    const catRes = await fetchJson('/api/catalogo?operadora=Amil&acomodacao=apartamento');
    console.log('   Status HTTP:', catRes.status);
    console.log(`   Total retornado no filtro: ${catRes.data.total}`);
    console.log('   Exemplo do primeiro plano retornado:');
    console.log('  ', catRes.data.planos[0]);
    if (catRes.data.total === 0) throw new Error('Filtro do catálogo retornou vazio');

    // 4. Testa endpoint de PDF
    console.log('\n4. Testando validação de PDF em /api/cotacao/:id/pdf...');
    // Cria um PDF de teste temporário
    const dummyId = '01a0c871-5895-7e0d-9816-ec733d9acf7e';
    const dummyPdfPath = path.join(config.PDF_DIR, `cotacao-${dummyId}.pdf`);
    fs.writeFileSync(dummyPdfPath, '%PDF-1.4 teste', 'utf-8');

    const pdfRes = await fetch(`http://localhost:${TEST_PORT}/api/cotacao/${dummyId}/pdf`);
    console.log('   Status HTTP para PDF existente:', pdfRes.status);
    console.log('   Content-Type:', pdfRes.headers.get('content-type'));
    if (pdfRes.status !== 200 || !pdfRes.headers.get('content-type').includes('application/pdf')) {
      throw new Error('Falha no download do PDF');
    }

    // Testa PDF inexistente
    const notFoundRes = await fetch(`http://localhost:${TEST_PORT}/api/cotacao/id-inexistente/pdf`);
    console.log('   Status HTTP para PDF inexistente:', notFoundRes.status);
    if (notFoundRes.status !== 404) throw new Error('Esperava 404 para PDF inexistente');

    console.log('\n=====================================================');
    console.log('🎉 TODOS OS TESTES DA API FORAM APROVADOS COM SUCESSO!');
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
