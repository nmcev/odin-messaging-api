require('dotenv').config();

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'uploads',
    public_id: `${file.fieldname}-${Date.now()}`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  }),
});

const upload = multer({ storage });

module.exports = upload;   