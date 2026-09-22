/**
 * Módulo de Autenticação e Gestão de Sessão (Auth0 / Painel do Corretor)
 * Salva e reutiliza storage_state.json para login instantâneo
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const config = require('./config');

async function isSessionValid(browser) {
  if (!fs.existsSync(config.STORAGE_STATE_PATH)) {
    return false;
  }

  try {
    const context = await browser.newContext({
      storageState: config.STORAGE_STATE_PATH
    });
    const page = await context.newPage();
    await page.goto(`${config.PAINEL_URL}/cotacoes`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const currentUrl = page.url();
    await context.close();

    // Se continuar no domínio do painel, a sessão está válida
    return currentUrl.includes('paineldocorretor.com.br') && !currentUrl.includes('auth.');
  } catch (err) {
    return false;
  }
}

async function login(browser, customUser, customPass) {
  const email = customUser || config.PAINEL_USER;
  const password = customPass || config.PAINEL_PASSWORD;

  if (!email || !password) {
    throw new Error('Credenciais não configuradas. Configure PAINEL_USER e PAINEL_PASSWORD no .env');
  }

  console.log(`[AUTH] Iniciando login para: ${email}`);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    // 1. Acessa o painel (que redirecionará para o Auth0)
    await page.goto(`${config.PAINEL_URL}/cotacoes`, { waitUntil: 'networkidle', timeout: 30000 });

    // 2. Preenche e-mail / username
    await page.waitForSelector('input#username', { timeout: 15000 });
    await page.fill('input#username', email);
    await page.click('button[type="submit"]');

    // 3. Preenche senha
    await page.waitForSelector('input#password', { timeout: 15000 });
    await page.fill('input#password', password);
    await page.click('button[type="submit"]');

    // 4. Aguarda retorno ao painel pós-autenticação
    await page.waitForURL(url => url.hostname.includes('paineldocorretor') && !url.hostname.includes('auth'), {
      timeout: 30000
    });

    console.log('[AUTH] Login realizado com sucesso! Salvando storage_state.json...');
    await context.storageState({ path: config.STORAGE_STATE_PATH });

    await context.close();
    return { success: true, message: 'Sessão autenticada e salva com sucesso.' };
  } catch (err) {
    await context.close();
    throw new Error(`Falha no login do Painel do Corretor: ${err.message}`);
  }
}

async function getAuthenticatedContext(browser) {
  const valid = await isSessionValid(browser);
  if (!valid) {
    console.log('[AUTH] Sessão expirada ou inexistente. Realizando login automático...');
    await login(browser);
  }

  return await browser.newContext({
    storageState: config.STORAGE_STATE_PATH,
    viewport: { width: 1280, height: 800 }
  });
}

module.exports = {
  isSessionValid,
  login,
  getAuthenticatedContext
};
