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

    // 1) Fetch chart features from engine encoder (read-only)
    const features64 = await getChartFeatures(chartId);
    if (!features64) {
      return res.status(404).json({ error: 'Chart not found or features unavailable' });
    }

    // 2) Create/update profile
    const profile: CompatProfile = {
      userId,
      chartId,
      features64,
      prefs,
      visibility,
      updatedAt: new Date().toISOString()
    };

    // TODO: Persist to database
    // await saveProfile(profile);

    // 3) Invalidate cache and enqueue background refresh
    await invalidateCache(chartId);
    // TODO: Enqueue background job to refresh matches

    return res.status(202).json({ 
      ok: true, 
      message: 'Profile created/updated. Matches will be refreshed in background.' 
    });

  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ error: 'Failed to create profile' });
  }
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

    // TODO: Update existing profile in database
    // const existingProfile = await getProfile(userId, chartId);
    // if (!existingProfile) {
    //   return res.status(404).json({ error: 'Profile not found' });
    // }

    // Update profile with new preferences
    // const updatedProfile = { ...existingProfile, prefs, visibility, updatedAt: new Date().toISOString() };
    // await saveProfile(updatedProfile);

    // Invalidate cache
    await invalidateCache(chartId);

    return res.status(200).json({ ok: true, message: 'Profile updated successfully' });

  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
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

    // Get features for both charts
    const featuresA = await getChartFeatures(chartIdA);
    const featuresB = await getChartFeatures(chartIdB);

    if (!featuresA || !featuresB) {
      return res.status(404).json({ error: 'One or both charts not found' });
    }

    // TODO: Compute synastry features
    // const synFeatures = await computeSynastryFeatures(chartIdA, chartIdB);

    // For now, return mock synastry features
    const synFeatures = [
      {
        aspect: 'trine' as const,
        bodies: ['Venus', 'Mars'] as [string, string],
        orbDeg: 2.5,
        strength: 0.8,
        dignity: 'domicile' as const
      },
      {
        aspect: 'sextile' as const,
        bodies: ['Sun', 'Moon'] as [string, string],
        orbDeg: 1.8,
        strength: 0.9,
        dignity: null
      }
    ];

    // Score the compatibility
    const result = scoreCompatibility({
      facet: facet as any,
      A: { features64: featuresA },
      B: { features64: featuresB },
      syn: synFeatures
    });

    const response: RationaleResponse = {
      facet: facet as any,
      score: result.score,
      rationale: result.rationale,
      synFeatures,
      breakdown: result.breakdown!
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching rationale:', error);
    return res.status(500).json({ error: 'Failed to fetch rationale' });
  }
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

    const matches = await generateMatches({
      chartId,
      facets,
      limit,
      forceRefresh
    });

    // Cache the results
    for (const facet of facets) {
      await setCachedMatches(chartId, facet, matches);
    }

    return res.status(200).json({
      ok: true,
      matches,
      cached: true,
      message: `Generated ${matches.length} matches for ${facets.join(', ')}`
    });

  } catch (error) {
    console.error('Error generating matches:', error);
    return res.status(500).json({ error: 'Failed to generate matches' });
  }
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

    // For now, return mock profile
    const profile: CompatProfile = {
      userId,
      chartId,
      features64: new Array(64).fill(0).map(() => Math.random() * 2 - 1), // Mock features
      prefs: {
        energy: 0.7,
        mood: 0.6,
        complexity: 0.8
      },
      visibility: 'private',
      updatedAt: new Date().toISOString()
    };

    return res.status(200).json(profile);

  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
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
