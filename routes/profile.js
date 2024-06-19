const express = require('express');
const router = express.Router();

const authenticateToken = require('../middleware/authMiddleware');
const profileControllers = require('../controllers/ProfileController');

// current users' profile
router.get('/profile', authenticateToken,  profileControllers.profile_get);

// other user profile
router.get('/profile/:username', profileControllers.profileUsername_get);

// update user profile
router.put('/profile', authenticateToken, profileControllers.profile_put);

// handle delete user profile
router.delete('/profile', authenticateToken, profileControllers.profile_delete);


module.exports = router;
