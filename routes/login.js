const express = require('express');
const router = express.Router();
const loginControllers = require('../controllers/LoginController');

// Registration
router.post('/register', loginControllers.register_post )

// Login route 
router.post('/login', loginControllers.login_post);

module.exports = router;