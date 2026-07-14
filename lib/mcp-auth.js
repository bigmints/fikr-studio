const { timingSafeEqual } = require('crypto');

function extractMcpToken(req, url) {
  const authorization = req.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice(7);
  }
  return url.searchParams.get('token');
}

function isAuthorizedMcpRequest(req, url, expectedToken) {
  if (!expectedToken) return false;
  const provided = extractMcpToken(req, url);
  if (typeof provided !== 'string' || provided.length !== expectedToken.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expectedToken));
}

module.exports = { extractMcpToken, isAuthorizedMcpRequest };
