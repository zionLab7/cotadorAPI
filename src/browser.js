/**
 * Módulo de Inicialização do Navegador com Auto-recuperação (Self-healing)
 * Garante que a versão correta do Chromium seja executada tanto no Mac quanto no Linux/Docker
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const config = require('./config');

let hasAutoInstalled = false;

async function launchBrowser(customArgs = []) {
  const launchOptions = {
    headless: config.HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      ...customArgs
    ]
  };

  if (config.CHROME_CHANNEL) {
    launchOptions.channel = config.CHROME_CHANNEL;
  }

  try {
    return await chromium.launch(launchOptions);
  } catch (err) {
    const isMissingExecutable =
      err.message &&
      (err.message.includes("Executable doesn't exist") ||
       err.message.includes('Please update docker image') ||
       err.message.includes('chrome-headless-shell') ||
       err.message.includes('chromium'));

    if (isMissingExecutable && !hasAutoInstalled) {
      hasAutoInstalled = true;
      console.warn('\n=============================================================');
      console.warn('⚠️ [AUTO-HEAL] Binário do Chromium não encontrado no ambiente.');
      console.warn('⚡ Baixando e instalando o Chromium correspondente agora...');
      console.warn('=============================================================\n');

      try {
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        console.log('\n✅ [AUTO-HEAL] Chromium instalado com sucesso! Inicializando navegador...\n');
        return await chromium.launch(launchOptions);
      } catch (installErr) {
        console.error('❌ [AUTO-HEAL] Falha ao instalar Chromium automaticamente:', installErr.message);
        throw err;
      }
    }

    throw err;
  }
}

module.exports = {
  launchBrowser
};
