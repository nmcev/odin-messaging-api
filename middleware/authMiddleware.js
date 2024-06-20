const jwt = require('jsonwebtoken');
const User = require('../models/User');
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


const authorizeRole =  (requiredRoles) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.userId);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const userRoles = user.roles;
            console.log("User Roles:", userRoles);

            // Check if any role in userRoles is included in requiredRoles
            const hasRole = userRoles.some(role => requiredRoles.includes(role));

            console.log("Has Role:", hasRole);

            if (!hasRole) {
                return res.status(403).json({ message: "Forbidden" });
            }

            next();
        } catch (err) {
            console.error("Error in authorizeRole middleware:", err);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    };
};


module.exports = { authenticateToken, authorizeRole };
