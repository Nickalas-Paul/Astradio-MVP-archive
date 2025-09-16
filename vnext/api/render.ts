// vnext/api/render.ts - Server-side audio rendering
import type { Request, Response } from 'express';
import { planToToneEvents, validatePlanForAudio, generateRenderMetadata } from '../scheduler';
import { logAudit } from '../logger';
import type { Plan } from '../contracts';

export async function vnextRender(req: Request, res: Response) {
  try {
    const { plan }: { plan: Plan } = req.body;
    
    if (!plan) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing plan in request body' 
      });
    }
    
    // Validate plan for audio rendering
    const validation = validatePlanForAudio(plan);
    if (!validation.valid) {
      logAudit({
        event: 'render_validation_failed',
        planId: plan.id,
        issues: validation.issues
      });
      
      return res.status(400).json({
        ok: false,
        error: 'Plan validation failed',
        issues: validation.issues
      });
    }
    
    // Convert plan to Tone.js events
    const audioEvents = planToToneEvents(plan);
    
    // Generate metadata for logging
    const metadata = generateRenderMetadata(plan, audioEvents);
    
    // Log render attempt
    logAudit({
      event: 'render_start',
      ...metadata
    });
    
    // For now, return the audio events and metadata
    // TODO: In Phase 8, integrate with actual audio synthesis
    const result = {
      ok: true,
      planId: plan.id,
      duration: plan.durationSec,
      eventCount: plan.events.length,
      channels: metadata.channels,
      audioEvents: audioEvents.slice(0, 10), // Return first 10 events as sample
      totalEvents: audioEvents.length,
      metadata
    };
    
    // Log successful render
    logAudit({
      event: 'render_success',
      planId: plan.id,
      duration: plan.durationSec,
      eventCount: plan.events.length,
      channels: metadata.channels.length
    });
    
    res.json(result);
    
  } catch (error: any) {
    console.error('vNext render error:', error);
    
    logAudit({
      event: 'render_error',
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      ok: false,
      error: 'Internal render error',
      message: error.message
    });
  }
}
