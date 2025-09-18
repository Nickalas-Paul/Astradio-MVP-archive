import type { Request, Response } from "express";
import { encodeFeatures } from "../feature-encode";
import { generatePlanMLOnly } from "../plan-generator";

export async function vnextCompose(req: Request, res: Response) {
  // Debug logging for request shape and environment
  console.info('[COMPOSE]', {
    hasChart: !!req.body?.chartContext,
    strict: process.env.STRICT_ML,
    allowHttp: process.env.ALLOW_HTTP_MODEL,
    minQuality: process.env.MIN_RULE_QUALITY
  });

  try {
    // Validate input
    const snapshot = req.body?.chartContext;
    if (!snapshot) {
      return res.status(400).json({ 
        ok: false, 
        code: "BAD_INPUT",
        error: "Missing chartContext" 
      });
    }

    const feat = encodeFeatures(snapshot);
    const { plan, source, diag } = await generatePlanMLOnly(feat, snapshot);
    
    // Check quality gates - return 422 for quality failures
    const quality = (plan as any).__quality;
    if (quality && quality.overall < 0.5) {
      return res.status(422).json({
        ok: false,
        code: "QUALITY_FAIL",
        details: {
          scores: quality,
          reason: "Composition did not meet quality thresholds"
        }
      });
    }

    res.json({ 
      ok: true, 
      source, 
      plan, 
      quality, 
      diag,
      modelVersion: diag?.modelVersion || 'v1',
      canaryInfo: diag?.canaryInfo || 'baseline'
    });
  } catch (e: any) {
    // Log the full error for debugging
    console.error('[COMPOSE] Unexpected error:', e);
    
    // Check if this is a known quality/gate failure
    if (e.message?.includes('quality') || e.message?.includes('gate')) {
      return res.status(422).json({ 
        ok: false, 
        code: "QUALITY_FAIL",
        error: e.message,
        details: { originalError: e.message }
      });
    }
    
    // True server error
    res.status(500).json({ 
      ok: false, 
      code: "INTERNAL_ERROR",
      error: e.message || "vNext compose failed" 
    });
  }
}
