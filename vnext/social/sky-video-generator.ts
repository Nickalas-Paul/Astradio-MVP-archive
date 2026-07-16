import fs from 'fs';
import os from 'os';
import path from 'path';
import moment from 'moment-timezone';
import type { EphemerisSnapshot } from '../contracts';
import { ComposeAPI } from '../api/compose';
import type { ComposeRequest } from '../explainer/contracts';
import { engineInternalFetchHeaders } from '../core/engine-internal-fetch';
import { buildBrandedCardPng } from './branded-card';
import { muxImageAndAudio } from './video-muxer';

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

async function muxImageAndAudioToMp4(imagePng: Buffer, wavBuffer: Buffer): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astradio-social-'));
  const imagePath = path.join(tmpDir, 'card.png');
  const wavPath = path.join(tmpDir, 'audio.wav');
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    await fs.promises.writeFile(imagePath, imagePng);
    await fs.promises.writeFile(wavPath, wavBuffer);
    await muxImageAndAudio({ imagePath, audioPath: wavPath, outputPath });
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
  element: string;
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

  return { export_id: exportId, text, title, element };
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

  const imagePng = await buildBrandedCardPng({
    title: "Today's Sky",
    date: displayDate,
    bodyText,
    ctaText: 'astradio.io',
  });
  const videoBuffer = await muxImageAndAudioToMp4(imagePng, wavBuffer);

  return { videoBuffer, title };
}

/** Full path (may OOM on 512MB): compose audio + build video. */
export async function generateSkyVideo(): Promise<{ videoBuffer: Buffer; title: string }> {
  const { export_id, text, title } = await composeLatestSkyExport();
  const { videoBuffer } = await generateSkyVideoFromExport({ exportId: export_id, text });
  return { videoBuffer, title };
}
