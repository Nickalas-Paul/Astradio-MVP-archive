import type { Request, Response } from 'express';
import { handleTikTokAuthorize, handleTikTokCallback } from './tiktok-auth';
import { postVideoToTikTok } from './tiktok-post';
import { generateSkyVideo } from './sky-video-generator';
import { tokenStatus } from './tiktok-token-store';

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

  router.get('/social/tiktok/status', (_req: Request, res: Response) => {
    res.json(tokenStatus());
  });

  router.post('/social/tiktok/test-post', async (req: Request, res: Response) => {
    if (!requireSocialSecret(req, res)) return;
    try {
      const { videoBuffer, title } = await generateSkyVideo();
      const result = await postVideoToTikTok(videoBuffer, title);
      res.json({
        ok: true,
        publish_id: result.publish_id,
        title,
        video_bytes: videoBuffer.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[tiktok] test-post failed:', message);
      res.status(500).json({ error: 'test_post_failed', message });
    }
  });

  return router;
}
