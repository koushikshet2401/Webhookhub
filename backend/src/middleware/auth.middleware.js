// backend/src/middleware/auth.middleware.js

const { verifyAccessToken } = require('../utils/jwt');
const { isTokenRevoked, getUserTokenGeneration } = require('../utils/tokenRevocation');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const decoded = verifyAccessToken(token);

    if (await isTokenRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Covers password reset: a token minted under an older generation is
    // rejected even though it hasn't naturally expired and was never
    // individually logged out. See tokenRevocation.js for why this is a
    // discrete counter rather than a timestamp comparison.
    const currentGeneration = await getUserTokenGeneration(decoded.sub);
    if (decoded.tgen !== currentGeneration) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
    req.tokenContext = { jti: decoded.jti, exp: decoded.exp };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };