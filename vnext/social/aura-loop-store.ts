import fs from 'fs';
import os from 'os';
import path from 'path';
import { Storage } from '@google-cloud/storage';

export type AuraElement = 'fire' | 'earth' | 'air' | 'water' | 'cosmic';

const GCS_PREFIX = 'aura-loops/';
const FALLBACK_ELEMENT: AuraElement = 'water';

function ensureGcpCredentials(): void {
  try {
    const gcp = require(path.join(process.cwd(), 'lib', 'gcp-credentials')) as {
      loadGcpCredentials?: () => void;
    };
    gcp.loadGcpCredentials?.();
  } catch {
    /* optional when ADC is already configured */
  }
}

function getBucket() {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) {
    throw new Error('GCS_BUCKET env var is required for aura loop download');
  }
  ensureGcpCredentials();
  const storage = new Storage();
  return storage.bucket(bucketName);
}

/**
 * Download the Aura loop MP4 for the given element from GCS to a temp file.
 * Falls back to water.mp4 if the requested element object is missing.
 * Returns the local temp file path.
 */
export async function downloadAuraLoop(element: AuraElement): Promise<string> {
  const bucket = getBucket();
  let objectName = `${GCS_PREFIX}${element}.mp4`;
  let file = bucket.file(objectName);
  const [exists] = await file.exists();

  if (!exists) {
    console.warn(
      `[aura-loop] ${element}.mp4 not found on GCS, falling back to water.mp4`,
    );
    objectName = `${GCS_PREFIX}${FALLBACK_ELEMENT}.mp4`;
    file = bucket.file(objectName);
    const [fallbackExists] = await file.exists();
    if (!fallbackExists) {
      throw new Error(`Aura loop not found on GCS: ${objectName}`);
    }
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astradio-aura-'));
  const localPath = path.join(tmpDir, `${element}.mp4`);
  await file.download({ destination: localPath });
  return localPath;
}

/** Delete a downloaded aura loop temp file and its parent temp directory. Errors are logged, not thrown. */
export function cleanupAuraLoop(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(
      '[aura-loop] failed to delete temp file:',
      err instanceof Error ? err.message : String(err),
    );
  }
  try {
    const dir = path.dirname(filePath);
    if (fs.existsSync(dir)) {
      fs.rmdirSync(dir);
    }
  } catch (err) {
    console.warn(
      '[aura-loop] failed to delete temp dir:',
      err instanceof Error ? err.message : String(err),
    );
  }
}
