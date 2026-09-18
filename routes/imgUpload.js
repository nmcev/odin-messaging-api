const express = require('express');
const router = express.Router();
const upload = require('../controllers/cloudinaryController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/upload', authenticateToken ,upload.single('file'), (req, res) => {

    if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
    }
    res.json({ url: req.file.path, public_id: req.file.public_id });
});

module.exports = router;
