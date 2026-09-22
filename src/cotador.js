/**
 * Motor de Cotação Automatizada (Playwright Headless)
 * Realiza o preenchimento, seleção de planos, extração de dados e geração do PDF
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { getAuthenticatedContext } = require('./auth');
const { parseQuotationHtml } = require('./parser');

const FAIXA_INDEX_MAP = {
  '00-18': 0, '0-18': 0, '00 a 18': 0,
  '19-23': 1, '19 a 23': 1,
  '24-28': 2, '24 a 28': 2,
  '29-33': 3, '29 a 33': 3,
  '34-38': 4, '34 a 38': 4,
  '39-43': 5, '39 a 43': 5,
  '44-48': 6, '44 a 48': 6,
  '49-53': 7, '49 a 53': 7,
  '54-58': 8, '54 a 58': 8,
  '59+': 9, '59': 9, '59 ou mais': 9
};

// Garante que o diretório de PDFs existe
if (!fs.existsSync(config.PDF_DIR)) {
  fs.mkdirSync(config.PDF_DIR, { recursive: true });
}

/**
 * Executa uma cotação completa
 * @param {Object} params
 * @param {string} params.titulo Título da cotação
 * @param {string} params.cidade Cidade (ex: "Guarulhos - SP", "São Paulo - SP")
 * @param {number} params.modalidade 2 = PME, etc.
 * @param {Array<{faixa: string, quantidade: number}>} params.vidas Distribuição de vidas por idade
 * @param {Array<string>} params.operadoras Lista de operadoras desejadas (opcional)
 */
async function executarCotacao(params = {}) {
  const titulo = params.titulo || `Cotação ${new Date().toLocaleDateString('pt-BR')}`;
  const vidas = params.vidas || [];

  console.log(`\n[COTADOR] Iniciando cotação: "${titulo}" | Vidas: ${vidas.length} faixas`);

  const launchOptions = {
    headless: config.HEADLESS,
    args: ['--start-maximized', '--no-sandbox', '--disable-dev-shm-usage']
  };
  if (config.CHROME_CHANNEL) {
    launchOptions.channel = config.CHROME_CHANNEL;
  }

  const browser = await chromium.launch(launchOptions);

  let context;
  try {
    context = await getAuthenticatedContext(browser);
  } catch (err) {
    await browser.close();
    throw new Error(`Erro na autenticação: ${err.message}`);
  }

  const page = await context.newPage();

  try {
    // 1. Acessa a tela de Nova Cotação
    console.log('[COTADOR] Acessando /cotacoes/nova...');
    await page.goto(`${config.PAINEL_URL}/cotacoes/nova`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 2. Preenche o Título
    console.log(`[COTADOR] Preenchendo título: "${titulo}"`);
    await page.waitForSelector('input[name="titulo"]', { timeout: 15000 });
    await page.fill('input[name="titulo"]', titulo);
    await page.click('button[type="submit"], button:has-text("Confirmar")');

    // 3. Aguarda carregar a tela de preenchimento de Vidas / Edit
    await page.waitForURL(url => url.pathname.includes('/edit'), { timeout: 20000 });
    const currentUrl = page.url();
    const cotacaoIdMatch = currentUrl.match(/cotacoes\/([a-f0-9-]+)\/edit/i);
    const cotacaoId = cotacaoIdMatch ? cotacaoIdMatch[1] : null;
    console.log(`[COTADOR] Cotação criada com ID: ${cotacaoId}`);

    // 4. Preenche as faixas de vidas
    console.log('[COTADOR] Preenchendo faixas de idade...');
    for (const item of vidas) {
      const idx = FAIXA_INDEX_MAP[item.faixa];
      if (idx !== undefined && item.quantidade > 0) {
        const inputSelector = `input[name="vidas.${idx}.quantidade"]`;
        try {
          await page.waitForSelector(inputSelector, { timeout: 5000 });
          await page.fill(inputSelector, String(item.quantidade));
        } catch (e) {
          console.log(`[COTADOR] Campo ${inputSelector} não encontrado ou não acessível.`);
        }
      }
    }

    // Submete as vidas
    const confirmBtn = page.locator('button[type="submit"]:has-text("Confirmar")').first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    // 5. Navega para a seleção de cenários
    await page.waitForTimeout(1500);
    const cenariosUrl = `${config.PAINEL_URL}/cotacoes/${cotacaoId}/edit?d=cenarios`;
    console.log('[COTADOR] Abrindo seleção de cenários de planos...');
    await page.goto(cenariosUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Seleciona planos disponíveis na tela
    // Clica nos planos visíveis para compor a cotação
    console.log('[COTADOR] Selecionando planos disponíveis para comparação...');
    const planCards = page.locator('[role="button"], div[class*="cursor-pointer"], p[class*="font-semibold"]');
    const count = await planCards.count();
    let selected = 0;
    for (let i = 0; i < Math.min(count, 12); i++) {
      try {
        const card = planCards.nth(i);
        const text = await card.innerText();
        if (text && !text.includes('Confirmar') && !text.includes('Cancelar')) {
          await card.click().catch(() => {});
          selected++;
          await page.waitForTimeout(300);
        }
      } catch (e) {}
    }
    console.log(`[COTADOR] ${selected} seleções realizadas nos cenários.`);

    // 6. Acessa a tela oficial de Impressão e Comparativo
    const printUrl = `${config.PAINEL_URL}/cotacoes/${cotacaoId}/print`;
    console.log(`[COTADOR] Carregando relatório comparativo em: ${printUrl}`);
    await page.goto(printUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('table', { timeout: 15000 });

    // 7. Extrai o HTML completo e faz o parse estruturado
    const htmlContent = await page.content();
    const cotacaoParsed = parseQuotationHtml(htmlContent);

    // 8. Gera o arquivo PDF oficial
    const pdfFilename = `cotacao-${cotacaoId}.pdf`;
    const pdfPath = path.join(config.PDF_DIR, pdfFilename);
    console.log(`[COTADOR] Gerando PDF oficial em: ${pdfPath}...`);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      }
    });

    // 9. Formata o objeto de retorno
    const resultado = {
      sucesso: true,
      cotacaoId: cotacaoId,
      titulo: cotacaoParsed ? cotacaoParsed.titulo : titulo,
      corretor: cotacaoParsed ? cotacaoParsed.corretor : {},
      totalPlanos: cotacaoParsed ? cotacaoParsed.totalPlanos : 0,
      planos: cotacaoParsed ? cotacaoParsed.planos : [],
      resumoHospitais: cotacaoParsed ? cotacaoParsed.hospitais.slice(0, 20) : [],
      totalHospitaisMapeados: cotacaoParsed ? cotacaoParsed.totalHospitaisMapeados : 0,
      pdf: {
        nomeArquivo: pdfFilename,
        caminhoLocal: pdfPath,
        urlDownload: `/api/cotacao/${cotacaoId}/pdf`
      },
      linkVisualizacaoWeb: printUrl,
      geradoEm: new Date().toISOString()
    };

    console.log(`[COTADOR] ✅ Cotação finalizada com sucesso! Total de planos: ${resultado.totalPlanos}`);
    await context.close();
    await browser.close();

    return resultado;
  } catch (err) {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    console.error(`[COTADOR] ❌ Erro ao executar cotação: ${err.message}`);
    throw err;
  }
}

module.exports = {
  executarCotacao
};
