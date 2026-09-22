/**
 * Middleware de Autenticação da API (Token / API Key)
 * Protege os endpoints contra acessos não autorizados
 */

const config = require('./config');

function autenticarApiKey(req, res, next) {
  const tokenConfigurado = config.API_SECRET_TOKEN;

  // Se nenhum token foi definido no ambiente, permite a requisição (modo livre/dev)
  if (!tokenConfigurado) {
    return next();
  }

  // 1. Tenta obter pelo header Authorization: Bearer <TOKEN>
  const authHeader = req.headers['authorization'];
  let tokenRecebido = null;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    tokenRecebido = authHeader.slice(7).trim();
  }

  // 2. Tenta obter pelo header customizado x-api-key
  if (!tokenRecebido && req.headers['x-api-key']) {
    tokenRecebido = String(req.headers['x-api-key']).trim();
  }

  // 3. Tenta obter pelo parâmetro de URL ?token=... (útil para links de PDF enviados no WhatsApp)
  if (!tokenRecebido && req.query.token) {
    tokenRecebido = String(req.query.token).trim();
  }

  // Validação
  if (!tokenRecebido || tokenRecebido !== tokenConfigurado) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Acesso não autorizado. Token de API ausente ou inválido.',
      ajuda: 'Envie o cabeçalho "Authorization: Bearer <SEU_TOKEN>" ou "x-api-key: <SEU_TOKEN>" ou "?token=<SEU_TOKEN>"'
    });
  }

  next();
}

module.exports = {
  autenticarApiKey
};
