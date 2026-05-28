const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(403).json({ error: 'Un token es requerido para la autenticación.' });
  }

  try {
    const tokenClean = token.replace('Bearer ', '');
    const decoded = jwt.verify(tokenClean, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
  return next();
};

module.exports = verifyToken;
