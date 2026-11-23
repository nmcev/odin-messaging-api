const express = require('express');
const router = express.Router();
const loginControllers = require('../controllers/LoginController');
const { rateLimit } = require('express-rate-limit');

const makeLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many attempts, please try again later.'
})

const registerLimiter = makeLimiter();
const loginLimiter = makeLimiter();

// Registration
router.post('/register', registerLimiter, loginControllers.register_post)

// Login route 
router.post('/login', loginLimiter, loginControllers.login_post);

module.exports = router;