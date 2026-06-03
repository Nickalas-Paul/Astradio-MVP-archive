/**
 * Avatar upload pipeline: Rekognition moderation + sharp resize/crop.
 */

const AWS = require('aws-sdk');
const sharp = require('sharp');

const MODERATION_CONFIDENCE_THRESHOLD = 75;

const MODERATION_REJECTION_MESSAGE =
  'This image could not be uploaded. Please choose a different photo.';

function matchesJpg(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function matchesPng(buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function matchesGif(buffer) {
  return buffer.length >= 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
}

function matchesWebp(buffer) {
  if (buffer.length < 12) return false;
  const riff =
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const webp =
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  return riff && webp;
}

/**
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isValidImageBuffer(buffer) {
  if (!buffer || buffer.length < 12) return false;
  return matchesJpg(buffer) || matchesPng(buffer) || matchesGif(buffer) || matchesWebp(buffer);
}

function awsCredentials() {
  return {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION || 'us-east-1',
  };
}

function getRekognition() {
  const creds = awsCredentials();
  return new AWS.Rekognition({
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: creds.region,
  });
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ ok: true } | { ok: false, message: string }>}
 */
async function moderateImageBuffer(buffer) {
  const rekognition = getRekognition();
  const result = await rekognition
    .detectModerationLabels({
      Image: { Bytes: buffer },
      MinConfidence: MODERATION_CONFIDENCE_THRESHOLD,
    })
    .promise();

  const labels = result.ModerationLabels || [];
  const flagged = labels.filter((l) => (l.Confidence || 0) >= MODERATION_CONFIDENCE_THRESHOLD);
  if (flagged.length > 0) {
    console.log('[avatar] moderation rejected', {
      labels: flagged.map((l) => ({
        Name: l.Name,
        ParentName: l.ParentName,
        Confidence: l.Confidence,
      })),
    });
    return { ok: false, message: MODERATION_REJECTION_MESSAGE };
  }
  return { ok: true };
}

/**
 * Resize to 400x400 cover crop, JPEG 80%.
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
async function processAvatarImage(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toBuffer();
}

module.exports = {
  isValidImageBuffer,
  moderateImageBuffer,
  processAvatarImage,
  MODERATION_REJECTION_MESSAGE,
  MODERATION_CONFIDENCE_THRESHOLD,
};
