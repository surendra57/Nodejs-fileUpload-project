const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
exports.authenticateToken= (req, res, next)=> {
    const {token}= req.cookies;
    console.log(token)
    
  if (!token) return res.status(401).json({ message: 'Authentication failed' });

  jwt.verify(token, 'surendra1234', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}


