/**
 * Export store abstraction: durable media storage for Render (WAV, MP4, …).
 * GCS_BUCKET → Google Cloud Storage; else S3_BUCKET → S3; else local disk (ephemeral on Render).
 */

const fs = require('fs');
const path = require('path');

const GCS_BUCKET = process.env.GCS_BUCKET;
const GCS_PREFIX = (process.env.GCS_PREFIX || 'exports/').replace(/\/?$/, '/');
const EXPORT_ROOT = process.env.EXPORT_ROOT || path.join(process.cwd(), 'exports');
const EXPORTS_SUBDIR = 'exports';

function diskExportsDir() {
  return path.join(EXPORT_ROOT, EXPORTS_SUBDIR);
}

/** @typedef {{ provider?: string; modelVersion?: string; promptHash?: string; payload_hash?: string; duration_s?: number; sha256?: string }} ExportMeta */

/** @typedef {{ extension?: string; contentType?: string }} ExportFormatOptions */

function resolveFormatOptions(options = {}) {
  const extension = options.extension || '.wav';
  const contentType = options.contentType || 'audio/wav';
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return { extension: ext, contentType };
}

/**
 * Disk-backed store (ephemeral on Render).
 */
function createDiskStore() {
  const dir = diskExportsDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('[EXPORT_STORE] disk mkdir:', e.message);
  }
  return {
    async get(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      const p = path.join(dir, `${exportKey}${ext}`);
      try {
        if (fs.existsSync(p)) return fs.readFileSync(p);
      } catch (_) {}
      return null;
    },
    async put(exportKey, buffer, _meta, options = {}) {
      const { extension: ext } = resolveFormatOptions(options);
      const p = path.join(dir, `${exportKey}${ext}`);
      try {
        fs.writeFileSync(p, buffer);
      } catch (e) {
        console.warn('[EXPORT_STORE] disk write failed:', e.message);
        throw e;
      }
    },
    stream(exportKey, res, options = {}) {
      const { extension: ext, contentType } = resolveFormatOptions(options);
      const p = path.join(dir, `${exportKey}${ext}`);
      if (!fs.existsSync(p)) return Promise.resolve(false);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      fs.createReadStream(p).pipe(res);
      return Promise.resolve(true);
    },
    async exists(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      return fs.existsSync(path.join(dir, `${exportKey}${ext}`));
    },
    storageKey(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      return path.join(dir, `${exportKey}${ext}`);
    },
  };
}

/**
 * GCS-backed store (durable on Render).
 */
function createGcsStore() {
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();
  const bucket = storage.bucket(GCS_BUCKET);
  const prefix = GCS_PREFIX;

  return {
    async get(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      const name = prefix + exportKey + ext;
      const [exists] = await bucket.file(name).exists().catch(() => [false]);
      if (!exists) return null;
      const [buf] = await bucket.file(name).download();
      return buf;
    },
    async put(exportKey, buffer, _meta, options = {}) {
      const { extension: ext, contentType } = resolveFormatOptions(options);
      const name = prefix + exportKey + ext;
      await bucket.file(name).save(buffer, {
        contentType,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
    },
    async stream(exportKey, res, options = {}) {
      const { extension: ext, contentType } = resolveFormatOptions(options);
      const name = prefix + exportKey + ext;
      const file = bucket.file(name);
      const [exists] = await file.exists().catch(() => [false]);
      if (!exists) return false;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      file.createReadStream().pipe(res);
      return true;
    },
    async exists(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      const name = prefix + exportKey + ext;
      const [exists] = await bucket.file(name).exists().catch(() => [false]);
      return exists;
    },
    storageKey(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      return `gs://${GCS_BUCKET}/${prefix}${exportKey}${ext}`;
    },
  };
}

/**
 * S3-backed store (durable on Render; reuses avatar S3 env vars).
 */
function createS3Store() {
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3({
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION || 'us-east-1',
    s3ForcePathStyle: true,
  });
  const bucket = process.env.S3_BUCKET;
  const prefix = (process.env.EXPORT_S3_PREFIX || 'exports/').replace(/\/?$/, '/');

  return {
    async get(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      try {
        const result = await s3.getObject({ Bucket: bucket, Key: `${prefix}${exportKey}${ext}` }).promise();
        return result.Body;
      } catch (err) {
        if (err.code === 'NoSuchKey') return null;
        throw err;
      }
    },

    async put(exportKey, buffer, meta, options = {}) {
      const { extension: ext, contentType } = resolveFormatOptions(options);
      await s3
        .putObject({
          Bucket: bucket,
          Key: `${prefix}${exportKey}${ext}`,
          Body: buffer,
          ContentType: contentType,
          Metadata: meta
            ? {
                provider: meta.provider || '',
                model_version: meta.modelVersion || '',
                sha256: meta.sha256 || '',
              }
            : undefined,
        })
        .promise();
    },

    async stream(exportKey, res, options = {}) {
      const { extension: ext, contentType } = resolveFormatOptions(options);
      try {
        const result = await s3.getObject({ Bucket: bucket, Key: `${prefix}${exportKey}${ext}` }).promise();
        if (!result.Body) return false;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(result.Body);
        return true;
      } catch (err) {
        if (err.code === 'NoSuchKey') return false;
        throw err;
      }
    },

    async exists(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      try {
        await s3.headObject({ Bucket: bucket, Key: `${prefix}${exportKey}${ext}` }).promise();
        return true;
      } catch (err) {
        if (err.code === 'NotFound' || err.code === 'NoSuchKey') return false;
        throw err;
      }
    },

    storageKey(exportKey, extension = '.wav') {
      const { extension: ext } = resolveFormatOptions({ extension });
      return `s3://${bucket}/${prefix}${exportKey}${ext}`;
    },
  };
}

/**
 * Create the export store. GCS → S3 → disk.
 */
function createExportStore() {
  if (GCS_BUCKET) {
    return createGcsStore();
  }
  if (process.env.S3_BUCKET) {
    return createS3Store();
  }
  return createDiskStore();
}

module.exports = { createExportStore, createDiskStore, createGcsStore, createS3Store, resolveFormatOptions };
