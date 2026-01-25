const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('=== AUTH MIDDLEWARE DEBUG ===');
  console.log('Authorization header:', authHeader ? 'Present' : 'Missing');
  console.log('Full headers:', JSON.stringify(req.headers, null, 2));
  
  if (!authHeader) {
    console.log('No Authorization header found');
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log('Token not found in Authorization header');
    return res.status(401).json({ message: 'No token provided' });
  }

  console.log('Token received (first 20 chars):', token.substring(0, 20) + '...');

  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    console.log('Token decoded successfully:', { userId: decoded.userId, email: decoded.email });
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    console.error('Error details:', err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', error: 'TokenExpiredError' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token', error: 'JsonWebTokenError' });
    }
    
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
}

function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

module.exports = { verifyToken, isAdmin };
