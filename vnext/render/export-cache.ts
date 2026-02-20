/**
 * Cache-first determinism: export key from payload.hash + provider + modelVersion + promptHash + duration_s.
 * Read/write EXPORT_ROOT/exports/{exportKey}.wav and integrity.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const EXPORT_ROOT = process.env.EXPORT_ROOT || path.join(process.cwd(), 'exports');
const EXPORTS_SUBDIR = 'exports';

function exportsDir(): string {
  return path.join(EXPORT_ROOT, EXPORTS_SUBDIR);
}

export function computeExportKey(
  payloadHash: string,
  provider: string,
  modelVersion: string,
  promptHash: string,
  duration_s: number
): string {
  const input = `${payloadHash}\n${provider}\n${modelVersion}\n${promptHash}\n${duration_s}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt, 'utf8').digest('hex');
}

export function getCachedWav(exportKey: string): Buffer | null {
  const dir = exportsDir();
  const wavPath = path.join(dir, `${exportKey}.wav`);
  try {
    if (fs.existsSync(wavPath)) return fs.readFileSync(wavPath);
  } catch {
    // ignore
  }
  return null;
}

export interface IntegrityMeta {
  sha256: string;
  size_bytes: number;
  createdAt: string;
  payload_hash: string;
  promptHash: string;
  provider: string;
  modelVersion: string;
  duration_s: number;
}

export function writeExport(exportKey: string, wavBuffer: Buffer, meta: IntegrityMeta): void {
  const dir = exportsDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn('[EXPORT_CACHE] mkdir failed:', (e as Error).message);
    return;
  }
  const wavPath = path.join(dir, `${exportKey}.wav`);
  const jsonPath = path.join(dir, `${exportKey}.integrity.json`);
  try {
    fs.writeFileSync(wavPath, wavBuffer);
    fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
  } catch (e) {
    console.warn('[EXPORT_CACHE] write failed:', (e as Error).message);
  }
}

export function readIntegrity(exportKey: string): IntegrityMeta | null {
  const jsonPath = path.join(exportsDir(), `${exportKey}.integrity.json`);
  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(raw) as IntegrityMeta;
  } catch {
    return null;
  }
}

/** Path to WAV file for streaming (engine only). */
export function getExportWavPath(exportKey: string): string {
  return path.join(exportsDir(), `${exportKey}.wav`);
}

export function exportExists(exportKey: string): boolean {
  return fs.existsSync(getExportWavPath(exportKey));
}
