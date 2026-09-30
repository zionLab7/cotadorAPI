/**
 * Servidor REST API para Cotação de Planos de Saúde
 * Permite integração com Chatbots (WhatsApp / Evolution API / Typebot), CRMs e Sistemas
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { executarCotacao } = require('./cotador');
const { listarOperadoras, consultarPlanos, carregarCatalogo } = require('./catalogo');
const { login, isSessionValid } = require('./auth');
const { launchBrowser } = require('./browser');
const { autenticarApiKey } = require('./middleware');
const { createMcpRouter } = require('./mcp/sse');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./swagger');

const app = express();

app.use(cors());
app.use(express.json());

// Documentação Interativa Swagger / OpenAPI 3.0
const swaggerUiOptions = {
  customSiteTitle: 'Swagger UI - API Cotador de Planos de Saúde',
  customCss: `
    .swagger-ui .topbar { background-color: #0b2545; }
    .swagger-ui .info .title { color: #0b2545; }
    .swagger-ui .btn.authorize { background-color: #00a86b; color: white; border-color: #00a86b; }
    .swagger-ui .btn.authorize svg { fill: white; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true
  }
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api/docs/swagger.json', (req, res) => res.json(swaggerSpec));
app.get('/swagger', (req, res) => res.redirect('/docs'));
app.get('/api-docs', (req, res) => res.redirect('/docs'));

// Servidor MCP (Model Context Protocol) via SSE para Agentes de IA
app.use('/mcp', createMcpRouter(autenticarApiKey));

// Rota de Healthcheck e Status (pública)
app.get('/api/status', async (req, res) => {
  const sessionExists = fs.existsSync(config.STORAGE_STATE_PATH);
  const catalogo = carregarCatalogo();
  const totalPlanosMapeados = Object.values(catalogo).reduce((acc, cur) => acc + cur.length, 0);

  res.json({
    status: 'online',
    servico: 'API Própria - Cotação de Planos de Saúde (Painel do Corretor)',
    versao: '1.0.0',
    documentacaoSwagger: '/docs',
    especificacaoOpenApi: '/api/docs/swagger.json',
    autenticacaoAtiva: Boolean(config.API_SECRET_TOKEN),
    servidorMcpAtivo: true,
    sessaoAtiva: sessionExists,
    totalOperadorasCatalogo: Object.keys(catalogo).length,
    totalPlanosCatalogo: totalPlanosMapeados,
    timestamp: new Date().toISOString()
  });
});

// Consulta de Operadoras disponíveis no catálogo
app.get('/api/operadoras', autenticarApiKey, (req, res) => {
  try {
    const operadoras = listarOperadoras();
    res.json({
      sucesso: true,
      total: operadoras.length,
      operadoras: operadoras
    });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// Consulta do Catálogo completo com filtros
app.get('/api/catalogo', autenticarApiKey, (req, res) => {
  try {
    const { operadora, acomodacao, coparticipacao, mei, busca } = req.query;

    const filtros = {
      operadora,
      acomodacao,
      coparticipacao: coparticipacao !== undefined ? coparticipacao === 'true' : undefined,
      mei: mei !== undefined ? mei === 'true' : undefined,
      busca
    };

    const planos = consultarPlanos(filtros);
    res.json({
      sucesso: true,
      total: planos.length,
      filtrosAplicados: filtros,
      planos: planos
    });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

// Execução de Cotação Automatizada
app.post('/api/cotacao', autenticarApiKey, async (req, res) => {
  try {
    const { titulo, cidade, modalidade, vidas, operadoras } = req.body;

    if (!vidas || !Array.isArray(vidas) || vidas.length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: 'É obrigatório informar ao menos uma faixa de vidas no formato: [{"faixa": "24-28", "quantidade": 1}]'
      });
    }

    console.log(`\n[API] Nova requisição de cotação recebida: "${titulo || 'Sem título'}"`);
    const resultado = await executarCotacao({
      titulo,
      cidade,
      modalidade,
      vidas,
      operadoras
    });

    res.json(resultado);
  } catch (err) {
    console.error('[API] Erro ao processar cotação:', err.message);
    res.status(500).json({
      sucesso: false,
      erro: 'Falha ao executar cotação no painel.',
      detalhes: err.message
    });
  }
});

// Download do PDF gerado da cotação
app.get('/api/cotacao/:id/pdf', autenticarApiKey, (req, res) => {
  const cotacaoId = req.params.id;
  const pdfPath = path.join(config.PDF_DIR, `cotacao-${cotacaoId}.pdf`);

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({
      sucesso: false,
      erro: 'Arquivo PDF não encontrado para a cotação informada.'
    });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="cotacao-${cotacaoId}.pdf"`);
  fs.createReadStream(pdfPath).pipe(res);
});

// Rota de Login / Autenticação manual ou renovação
app.post('/api/auth/login', autenticarApiKey, async (req, res) => {
  try {
    const { email, password } = req.body;
    const browser = await launchBrowser();

    const result = await login(browser, email, password);
    await browser.close();

    res.json(result);
  } catch (err) {
    res.status(401).json({
      sucesso: false,
      erro: err.message
    });
  }
});

// Inicia o servidor
const PORT = config.PORT;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('=====================================================');
    console.log(`🚀 API DE COTAÇÃO DE PLANOS DE SAÚDE PRONTA!`);
    console.log(`📡 Ouvindo em: http://localhost:${PORT}`);
    console.log(`- Status:     GET  http://localhost:${PORT}/api/status`);
    console.log(`- Operadoras: GET  http://localhost:${PORT}/api/operadoras`);
    console.log(`- Catálogo:   GET  http://localhost:${PORT}/api/catalogo`);
    console.log(`- Cotar:      POST http://localhost:${PORT}/api/cotacao`);
    console.log(`- Baixar PDF: GET  http://localhost:${PORT}/api/cotacao/:id/pdf`);
    console.log(`- Swagger UI: GET  http://localhost:${PORT}/docs`);
    console.log(`- OpenAPI JSON:    http://localhost:${PORT}/api/docs/swagger.json`);
    console.log('=====================================================\n');
  });
}

module.exports = app;
