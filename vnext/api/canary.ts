// vnext/api/canary.ts
import type { Request, Response, NextFunction } from 'express';
import { vnextCompose } from './compose';

export async function canaryRouter(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if canary is enabled
    if (process.env.FF_VNEXT_CANARY !== 'true') {
      return next();
    }

    // Check for explicit header override
    if (req.headers['x-audition-engine'] === 'vnext') {
      console.log(`🎯 Canary: Header override -> routing to vNext`);
      return await vnextCompose(req, res);
    }

    // Check chart context and extract sun longitude
    const chartContext = req.body?.chartContext;
    if (!chartContext?.planets) {
      console.log(`🎯 Canary: No chartContext.planets -> routing to v1`);
      return next();
    }

    const sun = chartContext.planets.find((p: any) => p.name === 'sun');
    if (!sun?.lon && sun?.lon !== 0) {
      console.log(`🎯 Canary: No sun.lon -> routing to v1`);
      return next();
    }

    // Calculate sun sign (0-11) from longitude
    const sunSign = Math.floor((sun.lon % 360) / 30);
    
    // Get canary percentage (default 10%)
    const canaryPercent = parseInt(process.env.CANARY_PERCENT || '10', 10);
    
    // Determine if this request should be canaried
    const shouldCanary = (sunSign % 10) < (canaryPercent / 10);
    
    if (shouldCanary) {
      console.log(`🎯 Canary: Sun sign ${sunSign} (${canaryPercent}%) -> routing to vNext`);
      return await vnextCompose(req, res);
    } else {
      console.log(`🎯 Canary: Sun sign ${sunSign} (${canaryPercent}%) -> routing to v1`);
      return next();
    }

  } catch (error) {
    console.error('🎯 Canary: Error in routing decision:', error);
    // On error, default to v1 (safe fallback)
    return next();
  }
}
