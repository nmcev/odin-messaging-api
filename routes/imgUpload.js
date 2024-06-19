const express = require('express');
const router = express.Router();

const s3Controller = require('../controllers/S3');

router.get('/upload', async (req, res) => {
    try {
        const url = await s3Controller.generateUploadURL();
        res.json({ url });
    } catch (error) {
        console.error('Error generating upload URL:', error);
        res.status(500).json({ error: 'Failed to generate upload URL' });
    }
});

module.exports = router;
