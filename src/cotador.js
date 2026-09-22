/**
 * Motor de Cotação Automatizada (Playwright Headless)
 * Realiza o preenchimento, seleção de planos, extração de dados e geração do PDF
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { getAuthenticatedContext } = require('./auth');
const { parseQuotationHtml } = require('./parser');
const { launchBrowser } = require('./browser');

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

// Carrega catálogo de planos brutos se existir
let rawCatalog = null;
const rawCatalogPath = path.join(__dirname, '..', 'catalogo_completo_raw.json');
if (fs.existsSync(rawCatalogPath)) {
  try {
    rawCatalog = JSON.parse(fs.readFileSync(rawCatalogPath, 'utf-8'));
  } catch (e) {}
}

/**
 * Seleciona planos na cotação ativa
 */
async function selecionarPlanos(page, cotacaoId, params = {}) {
  const cidade = params.cidade || 'Guarulhos - SP';
  const modalidade = params.modalidade || 2;
  const operadorasDesejadas = params.operadoras && params.operadoras.length > 0
    ? params.operadoras
    : ['Porto Seguro', 'Amil', 'Bradesco Seguros', 'Sulamérica', 'Alice', 'Omint'];

  console.log(`[COTADOR] Selecionando planos para operadoras: ${operadorasDesejadas.join(', ')}...`);

  let totalSelecionados = 0;

  // Método 1: Injeção direta via Server Action (ultra-rápido e confiável)
  if (rawCatalog) {
    const plansToAdd = [];
    for (const opName of operadorasDesejadas) {
      // Encontra a chave da operadora no catálogo (case-insensitive)
      const matchingKey = Object.keys(rawCatalog).find(k => k.toLowerCase().includes(opName.toLowerCase()));
      if (matchingKey && rawCatalog[matchingKey]) {
        // Pega os 2 primeiros planos da operadora (Apartamento ou Enfermaria)
        const opPlans = rawCatalog[matchingKey];
        const apto = opPlans.find(p => p.plano?.acomodacao === 1);
        const enf = opPlans.find(p => p.plano?.acomodacao === 0);
        if (apto) plansToAdd.push(apto);
        if (enf) plansToAdd.push(enf);
        if (!apto && !enf && opPlans.length > 0) plansToAdd.push(opPlans[0]);
      }
    }

    if (plansToAdd.length > 0) {
      console.log(`[COTADOR] Tentando adicionar ${plansToAdd.length} planos via Server Action...`);
      try {
        const added = await page.evaluate(async ({ cotacaoId, cidade, modalidade, plans }) => {
          let count = 0;
          for (const p of plans) {
            try {
              const body = [
                cotacaoId,
                {
                  cidade: cidade,
                  modalidade: modalidade,
                  credenciados: [],
                  key: p.key,
                  administradora: p.administradora,
                  operadora: p.operadora,
                  produto: p.produto,
                  plano: p.plano,
                  tabela: p.tabela
                }
              ];

              const res = await fetch(`/cotacoes/${cotacaoId}/edit?d=cenarios`, {
                method: 'POST',
                headers: {
                  'next-action': '60eb515926e2e36991adb35bba32bddb7d8a571240',
                  'content-type': 'text/plain;charset=UTF-8'
                },
                body: JSON.stringify(body)
              });

              if (res.ok) count++;
            } catch (err) {}
          }
          return count;
        }, { cotacaoId, cidade, modalidade, plans: plansToAdd });

        totalSelecionados = added;
        console.log(`[COTADOR] ${added} planos selecionados com sucesso via Server Action!`);
      } catch (e) {
        console.log(`[COTADOR] Nota na injeção via Server Action: ${e.message}`);
      }
    }
  }

  // Método 2: Fallback via cliques na interface gráfica do navegador
  if (totalSelecionados === 0) {
    console.log('[COTADOR] Executando seleção via interface gráfica...');
    try {
      // Abre a tela de cenários
      await page.goto(`${config.PAINEL_URL}/cotacoes/${cotacaoId}/edit?d=cenarios`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      await page.waitForTimeout(2000);

      // Procura botões com logotipo de operadoras
      const opButtons = page.locator('button:has(img), div:has(> button > div > img)');
      const countOps = await opButtons.count();
      console.log(`[COTADOR] ${countOps} operadoras encontradas na tela.`);

      for (let i = 0; i < Math.min(countOps, 4); i++) {
        try {
          const btn = opButtons.nth(i);
          if (await btn.isVisible()) {
            await btn.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(1000);

            // Clica nas opções/checkboxes que abriram no popover
            const planOptions = page.locator('[role="option"], div[class*="group gap-2 p-3"], [role="checkbox"]');
            const optCount = await planOptions.count();
            if (optCount > 0) {
              await planOptions.first().click({ timeout: 2000 }).catch(() => {});
              totalSelecionados++;
              await page.waitForTimeout(500);
            }
          }
        } catch (e) {}
      }

      // Clica no botão Continuar se existir
      const continuarBtn = page.locator('button:has-text("Continuar"), button:has-text("Confirmar")').first();
      if (await continuarBtn.isVisible().catch(() => false)) {
        await continuarBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
    } catch (err) {
      console.log(`[COTADOR] Nota na seleção visual: ${err.message}`);
    }
  }

  return totalSelecionados;
}

/**
 * Executa uma cotação completa
 */
async function executarCotacao(params = {}) {
  const titulo = params.titulo || `Cotação ${new Date().toLocaleDateString('pt-BR')}`;
  const vidas = params.vidas || [];

  console.log(`\n[COTADOR] Iniciando cotação: "${titulo}" | Vidas: ${vidas.length} faixas`);

  const browser = await launchBrowser(['--start-maximized']);

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

    await page.waitForTimeout(2000);

    // 5. Seleciona os planos da cotação
    const totalSelecionados = await selecionarPlanos(page, cotacaoId, params);
    console.log(`[COTADOR] Total de planos confirmados na cotação: ${totalSelecionados}`);

    // 6. Acessa a tela oficial de Impressão e Comparativo
    const printUrl = `${config.PAINEL_URL}/cotacoes/${cotacaoId}/print`;
    console.log(`[COTADOR] Carregando relatório comparativo em: ${printUrl}`);
    await page.goto(printUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Aguarda tabela ou conteúdo comparativo carregar
    try {
      await page.waitForSelector('table', { timeout: 25000 });
    } catch (e) {
      console.warn('[COTADOR] Aviso: Tabela principal demorou a responder, tentando ler conteúdo da página...');
      await page.waitForTimeout(3000);
    }

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
    }).catch(err => {
      console.warn(`[COTADOR] Nota na geração do PDF: ${err.message}`);
    });

    // 9. Formata o objeto de retorno
    const resultado = {
      sucesso: true,
      cotacaoId: cotacaoId,
      titulo: cotacaoParsed ? cotacaoParsed.titulo : titulo,
      corretor: cotacaoParsed ? cotacaoParsed.corretor : {},
      totalPlanos: cotacaoParsed ? cotacaoParsed.totalPlanos : totalSelecionados,
      planos: cotacaoParsed ? cotacaoParsed.planos : [],
      resumoHospitais: cotacaoParsed && cotacaoParsed.hospitais ? cotacaoParsed.hospitais.slice(0, 20) : [],
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
