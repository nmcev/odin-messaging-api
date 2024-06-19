const jwt = require('jsonwebtoken');
require('dotenv').config()

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
  if (!token) {
        res.status(401).json({ message: 'Access denied' })
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded // attach decoded JWT to the request

        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token' });
    }
}


module.exports = authenticateToken;