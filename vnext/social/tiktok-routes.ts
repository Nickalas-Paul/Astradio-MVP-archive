import type { Request, Response } from 'express';
import { handleTikTokAuthorize, handleTikTokCallback } from './tiktok-auth';
import { postVideoToTikTok } from './tiktok-post';
import {
  composeLatestSkyExport,
  generateSkyVideoFromExport,
} from './sky-video-generator';
import { tokenStatus } from './tiktok-db-token-store';

const express = require('express') as typeof import('express');

function requireSocialSecret(req: Request, res: Response): boolean {
  const expected = process.env.SOCIAL_API_SECRET?.trim();
  if (!expected) {
    res.status(503).json({ error: 'SOCIAL_API_SECRET is not configured' });
    return false;
  }
  const provided = req.get('x-social-secret')?.trim();
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export function createTikTokRouter(): import('express').Router {
  const router = express.Router({ mergeParams: true });

  router.get('/social/tiktok/authorize', handleTikTokAuthorize);

  router.get('/social/tiktok/callback', async (req: Request, res: Response) => {
    await handleTikTokCallback(req, res);
  });

  router.get('/social/tiktok/status', async (_req: Request, res: Response) => {
    try {
      res.json(await tokenStatus());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[tiktok] status failed:', message);
      res.status(500).json({ error: 'status_failed', message });
    }
  });

  /** Heavy: compose sky audio only; returns export_id + text for post-sky. */
  router.get('/social/tiktok/latest-sky-export', async (req: Request, res: Response) => {
    if (!requireSocialSecret(req, res)) return;
    try {
      const result = await composeLatestSkyExport();
      res.json({
        export_id: result.export_id,
        text: result.text,
        title: result.title,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[tiktok] latest-sky-export failed:', message);
      res.status(500).json({ error: 'latest_sky_export_failed', message });
    }
  });

  /** Light: mux + post using a pre-existing WAV export_id. */
  router.post('/social/tiktok/post-sky', async (req: Request, res: Response) => {
    if (!requireSocialSecret(req, res)) return;
    try {
      const body = (req.body || {}) as { exportId?: unknown; text?: unknown };
      const exportId = typeof body.exportId === 'string' ? body.exportId.trim() : '';
      if (!exportId) {
        return res.status(400).json({ error: 'exportId_required' });
      }
      const textOverride = typeof body.text === 'string' ? body.text : undefined;

      const { videoBuffer, title } = await generateSkyVideoFromExport({
        exportId,
        text: textOverride,
      });
      const result = await postVideoToTikTok(videoBuffer, title);
      res.json({
        success: true,
        publish_id: result.publish_id,
        title,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[tiktok] post-sky failed:', message);
      res.status(500).json({ error: 'post_sky_failed', message });
    }
  });

  /**
   * Convenience: latest-sky-export then post-sky in one request.
   * May OOM on 512MB Render instances — prefer the split endpoints.
   */
  router.post('/social/tiktok/test-post', async (req: Request, res: Response) => {
    if (!requireSocialSecret(req, res)) return;
    try {
      const sky = await composeLatestSkyExport();
      const { videoBuffer, title } = await generateSkyVideoFromExport({
        exportId: sky.export_id,
        text: sky.text,
      });
      const result = await postVideoToTikTok(videoBuffer, title);
      res.json({
        success: true,
        publish_id: result.publish_id,
        title,
        export_id: sky.export_id,
        note: 'Runs compose + mux + post in one request; may OOM on 512MB instances. Prefer GET /latest-sky-export then POST /post-sky.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[tiktok] test-post failed:', message);
      res.status(500).json({ error: 'test_post_failed', message });
    }
  });

  return router;
}
