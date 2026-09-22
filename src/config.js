const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  HEADLESS: process.env.HEADLESS !== 'false',
  PAINEL_URL: process.env.PAINEL_URL || 'https://beta.paineldocorretor.com.br',
  AUTH_URL: process.env.AUTH_URL || 'https://auth.paineldocorretor.com.br',
  PAINEL_USER: process.env.PAINEL_USER || '',
  PAINEL_PASSWORD: process.env.PAINEL_PASSWORD || '',
  STORAGE_STATE_PATH: process.env.STORAGE_STATE_PATH || path.join(__dirname, '..', 'storage_state.json'),
  CATALOGO_PATH: path.join(__dirname, '..', 'catalogo_planos_mapeados.json'),
  PDF_DIR: path.join(__dirname, '..', 'public', 'pdfs'),
  CHROME_CHANNEL: process.env.CHROME_CHANNEL || (process.platform === 'darwin' ? 'chrome' : undefined)
};
