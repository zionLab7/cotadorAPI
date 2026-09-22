/** Resource-server side of OAuth. The authorization server is configured separately. */
const config = require('../config');

let remoteJwks;
let cachedJwksUri;

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
    scopes_supported: ['cotador:use'],
    bearer_methods_supported: ['header']
  });
}

async function authenticateMcp(req, res, next) {
  if (!oauthConfigured()) return res.status(503).json({ error: 'MCP OAuth não configurado' });

  const metadataUrl = `${new URL(config.MCP_PUBLIC_URL).origin}/.well-known/oauth-protected-resource`;
  const challenge = `Bearer resource_metadata="${metadataUrl}", scope="cotador:use"`;
  const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
  if (!bearer) {
    res.set('WWW-Authenticate', challenge);
    return res.status(401).json({ error: 'unauthorized' });
  }

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
    if (!scopes.includes('cotador:use') || verifiedClaim !== true ||
        !config.MCP_ALLOWED_EMAILS.includes(email)) {
      res.set('WWW-Authenticate', `${challenge}, error="insufficient_scope"`);
      return res.status(403).json({ error: 'forbidden' });
    }
    req.auth = { token: bearer[1], clientId: payload.client_id, scopes, extra: { email } };
    next();
  } catch (err) {
    res.set('WWW-Authenticate', `${challenge}, error="invalid_token"`);
    res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { metadata, authenticateMcp };
