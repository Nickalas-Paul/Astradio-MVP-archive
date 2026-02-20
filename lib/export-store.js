/**
 * Export store abstraction: durable WAV storage for Render.
 * When GCS_BUCKET is set, uses Google Cloud Storage. Otherwise uses local disk (ephemeral on Render).
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
    async get(exportKey) {
      const p = path.join(dir, `${exportKey}.wav`);
      try {
        if (fs.existsSync(p)) return fs.readFileSync(p);
      } catch (_) {}
      return null;
    },
    async put(exportKey, buffer, _meta) {
      const p = path.join(dir, `${exportKey}.wav`);
      try {
        fs.writeFileSync(p, buffer);
      } catch (e) {
        console.warn('[EXPORT_STORE] disk write failed:', e.message);
        throw e;
      }
    },
    stream(exportKey, res) {
      const p = path.join(dir, `${exportKey}.wav`);
      if (!fs.existsSync(p)) return Promise.resolve(false);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      fs.createReadStream(p).pipe(res);
      return Promise.resolve(true);
    },
    async exists(exportKey) {
      return fs.existsSync(path.join(dir, `${exportKey}.wav`));
    },
    storageKey(exportKey) {
      return path.join(dir, `${exportKey}.wav`);
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
    async get(exportKey) {
      const name = prefix + exportKey + '.wav';
      const [exists] = await bucket.file(name).exists().catch(() => [false]);
      if (!exists) return null;
      const [buf] = await bucket.file(name).download();
      return buf;
    },
    async put(exportKey, buffer, _meta) {
      const name = prefix + exportKey + '.wav';
      await bucket.file(name).save(buffer, {
        contentType: 'audio/wav',
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
    },
    async stream(exportKey, res) {
      const name = prefix + exportKey + '.wav';
      const file = bucket.file(name);
      const [exists] = await file.exists().catch(() => [false]);
      if (!exists) return false;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      file.createReadStream().pipe(res);
      return true;
    },
    async exists(exportKey) {
      const name = prefix + exportKey + '.wav';
      const [exists] = await bucket.file(name).exists().catch(() => [false]);
      return exists;
    },
    storageKey(exportKey) {
      return `gs://${GCS_BUCKET}/${prefix}${exportKey}.wav`;
    },
  };
}

/**
 * Create the export store. When GCS_BUCKET is set, returns GCS store; otherwise disk store.
 */
function createExportStore() {
  if (GCS_BUCKET) {
    return createGcsStore();
  }
  return createDiskStore();
}

module.exports = { createExportStore, createDiskStore, createGcsStore };
