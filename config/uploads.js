// Where uploaded pictures go.
//  - default: Cloudinary (needs internet)
//  - UPLOAD_STORAGE=local: saved in ./uploads and served by this server, so photos and
//    profile pictures work with no internet (e.g. a classroom demo on a local network).
//    PUBLIC_API_URL must be the address clients use to reach this server,
//    e.g. http://10.42.0.1:3001
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const LOCAL = process.env.UPLOAD_STORAGE === 'local';
const LOCAL_DIR = path.join(__dirname, '..', 'uploads');
const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
const LOCAL_PREFIX = `${PUBLIC_API_URL}/uploads/`;
const MAX_SIZE = 5 * 1024 * 1024;

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

let upload;
if (LOCAL) {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  upload = multer({
    storage: multer.diskStorage({
      destination: LOCAL_DIR,
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${EXTENSIONS[file.mimetype]}`),
    }),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => cb(null, Boolean(EXTENSIONS[file.mimetype])),
  });
} else {
  upload = require('../controllers/cloudinaryController');
}

// the URL clients should store/display for an uploaded file
const publicUrlFor = (file) => (LOCAL ? `${LOCAL_PREFIX}${file.filename}` : file.path);

const isCloudinaryUrl = (url) =>
  url.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`);

// only accept pictures we stored ourselves (Cloudinary always; local files in local mode)
const isAllowedImageUrl = (url) =>
  typeof url === 'string' &&
  (isCloudinaryUrl(url) || (LOCAL && url.startsWith(LOCAL_PREFIX) && !url.slice(LOCAL_PREFIX.length).includes('/')));

module.exports = { LOCAL, LOCAL_DIR, upload, publicUrlFor, isAllowedImageUrl };
