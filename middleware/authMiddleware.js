const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config()

const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization'];
  if (!token) {
        return res.status(401).json({ message: 'Access denied' })
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded // attach decoded JWT to the request
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {
        // tokens of deleted accounts stay cryptographically valid, so check the user still exists
        const exists = await User.exists({ _id: req.user.userId });
        if (!exists) {
            return res.status(401).json({ message: 'Invalid token' });
        }
    } catch (error) {
        return next(error);
    }
    next();
}


module.exports = { authenticateToken };
