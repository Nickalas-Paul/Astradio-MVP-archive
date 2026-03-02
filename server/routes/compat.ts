// Compatibility API Routes
// Non-blocking, cache-first compatibility matching endpoints

import express from 'express';
import { 
  CompatProfile, 
  CompatMatch, 
  CompatQuery, 
  CompatResponse,
  CreateProfileRequest,
  UpdateProfileRequest,
  GenerateMatchesRequest,
  RationaleRequest,
  RationaleResponse
} from '../../src/core/compat/types';
import { scoreCompatibility } from '../compat/score';
import { getChartFeatures } from '../compat/features';
import { getCachedMatches, setCachedMatches, invalidateCache } from '../compat/cache';
import { generateMatches } from '../compat/matcher';

const router = express.Router();

// Create or update compatibility profile (DEPRECATED)
router.post('/profile', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Return 410 Gone for deprecated endpoint
  return res.status(410).json({
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'This endpoint has been deprecated and will be removed in a future release'
    },
    requestId
  });
});

// Update existing profile (DEPRECATED)
router.put('/profile', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Return 410 Gone for deprecated endpoint
  return res.status(410).json({
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'This endpoint has been deprecated and will be removed in a future release'
    },
    requestId
  });
});

// Get compatibility matches
router.get('/matches', async (req, res) => {
  try {
    const { chartId, facets = ['overall'], limit = 10, cursor }: CompatQuery = req.query as any;

    if (!chartId) {
      return res.status(400).json({ error: 'chartId is required' });
    }

    // 1) Try cache first
    const cachedMatches = await getCachedMatches(chartId, facets[0], limit);
    if (cachedMatches && cachedMatches.length > 0) {
      const response: CompatResponse = {
        matches: cachedMatches,
        facet: facets[0],
        hasMore: cachedMatches.length === limit,
        lastUpdated: new Date().toISOString()
      };
      return res.status(200).json(response);
    }

    // 2) Cache miss - trigger on-demand compute
    const matches = await generateMatches({
      chartId,
      facets,
      limit,
      forceRefresh: false
    });

    if (matches.length > 0) {
      // Cache the results
      await setCachedMatches(chartId, facets[0], matches);
      
      const response: CompatResponse = {
        matches,
        facet: facets[0],
        hasMore: matches.length === limit,
        lastUpdated: new Date().toISOString()
      };
      return res.status(200).json(response);
    }

    // 3) Still computing - return 202 with cursor
    return res.status(202).json({
      message: 'Matches are being computed. Please retry in a few seconds.',
      cursor: `compute_${Date.now()}`,
      estimatedWait: '5-10 seconds'
    });

  } catch (error) {
    console.error('Error fetching matches:', error);
    return res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Get detailed rationale for a specific pair (DEPRECATED)
router.get('/rationale/:pairId', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Return 410 Gone for deprecated endpoint
  return res.status(410).json({
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'This endpoint has been deprecated and will be removed in a future release'
    },
    requestId
  });
});

// Generate matches for a specific chart (DEPRECATED)
router.post('/generate', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Return 410 Gone for deprecated endpoint
  return res.status(410).json({
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'This endpoint has been deprecated and will be removed in a future release'
    },
    requestId
  });
});

// Get profile for a user/chart (DEPRECATED)
router.get('/profile/:userId/:chartId', async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Return 410 Gone for deprecated endpoint
  return res.status(410).json({
    error: {
      code: 'ENDPOINT_DEPRECATED',
      message: 'This endpoint has been deprecated and will be removed in a future release'
    },
    requestId
  });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'compatibility',
    timestamp: new Date().toISOString()
  });
});

export default router;
