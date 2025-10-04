const jwt = require('jsonwebtoken');
const config = require('../config');

function extraerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

function verificarToken(req, res, next) {
  const token = extraerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Token de autenticacion requerido' });
  }

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    req.user = payload;
    next();
  } catch (error) {
    console.error('Token invalido:', error.message);
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

module.exports = verificarToken;
