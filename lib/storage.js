const AWS = require('aws-sdk');
const crypto = require('crypto');
require('dotenv').config();

// Configure AWS S3
const s3 = new AWS.S3({
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || 'us-east-1',
  s3ForcePathStyle: true, // Required for some S3-compatible services
});

const BUCKET_NAME = process.env.S3_BUCKET;

// Generate deterministic hash for chart data
function generateChartHash(chartData) {
  const dataString = JSON.stringify(chartData, Object.keys(chartData).sort());
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

// Upload file to S3
async function uploadFile(key, buffer, contentType, metadata = {}) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
    ACL: 'public-read', // Make files publicly accessible
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to storage');
  }
}

// Upload track audio file
async function uploadTrackAudio(trackId, audioBuffer, format = 'mp3') {
  const key = `tracks/${trackId}/full.${format}`;
  const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
  
  return await uploadFile(key, audioBuffer, contentType, {
    trackId,
    type: 'full-audio'
  });
}

// Upload track preview
async function uploadTrackPreview(trackId, previewBuffer) {
  const key = `tracks/${trackId}/preview.mp3`;
  
  return await uploadFile(key, previewBuffer, 'audio/mpeg', {
    trackId,
    type: 'preview'
  });
}

// Upload OpenGraph image
async function uploadOGImage(trackId, imageBuffer) {
  const key = `tracks/${trackId}/og.png`;
  
  return await uploadFile(key, imageBuffer, 'image/png', {
    trackId,
    type: 'og-image'
  });
}

// Upload user avatar
async function uploadAvatar(userId, imageBuffer, format = 'jpg') {
  const key = `avatars/${userId}.${format}`;
  const contentType = format === 'png' ? 'image/png' : 'image/jpeg';
  
  return await uploadFile(key, imageBuffer, contentType, {
    userId,
    type: 'avatar'
  });
}

// Delete file from S3
async function deleteFile(key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
}

// Delete all files for a track
async function deleteTrackFiles(trackId) {
  const keys = [
    `tracks/${trackId}/full.mp3`,
    `tracks/${trackId}/full.wav`,
    `tracks/${trackId}/preview.mp3`,
    `tracks/${trackId}/og.png`
  ];

  const deletePromises = keys.map(key => deleteFile(key));
  await Promise.allSettled(deletePromises);
}

// Get presigned URL for private file access (if needed)
async function getPresignedUrl(key, expiresIn = 3600) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresIn,
  };

  try {
    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('S3 presigned URL error:', error);
    throw new Error('Failed to generate presigned URL');
  }
}

// Check if file exists
async function fileExists(key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
}

// Get file metadata
async function getFileMetadata(key) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const result = await s3.headObject(params).promise();
    return {
      size: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
      metadata: result.Metadata,
    };
  } catch (error) {
    if (error.code === 'NotFound') {
      return null;
    }
    throw error;
  }
}

module.exports = {
  generateChartHash,
  uploadFile,
  uploadTrackAudio,
  uploadTrackPreview,
  uploadOGImage,
  uploadAvatar,
  deleteFile,
  deleteTrackFiles,
  getPresignedUrl,
  fileExists,
  getFileMetadata,
};
