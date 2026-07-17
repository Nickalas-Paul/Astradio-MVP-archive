/**
 * TikTok cron orchestrator — single-run pipeline entry point.
 * Start command: node dist/vnext/vnext/social/cron-entry.js
 * Not a server: runs, posts, cleans up, exits.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  downloadAuraLoop,
  cleanupAuraLoop,
  type AuraElement,
} from './aura-loop-store';
import { buildBrandedCardPng } from './branded-card';
import { muxLoopWithOverlayAndAudio } from './video-muxer';
import { postVideoToTikTok } from './tiktok-post';
import { buildTikTokCaption } from './caption-builder';

interface SkyExportResponse {
  export_id: string;
  text: string;
  title: string;
  element: AuraElement;
}

const AURA_ELEMENTS: ReadonlySet<string> = new Set([
  'fire',
  'earth',
  'air',
  'water',
  'cosmic',
]);

function parseSkyExport(body: unknown): SkyExportResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('sky export response is not an object');
  }
  const obj = body as Record<string, unknown>;
  const export_id = obj.export_id;
  const text = obj.text;
  const title = obj.title;
  const elementRaw = typeof obj.element === 'string' ? obj.element.toLowerCase() : '';
  if (typeof export_id !== 'string' || !export_id) {
    throw new Error('sky export missing export_id');
  }
  if (typeof text !== 'string' || !text) {
    throw new Error('sky export missing text');
  }
  if (typeof title !== 'string') {
    throw new Error('sky export missing title');
  }
  const element = (AURA_ELEMENTS.has(elementRaw) ? elementRaw : 'cosmic') as AuraElement;
  if (!AURA_ELEMENTS.has(elementRaw)) {
    console.warn(`[cron] Unknown element "${obj.element}", using cosmic`);
  }
  return { export_id, text, title, element };
}

(async () => {
  console.log('[cron] TikTok posting pipeline starting...');
  console.log('[cron] Timestamp:', new Date().toISOString());

  let loopPath: string | undefined;
  let tmpDir: string | undefined;
  let audioPath: string | undefined;
  let overlayPath: string | undefined;
  let outputPath: string | undefined;

  try {
    const required = [
      'PROXY_SHARED_SECRET',
      'SOCIAL_API_SECRET',
      'GCS_BUCKET',
      'POSTGRES_URL',
      'TIKTOK_CLIENT_KEY',
      'TIKTOK_CLIENT_SECRET',
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error(`[cron] Missing required env vars: ${missing.join(', ')}`);
      process.exit(1);
    }

    const ENGINE_URL =
      process.env.ENGINE_URL || 'https://astradio-mvp-archive.onrender.com';
    const PROXY_SECRET = process.env.PROXY_SHARED_SECRET as string;
    const SOCIAL_SECRET = process.env.SOCIAL_API_SECRET as string;

    // Step 1 — Fetch sky data from engine
    console.log('[cron] Step 1: Fetching latest sky export from engine...');
    const skyRes = await fetch(`${ENGINE_URL}/api/social/tiktok/latest-sky-export`, {
      method: 'GET',
      headers: {
        'x-proxy-secret': PROXY_SECRET,
        'x-social-secret': SOCIAL_SECRET,
      },
    });
    const skyBodyText = await skyRes.text();
    if (!skyRes.ok) {
      console.error(
        `[cron] Step 1 FAILED: could not fetch sky export — ${skyRes.status} ${skyBodyText}`,
      );
      process.exit(1);
    }
    let skyJson: unknown;
    try {
      skyJson = JSON.parse(skyBodyText);
    } catch {
      console.error(
        `[cron] Step 1 FAILED: could not fetch sky export — ${skyRes.status} ${skyBodyText}`,
      );
      process.exit(1);
    }
    const skyData = parseSkyExport(skyJson);
    console.log(
      `[cron] Step 1: Got export_id=${skyData.export_id.slice(0, 16)}... element=${skyData.element}`,
    );

    // Step 2 — Download Aura loop from GCS
    loopPath = await downloadAuraLoop(skyData.element);
    console.log(`[cron] Step 2: Downloaded ${skyData.element} aura loop to ${loopPath}`);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astradio-cron-'));
    audioPath = path.join(tmpDir, 'audio.wav');
    overlayPath = path.join(tmpDir, 'overlay.png');
    outputPath = path.join(tmpDir, 'output.mp4');

    // Step 3 — Download audio WAV from engine
    console.log(`[cron] Step 3: Downloading audio for export ${skyData.export_id.slice(0, 16)}...`);
    const audioRes = await fetch(`${ENGINE_URL}/api/exports/${skyData.export_id}`, {
      method: 'GET',
      headers: {
        'x-proxy-secret': PROXY_SECRET,
      },
    });
    if (!audioRes.ok) {
      const errBody = await audioRes.text().catch(() => '');
      console.error(
        `[cron] Step 3 FAILED: could not download audio for export ${skyData.export_id} — ${audioRes.status} ${errBody}`,
      );
      process.exit(1);
    }
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    fs.writeFileSync(audioPath, audioBuffer);
    console.log(`[cron] Step 3: Downloaded audio (${audioBuffer.length} bytes)`);

    // Step 4 — Generate transparent text overlay PNG
    const timezone = process.env.SOCIAL_CANONICAL_TIMEZONE || 'America/Chicago';
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    });

    const overlayBuffer = await buildBrandedCardPng({
      title: "Today's Sky",
      date: dateStr,
      bodyText: skyData.text,
      ctaText: 'astradio.io',
      transparentBackground: true,
    });
    fs.writeFileSync(overlayPath, overlayBuffer);
    console.log(`[cron] Step 4: Generated text overlay (${overlayBuffer.length} bytes)`);

    // Step 5 — Composite video
    await muxLoopWithOverlayAndAudio({
      loopVideoPath: loopPath,
      overlayImagePath: overlayPath,
      audioPath,
      outputPath,
      durationSeconds: 30,
    });
    console.log(`[cron] Step 5: Video composited at ${outputPath}`);

    // Step 6 — Post to TikTok
    const videoBuffer = fs.readFileSync(outputPath);
    const caption = buildTikTokCaption({
      text: skyData.text,
      title: skyData.title,
      element: skyData.element,
    });
    const result = await postVideoToTikTok(videoBuffer, caption);
    console.log(`[cron] Step 6: Posted to TikTok — publish_id: ${result.publish_id}`);

    // Step 7 — Cleanup and exit
    try {
      if (overlayPath) fs.unlinkSync(overlayPath);
      if (audioPath) fs.unlinkSync(audioPath);
      if (outputPath) fs.unlinkSync(outputPath);
      if (tmpDir) fs.rmdirSync(tmpDir);
    } catch (e) {
      console.log('[cron] Cleanup warning:', (e as Error).message);
    }

    if (loopPath) cleanupAuraLoop(loopPath);

    console.log('[cron] Pipeline complete. Exiting.');
    process.exit(0);
  } catch (error) {
    console.error('[cron] Pipeline failed:', (error as Error).message);
    console.error('[cron] Stack:', (error as Error).stack);

    try {
      if (overlayPath && fs.existsSync(overlayPath)) fs.unlinkSync(overlayPath);
      if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (tmpDir && fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
    } catch {
      /* ignore */
    }
    if (loopPath) cleanupAuraLoop(loopPath);

    process.exit(1);
  }
})();
