const config = require('../config');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  if (token !== config.token) {
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
  next();
}

module.exports = { authMiddleware };
