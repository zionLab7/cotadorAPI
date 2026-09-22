/** Resource-server side of OAuth. The authorization server is configured separately. */
const config = require('../config');

let remoteJwks;
let cachedJwksUri;
const MCP_SCOPE = 'cotador:use';

function resourceMetadataUrl() {
  return `${new URL(config.MCP_PUBLIC_URL).origin}/.well-known/oauth-protected-resource`;
}

function oauthSecuritySchemes() {
  return [{ type: 'oauth2', scopes: [MCP_SCOPE] }];
}

function authorizationChallenge(error, errorDescription) {
  const parts = [
    `Bearer resource_metadata="${resourceMetadataUrl()}"`,
    `scope="${MCP_SCOPE}"`
  ];
  if (error) parts.push(`error="${error}"`);
  if (errorDescription) parts.push(`error_description="${errorDescription}"`);
  return parts.join(', ');
}

function requireToolAuthentication(extra) {
  const scopes = extra?.authInfo?.scopes;
  if (Array.isArray(scopes) && scopes.includes(MCP_SCOPE)) return null;

  return {
    isError: true,
    content: [{ type: 'text', text: 'Autenticação necessária para usar esta ferramenta.' }],
    _meta: {
      'mcp/www_authenticate': [authorizationChallenge(
        'insufficient_scope',
        'Conecte sua conta para continuar.'
      )]
    }
  };
}

function oauthConfigured() {
  const urls = [config.MCP_PUBLIC_URL, config.MCP_OAUTH_ISSUER, config.MCP_OAUTH_JWKS_URI];
  if (process.env.NODE_ENV !== 'test' && urls.some(url => !url.startsWith('https://'))) return false;
  return Boolean(config.MCP_PUBLIC_URL && config.MCP_OAUTH_ISSUER &&
    config.MCP_OAUTH_JWKS_URI && config.MCP_ALLOWED_EMAILS.length);
}

function metadata(req, res) {
  if (!oauthConfigured()) return res.sendStatus(503);
  res.json({
    resource: config.MCP_PUBLIC_URL,
    authorization_servers: [config.MCP_OAUTH_ISSUER],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header']
  });
}

// ChatGPT may attach an access token while refreshing tool metadata. Tool
// discovery is intentionally public: descriptors contain no customer data and
// must remain available even when a stale/incomplete token is present. Actual
// execution continues to require a fully valid token below and in the tool
// handler.
function isPublicDiscoveryRequest(req) {
  if (req.method !== 'POST') return true;

  const messages = Array.isArray(req.body) ? req.body : [req.body];
  const publicMethods = new Set([
    'initialize',
    'notifications/initialized',
    'ping',
    'tools/list'
  ]);

  return messages.length > 0 && messages.every(message =>
    message && publicMethods.has(message.method)
  );
}

async function authenticateMcp(req, res, next) {
  if (!oauthConfigured()) return res.status(503).json({ error: 'MCP OAuth não configurado' });

  const challenge = authorizationChallenge();
  const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
  // Discovery must remain available before and after account linking.
  // Individual tools return an MCP authentication challenge without a token;
  // supplied tokens are validated only when a protected operation is called.
  if (!bearer || isPublicDiscoveryRequest(req)) return next();

  try {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    if (!remoteJwks || cachedJwksUri !== config.MCP_OAUTH_JWKS_URI) {
      remoteJwks = createRemoteJWKSet(new URL(config.MCP_OAUTH_JWKS_URI));
      cachedJwksUri = config.MCP_OAUTH_JWKS_URI;
    }
    const { payload } = await jwtVerify(bearer[1], remoteJwks, {
      issuer: config.MCP_OAUTH_ISSUER,
      audience: config.MCP_PUBLIC_URL,
      algorithms: ['RS256', 'ES256']
    });
    const scopes = typeof payload.scope === 'string' ? payload.scope.split(/\s+/) : [];
    // Auth0 Post-Login Actions use public namespaced claims in access tokens.
    const namespace = `${config.MCP_PUBLIC_URL}/claims`;
    const emailClaim = payload[`${namespace}/email`] ?? payload.email;
    const verifiedClaim = payload[`${namespace}/email_verified`] ?? payload.email_verified;
    const email = typeof emailClaim === 'string' ? emailClaim.toLowerCase() : '';
    if (!scopes.includes(MCP_SCOPE) || verifiedClaim !== true ||
        !config.MCP_ALLOWED_EMAILS.includes(email)) {
      res.set('WWW-Authenticate', authorizationChallenge(
        'insufficient_scope',
        'Token sem escopo ou usuário não autorizado.'
      ));
      return res.status(403).json({ error: 'forbidden' });
    }
    req.auth = {
      token: bearer[1],
      clientId: payload.client_id || payload.azp || 'unknown',
      scopes,
      expiresAt: payload.exp,
      resource: new URL(config.MCP_PUBLIC_URL),
      extra: { email }
    };
    next();
  } catch (err) {
    res.set('WWW-Authenticate', authorizationChallenge(
      'invalid_token',
      'O token enviado não é válido.'
    ));
    res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = {
  metadata,
  authenticateMcp,
  oauthSecuritySchemes,
  requireToolAuthentication
};
