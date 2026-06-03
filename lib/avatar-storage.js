/**
 * Avatar-only S3 helpers. Isolated from lib/storage.js to avoid chartHash dependency chain.
 */
const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || 'us-east-1',
  s3ForcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET;

async function uploadFile(key, buffer, contentType, metadata = {}, cacheControl = null) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  };

  if (cacheControl) {
    params.CacheControl = cacheControl;
  }

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to storage');
  }
}

async function uploadAvatar(userId, imageBuffer, format = 'jpg') {
  const key = `avatars/${userId}.${format}`;
  const contentType = format === 'png' ? 'image/png' : 'image/jpeg';

  return await uploadFile(key, imageBuffer, contentType, {
    userId,
    type: 'avatar',
  });
}

async function getAvatarObject(userId) {
  const key = `avatars/${userId}.jpg`;
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const result = await s3.getObject(params).promise();
    const body = result.Body;
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    return {
      buffer,
      contentType: result.ContentType || 'image/jpeg',
    };
  } catch (error) {
    if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
      const err = new Error('Avatar not found');
      err.code = 'AVATAR_NOT_FOUND';
      throw err;
    }
    console.error('S3 get avatar error:', error);
    throw new Error('Failed to fetch avatar from storage');
  }
}

module.exports = {
  uploadAvatar,
  getAvatarObject,
};
