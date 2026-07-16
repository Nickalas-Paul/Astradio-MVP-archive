import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import moment from 'moment-timezone';
import sharp from 'sharp';
import type { EphemerisSnapshot } from '../contracts';
import { ComposeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';
import { engineInternalFetchHeaders } from '../core/engine-internal-fetch';
import { BRAND, resolveRenderAsset } from '../render/design-tokens';
import { svgToPng } from '../render/standard/svg-to-png';

const ffmpegPath = require('ffmpeg-static') as string | null;

const WIDTH = 1080;
const HEIGHT = 1920;

type ExportStore = {
  get?: (key: string, extension?: string) => Promise<Buffer | null>;
};

function getExportStore(): ExportStore | undefined {
  return (process as { __astradio_export_store?: ExportStore }).__astradio_export_store;
}

export function getCanonicalLocation(): { lat: number; lon: number; timezone: string } {
  return {
    lat: Number(process.env.SOCIAL_CANONICAL_LAT ?? '29.9511'),
    lon: Number(process.env.SOCIAL_CANONICAL_LON ?? '-97.7378'),
    timezone: process.env.SOCIAL_CANONICAL_TIMEZONE?.trim() || 'America/Chicago',
  };
}

function resolveNowInTimezone(tz: string): { dateStr: string; timeStr: string; datetime: string } {
  const now = moment.tz(tz);
  const dateStr = now.format('YYYY-MM-DD');
  const timeStr = now.format('HH:mm');
  return {
    dateStr,
    timeStr,
    datetime: `${dateStr}T${timeStr}:00`,
  };
}

function buildSkyComposeRequest(generateAudio: boolean): ComposeRequest {
  const { lat, lon, timezone } = getCanonicalLocation();
  const { datetime } = resolveNowInTimezone(timezone);
  return {
    mode: 'sky',
    skyParams: {
      latitude: lat,
      longitude: lon,
      datetime,
      timezone,
    },
    generateAudio,
  };
}

async function fetchChartSnapshot(params: {
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone: string;
}): Promise<EphemerisSnapshot> {
  const PORT = process.env.PORT || '4000';
  const base = process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || `http://localhost:${PORT}`;
  const query = new URLSearchParams({
    date: params.date,
    time: params.time,
    lat: String(params.lat),
    lon: String(params.lon),
    timezone: params.timezone,
  });
  const url = `${base}/api/chart-snapshot?${query}`;
  const res = await fetch(url, { headers: engineInternalFetchHeaders() });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      (typeof data.error === 'string' && data.error) ||
      `chart-snapshot failed: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as EphemerisSnapshot;
}

function takeFirstSentences(text: string, maxSentences: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  return parts
    .slice(0, maxSentences)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}

export function extractExplanationText(compose: Record<string, unknown>): string {
  const explanation = compose.explanation as { sections?: Array<{ text?: string }> } | undefined;
  if (Array.isArray(explanation?.sections)) {
    for (const section of explanation.sections) {
      if (typeof section.text === 'string' && section.text.trim()) {
        const excerpt = takeFirstSentences(section.text, 3);
        if (excerpt) return excerpt;
      }
    }
  }
  const text = compose.text as { long?: string; short?: string } | undefined;
  if (typeof text?.long === 'string' && text.long.trim()) {
    return takeFirstSentences(text.long, 3);
  }
  if (typeof text?.short === 'string' && text.short.trim()) {
    return takeFirstSentences(text.short, 3);
  }
  return 'The sky shifts today with new planetary patterns shaping the mood.';
}

function dominantElement(
  compose: Record<string, unknown>,
  snapshot: EphemerisSnapshot | null,
): string {
  const astro = compose.astro as { element_dominance?: string } | undefined;
  if (typeof astro?.element_dominance === 'string' && astro.element_dominance.trim()) {
    return astro.element_dominance.trim().toLowerCase();
  }
  const de = snapshot?.dominantElements;
  if (!de) return 'cosmic';
  const ranked = Object.entries(de).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? 'cosmic';
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 8);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fontFileUrl(relativePath: string): string {
  const abs = resolveRenderAsset(relativePath).replace(/\\/g, '/');
  return `file://${abs}`;
}

async function buildBrandedCardPng(params: {
  displayDate: string;
  bodyText: string;
}): Promise<Buffer> {
  const { displayDate, bodyText } = params;
  const bg = BRAND.colors.background;
  const accent = BRAND.colors.accent;
  const bodyLines = wrapText(bodyText, 40);

  const logoPath = resolveRenderAsset(BRAND.logoPaths.wordmark);
  const logoMeta = await sharp(logoPath).metadata();
  const logoTargetWidth = 420;
  const logoBuffer = await sharp(logoPath).resize(logoTargetWidth).png().toBuffer();

  const titleY = 220;
  const dateY = 300;
  const bodyStartY = 420;
  const bodyLineHeight = 52;
  const ctaY = HEIGHT - 120;

  const bodyTspans = bodyLines
    .map((line, i) => {
      const y = bodyStartY + i * bodyLineHeight;
      return `<tspan x="540" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <style>
      @font-face {
        font-family: 'ManropeBold';
        src: url('${fontFileUrl(BRAND.fontPaths.manropeBold)}');
      }
      @font-face {
        font-family: 'ManropeRegular';
        src: url('${fontFileUrl(BRAND.fontPaths.manropeRegular)}');
      }
      @font-face {
        font-family: 'ManropeMedium';
        src: url('${fontFileUrl(BRAND.fontPaths.manropeMedium)}');
      }
      @font-face {
        font-family: 'CormorantRegular';
        src: url('${fontFileUrl(BRAND.fontPaths.cormorantRegular)}');
      }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="540" y="${titleY}" text-anchor="middle" fill="${BRAND.colors.textPrimary}"
    font-family="ManropeBold" font-size="64">Today's Sky</text>
  <text x="540" y="${dateY}" text-anchor="middle" fill="${accent}"
    font-family="ManropeRegular" font-size="36">${escapeXml(displayDate)}</text>
  <text text-anchor="middle" fill="${BRAND.colors.textPrimary}"
    font-family="CormorantRegular" font-size="40">${bodyTspans}</text>
  <text x="540" y="${ctaY}" text-anchor="middle" fill="${accent}"
    font-family="ManropeMedium" font-size="34">astradio.io</text>
</svg>`;

  const textOverlay = await svgToPng(svg, WIDTH, HEIGHT);
  const logoTop = 72;

  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: bg,
    },
  })
    .composite([
      { input: textOverlay, top: 0, left: 0 },
      { input: logoBuffer, top: logoTop, left: Math.round((WIDTH - logoTargetWidth) / 2) },
    ])
    .png()
    .toBuffer();
}

function runFfmpeg(args: string[]): Promise<void> {
  if (!ffmpegPath) {
    return Promise.reject(new Error('ffmpeg-static binary path is not available'));
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function muxImageAndAudioToMp4(imagePng: Buffer, wavBuffer: Buffer): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astradio-social-'));
  const imagePath = path.join(tmpDir, 'card.png');
  const wavPath = path.join(tmpDir, 'audio.wav');
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    await fs.promises.writeFile(imagePath, imagePng);
    await fs.promises.writeFile(wavPath, wavBuffer);

    await runFfmpeg([
      '-y',
      '-loop',
      '1',
      '-i',
      imagePath,
      '-i',
      wavPath,
      '-c:v',
      'libx264',
      '-tune',
      'stillimage',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-pix_fmt',
      'yuv420p',
      '-shortest',
      '-movflags',
      '+faststart',
      outputPath,
    ]);

    return await fs.promises.readFile(outputPath);
  } finally {
    for (const file of [imagePath, wavPath, outputPath]) {
      try {
        await fs.promises.unlink(file);
      } catch {
        /* ignore */
      }
    }
    try {
      await fs.promises.rmdir(tmpDir);
    } catch {
      /* ignore */
    }
  }
}

function buildTikTokTitle(displayDate: string, element: string): string {
  const elementLabel = element.charAt(0).toUpperCase() + element.slice(1);
  return `Today's Sky — ${displayDate} 🌌 What does ${elementLabel} energy sound like? #astrology #birthchart #astradio`;
}

function extractExportId(compose: Record<string, unknown>): string {
  const exportId =
    (typeof compose.export_id === 'string' && compose.export_id) ||
    ((compose.audio as { export_id?: string } | undefined)?.export_id ?? '');
  if (!exportId || !/^[a-f0-9]{64}$/.test(exportId)) {
    throw new Error('Compose did not return a valid export_id (enable ENABLE_WAV_EXPORT=1)');
  }
  return exportId;
}

/** Heavy path: sky compose with audio. Returns export id + text for a later post-sky call. */
export async function composeLatestSkyExport(): Promise<{
  export_id: string;
  text: string;
  title: string;
}> {
  const { lat, lon, timezone } = getCanonicalLocation();
  const { dateStr, timeStr, datetime } = resolveNowInTimezone(timezone);
  const displayDate = moment.tz(datetime, timezone).format('MMMM D, YYYY');

  const snapshot = await fetchChartSnapshot({
    date: dateStr,
    time: timeStr,
    lat,
    lon,
    timezone,
  });

  const composeAPI = new ComposeAPI();
  const compose = (await composeAPI.compose(
    buildSkyComposeRequest(true),
  )) as unknown as Record<string, unknown>;

  const exportId = extractExportId(compose);
  const text = extractExplanationText(compose);
  const element = dominantElement(compose, snapshot);
  const title = buildTikTokTitle(displayDate, element);

  return { export_id: exportId, text, title };
}

/** Light path: text-only sky compose (no audio export). */
export async function composeSkyTextOnly(): Promise<{
  text: string;
  title: string;
  displayDate: string;
}> {
  const { lat, lon, timezone } = getCanonicalLocation();
  const { dateStr, timeStr, datetime } = resolveNowInTimezone(timezone);
  const displayDate = moment.tz(datetime, timezone).format('MMMM D, YYYY');

  const snapshot = await fetchChartSnapshot({
    date: dateStr,
    time: timeStr,
    lat,
    lon,
    timezone,
  });

  const composeAPI = new ComposeAPI();
  const compose = (await composeAPI.compose(
    buildSkyComposeRequest(false),
  )) as unknown as Record<string, unknown>;

  const text = extractExplanationText(compose);
  const element = dominantElement(compose, snapshot);
  return {
    text,
    title: buildTikTokTitle(displayDate, element),
    displayDate,
  };
}

/** Build branded video from an existing WAV export (no audio compose). */
export async function generateSkyVideoFromExport(params: {
  exportId: string;
  text?: string;
}): Promise<{ videoBuffer: Buffer; title: string }> {
  const exportId = params.exportId.trim();
  if (!/^[a-f0-9]{64}$/.test(exportId)) {
    throw new Error('exportId must be a 64-character hex string');
  }

  const exportStore = getExportStore();
  if (!exportStore?.get) {
    throw new Error('Export store is not available on this process');
  }

  const wavBuffer = await exportStore.get(exportId, '.wav');
  if (!wavBuffer || wavBuffer.length === 0) {
    throw new Error(`Audio export not found in store for export_id ${exportId}`);
  }

  const { timezone } = getCanonicalLocation();
  const { datetime } = resolveNowInTimezone(timezone);
  const displayDate = moment.tz(datetime, timezone).format('MMMM D, YYYY');

  let bodyText = typeof params.text === 'string' ? params.text.trim() : '';
  let title = buildTikTokTitle(displayDate, 'cosmic');

  if (!bodyText) {
    const skyText = await composeSkyTextOnly();
    bodyText = skyText.text;
    title = skyText.title;
  }

  const imagePng = await buildBrandedCardPng({ displayDate, bodyText });
  const videoBuffer = await muxImageAndAudioToMp4(imagePng, wavBuffer);

  return { videoBuffer, title };
}

/** Full path (may OOM on 512MB): compose audio + build video. */
export async function generateSkyVideo(): Promise<{ videoBuffer: Buffer; title: string }> {
  const { export_id, text, title } = await composeLatestSkyExport();
  const { videoBuffer } = await generateSkyVideoFromExport({ exportId: export_id, text });
  return { videoBuffer, title };
}
