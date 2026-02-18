/**
 * Personality API Routes - Phase 1 Foundation
 * Express router for personality endpoints
 */

import { generatePersonalityReport, type PersonalityRequest } from './personality';

const express = require('express') as typeof import('express');

export function createPersonalityRouter(): import('express').Router {
  const router = express.Router({ mergeParams: true });

  // GET /api/personality/:chartId
  router.get('/personality/:chartId', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const chartId = req.params.chartId;
      // TODO: Load chart from storage by ID
      // For now, return error
      return res.status(501).json({ error: 'chartId lookup not yet implemented; use POST /api/personality with inline chart' });
    } catch (e: any) {
      console.error('[personality] GET /personality/:chartId', e);
      return res.status(500).json({ error: e?.message || 'Failed to get personality' });
    }
  });

  // POST /api/personality (inline chart payload)
  router.post('/personality', async (req: import('express').Request, res: import('express').Response) => {
    try {
      const body = req.body as PersonalityRequest;
      
      if (!body.chart && !body.chartId) {
        return res.status(400).json({ error: 'Either chart or chartId must be provided' });
      }

      const result = await generatePersonalityReport(body);
      return res.status(200).json(result);
    } catch (e: any) {
      console.error('[personality] POST /personality', e);
      if (e?.message?.includes('not found')) {
        return res.status(404).json({ error: e.message });
      }
      if (e?.message?.includes('chart-snapshot failed')) {
        return res.status(502).json({ error: 'Chart snapshot service unavailable' });
      }
      return res.status(500).json({ error: e?.message || 'Failed to generate personality report' });
    }
  });

  return router;
}
