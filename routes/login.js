const express = require('express');
const router = express.Router();
const loginControllers = require('../controllers/LoginController');
const { rateLimit } = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many attempts, please try again later.'
})

// Registration
router.post('/register', authLimiter, loginControllers.register_post)

// Login route 
router.post('/login', authLimiter, loginControllers.login_post);

module.exports = router;