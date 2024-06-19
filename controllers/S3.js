const aws = require('aws-sdk');
require("aws-sdk/lib/maintenance_mode_message").suppress = true;

require('dotenv').config();
const crypto = require('crypto');
const { promisify } = require('util');
const randomBytes = promisify(crypto.randomBytes);

const region = 'eu-north-1';
const bucketName = 'odin-blog-bucket';
const accessKeyId = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

const s3 = new aws.S3({
  region,
  accessKeyId,
  secretAccessKey,
  signatureVersion: 'v4'
});

async function generateUploadURL() {
  const rawBytes = await randomBytes(16);
  const imageName = rawBytes.toString('hex');

  const params = {
    Bucket: bucketName,
    Key: imageName,
    Expires: 60
  };

  const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
  return uploadUrl;
}

module.exports = { generateUploadURL };