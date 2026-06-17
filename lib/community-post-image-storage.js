/**
 * Community post image S3 helpers. Isolated from avatar storage.
 */
const AWS = require('aws-sdk');
const crypto = require('crypto');
require('dotenv').config();

const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || 'us-east-1',
  s3ForcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET;

function extensionForContentType(contentType) {
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('webp')) return 'webp';
  return 'jpg';
}

async function uploadCommunityPostImage(postId, imageBuffer, contentType) {
  const ext = extensionForContentType(contentType);
  const key = `community-posts/${postId}/${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: imageBuffer,
    ContentType: contentType || 'image/jpeg',
    Metadata: {
      postId: String(postId),
      type: 'community_post_image',
    },
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('[community-post-image] S3 upload error:', error);
    throw new Error('Failed to upload post image to storage');
  }
}

function s3KeyFromImageUrl(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) return null;
  const marker = 'community-posts/';
  const idx = url.indexOf(marker);
  if (idx >= 0) return url.slice(idx);
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\//, '');
    if (BUCKET_NAME && path.startsWith(`${BUCKET_NAME}/`)) {
      return path.slice(BUCKET_NAME.length + 1);
    }
    return path || null;
  } catch (_) {
    return null;
  }
}

async function deleteCommunityPostImageByUrl(imageUrl) {
  const key = s3KeyFromImageUrl(imageUrl);
  if (!key || !BUCKET_NAME) return false;
  try {
    await s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }).promise();
    return true;
  } catch (error) {
    console.error('[community-post-image] S3 delete error:', error);
    return false;
  }
}

module.exports = {
  uploadCommunityPostImage,
  deleteCommunityPostImageByUrl,
  s3KeyFromImageUrl,
};
