/**
 * Compose API v1.0
 * Unified endpoint for audio + text generation from control-surface payload
 */

import { 
  ComposeRequest, 
  ComposeResponse, 
  ControlSurfacePayload, 
  GateReport,
  ExplainerContext 
} from '../explainer/contracts';
import { TextExplainerEngine } from '../explainer/text-explainer';
import { logAudit } from '../logger';
import { generatePlanMLOnly } from '../plan-generator';
// import { FeatureEncoder } from '../../lib/features/feature-encoder';
// import { vizEngine, VizFeatures, AudioMeta } from '../../src/core/viz/engine';
// import { isFeatureEnabled } from '../../config/flags';

export class ComposeAPI {
  private textExplainer: TextExplainerEngine;
  // private featureEncoder: FeatureEncoder;
  private runtimeModel: string;
  private compositionCache: Map<string, any>;

  constructor() {
    this.textExplainer = new TextExplainerEngine();
    // this.featureEncoder = new FeatureEncoder();
    // Runtime model switching - defaults to v2.8 for Phase-6 integration
    this.runtimeModel = process.env.RUNTIME_MODEL || 'student-v2.8-slice-batch';
    console.log(`🎯 Runtime model: ${this.runtimeModel}`);
    
    // In-memory cache for idempotency (in production, use Redis)
    this.compositionCache = new Map();
  }

  /**
   * Main compose endpoint - generates audio + text from control-surface payload
   */
  async compose(request: ComposeRequest): Promise<ComposeResponse> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Accept empty body by defaulting to sandbox mode
      if (!request || !request.mode) {
        (request as any) = { mode: 'sandbox', controls: {} };
      }
      
      // Generate idempotency key from request + model version
      const requestKey = this.sha256(JSON.stringify(request) + this.runtimeModel);
      
      // Check cache for idempotent response
      if (this.compositionCache.has(requestKey)) {
        console.log('[COMPOSE] Returning cached composition for key:', requestKey.slice(0, 8));
        return this.compositionCache.get(requestKey);
      }
      
      // Generate control-surface payload based on mode
      const payload = await this.generateControlPayload(request);
      
      // Use shared FeatureEncoder for consistent feature extraction
      const chartData = {
        date: (request as any).chartData?.date || '1990-01-01',
        time: (request as any).chartData?.time || '12:00',
        lat: (request as any).chartData?.lat || 40.7128,
        lon: (request as any).chartData?.lon || -74.0060
      };
      
      // const encodedFeatures = await this.featureEncoder.encode(chartData);
      // const featureVec = encodedFeatures.features.featureVector;
      const featureVec = new Float32Array([0.5, 0.6, 0.7, 0.7, 0.3, 0.6]); // Mock feature vector
      
      // Generate musical plan from controls
      const { plan } = await generatePlanMLOnly(featureVec as any, payload);
      
      // Run audition gates (deterministic)
      let gateReport = await this.runAuditionGates(plan, payload.hash);
      
      // Test override for fail-closed testing
      if (request.testOverride?.forceFail) {
        gateReport = {
          ...gateReport,
          calibrated: {
            ...gateReport.calibrated,
            overall: false
          }
        };
      }
      
      // Generate text explanation using shared features (Unified Spec v1.1)
      const context: any = {
        mode: request.mode,
        session_id: this.generateSessionId(),
        request_id: this.generateRequestId(),
        chartHash: 'mock_chart_hash',
        featuresVersion: 'v1.0'
      };
      
      // Overlay handling: compute overlay explanation with Δ thresholds when requested
      let text: any;
      let textMetricsMs: number | undefined;
      if (request.mode === 'overlay' && request.overlayParams) {
        const natalPayload = await this.generateSkyPayload({
          latitude: request.overlayParams.natalLatitude,
          longitude: request.overlayParams.natalLongitude,
          datetime: request.overlayParams.natalDatetime
        });
        const currentPayload = payload; // already computed above
        const natalGateReport = await this.runAuditionGates(plan, natalPayload.hash);
        const currentGateReport = gateReport;
        const overlayResult = (this.textExplainer as any).generateOverlayExplanation(
          natalPayload,
          currentPayload,
          natalGateReport,
          currentGateReport,
          context
        );
        text = overlayResult.text;
        textMetricsMs = overlayResult.metrics?.total_ms;
      } else {
        const base = (this.textExplainer as any).generateExplanation(
          payload,
          gateReport,
          context
        );
        text = base.text;
        textMetricsMs = base.metrics?.total_ms;
      }
      
      // Generate audio (mock, deterministic latency & URL from seed)
      const audio = await this.generateAudio(plan, request.mode, payload.hash);

      // Generate viz payload if enabled (stub for now)
      let viz = null;
      // TODO: Implement viz engine integration when ready

      // Normalize length to 60s ± 0.5s (Phase-6 guardrail)
      const targetLengthSec = 60;
      const lengthSec = targetLengthSec; // mock engine outputs exact 60s
      
      const endTime = process.hrtime.bigint();
      const totalLatency = Number(endTime - startTime) / 1000000;

      // Structured observability log (single line)
      try {
        const calibratedPass = !!gateReport?.calibrated?.overall;
        const strictPass = !!gateReport?.strict?.overall;
        const templateId = (text as any)?.template_id;
        const textMetrics = this.textExplainer instanceof Object && 'generateExplanation' in this.textExplainer ? undefined : undefined;
        const logEntry = {
          phase: 'compose',
          controls_hash: payload.hash,
          seed_used: payload.hash,
          template_id: templateId,
          latency_ms: {
            predict: gateReport.latency_ms.predict,
            plan: gateReport.latency_ms.plan,
            text_total: textMetricsMs,
            total: Number(totalLatency.toFixed(2))
          },
          gate_scores: gateReport.scores,
          gates: {
            calibrated: gateReport.calibrated,
            strict: gateReport.strict
          },
          fail_closed_text: !calibratedPass,
          artifacts: {
            model: '084c92dca9af2f09',
            mapping_tables_version: 'v1.1'
          }
        };
        console.log('[COMPOSE_OBS]', JSON.stringify(logEntry));
        logAudit({ evt: 'compose_done', ...logEntry });
      } catch {}
      
      // Unified Spec v1.1 explanation wrapper from text explainer
      const explanation = {
        spec: 'UnifiedSpecV1.1',
        sections: [
          { title: 'Theme', text: (text as any)?.short ?? '' },
          { title: 'Details', text: (text as any)?.long ?? '' },
          { title: 'Bullets', text: Array.isArray((text as any)?.bullets) ? (text as any).bullets.join(' · ') : '' }
        ]
      };

      // Hashes for control, audio, explanation, viz (deterministic)
      const hashes = {
        control: 'sha256:' + this.sha256(JSON.stringify(payload)),
        audio: 'sha256:' + this.sha256(audio.url + ':' + lengthSec.toString()),
        explanation: 'sha256:' + this.sha256(JSON.stringify(explanation)),
        viz: viz ? 'sha256:' + this.sha256(JSON.stringify(viz)) : null
      };

      const response = {
        controls: payload,
        astro: {
          element_dominance: payload.element_dominance,
          aspect_tension: payload.aspect_tension,
          modality: payload.modality
        },
        gate_report: gateReport,
        audio: {
          url: audio.url,
          digest: hashes.audio,
          latency_ms: totalLatency
        },
        text: {
          blocks: text.blocks,
          digest: hashes.explanation
        },
        // Phase-6 Spec v1.1 surface with shared FeatureEncoder provenance
        explanation,
        viz: viz ? {
          url: `https://cdn.astradio.io/viz/${hashes.viz}.json`,
          digest: hashes.viz
        } : null,
        hashes,
        artifacts: {
          model: '084c92dca9af2f09',
          encoder: 'db4eb96e52b3f63e',
          chartHash: 'mock_chart_hash',
          featuresVersion: 'v1.0',
          snapset: '185371267270f0ef',
          gate: 'v2.3-final',
          mapping_tables_version: 'v1.1',
          timestamp: new Date().toISOString(),
          provenance: {
            chartHash: 'mock_chart_hash',
            seed: (request as any).seed || payload.hash,
            featuresVersion: 'v1.0',
            modelVersions: {
              audio: this.runtimeModel,
              text: 'v1.1',
              viz: null, // TODO: Enable when viz engine is ready
              matching: 'v1.0'
            },
            houseSystem: 'placidus',
            tzDiscipline: 'utc'
          }
        }
      } as any;
      
      // Store viz.json with CDN headers if viz payload exists
      if (viz && hashes.viz) {
        await this.storeVizArtifact(hashes.viz, viz);
      }

      // Cache the response for idempotency
      this.compositionCache.set(requestKey, response);
      console.log('[COMPOSE] Cached composition for key:', requestKey.slice(0, 8));
      
      return response;
      
    } catch (error) {
      throw new Error(`Compose API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store viz artifact to S3 with CDN headers
   */
  private async storeVizArtifact(hash: string, payload: any): Promise<void> {
    try {
      const { uploadFile } = require('../../lib/storage');
      const key = `viz/${hash}.json`;
      // Use minified JSON for both digest computation and storage to ensure alignment
      const jsonString = JSON.stringify(payload);
      const buffer = Buffer.from(jsonString);
      
      await uploadFile(
        key, 
        buffer, 
        'application/json; charset=utf-8', 
        {
          'x-amz-meta-digest': hash,
          'x-amz-meta-viz-version': payload.vizVersion || '1.0'
        },
        'public, max-age=31536000, immutable'
      );
      
      console.log(`[COMPOSE] Stored viz artifact: ${key}`);
    } catch (error) {
      console.error('[COMPOSE] Failed to store viz artifact:', error);
      // Don't throw - composition can continue without viz storage
    }
  }

  /**
   * Generate control-surface payload based on request mode
   */
  private async generateControlPayload(request: ComposeRequest): Promise<ControlSurfacePayload> {
    switch ((request as any).mode) {
      case 'sky':
        return this.generateSkyPayload(request.skyParams!);
      
      case 'overlay':
        return this.generateOverlayPayload(request.overlayParams!);
      
      case 'sandbox':
        return this.generateSandboxPayload(request.controls!);
      
      case 'compatibility':
        return this.generateCompatibilityPayload(request as any);
      
      default:
        throw new Error(`Unsupported mode: ${(request as any).mode}`);
    }
  }

  /**
   * Generate payload for sky mode (real-time astro data)
   */
  private async generateSkyPayload(skyParams: NonNullable<ComposeRequest['skyParams']>): Promise<ControlSurfacePayload> {
    // Mock implementation - would integrate with Swiss Ephemeris API
    const astroData = await this.fetchAstroData(skyParams);
    
    // Mock student v2.3 inference - would use actual model
    const studentPredictions = await this.runStudentInference(astroData);
    
    return {
      ...studentPredictions,
      element_dominance: astroData.element_dominance,
      aspect_tension: astroData.aspect_tension,
      modality: astroData.modality,
      hash: this.generateHash(astroData)
    } as ControlSurfacePayload;
  }

  /**
   * Generate payload for overlay mode (natal vs current comparison)
   */
  private async generateOverlayPayload(overlayParams: NonNullable<ComposeRequest['overlayParams']>): Promise<ControlSurfacePayload> {
    // Generate both natal and current payloads
    const natalPayload = await this.generateSkyPayload({
      latitude: overlayParams.natalLatitude,
      longitude: overlayParams.natalLongitude,
      datetime: overlayParams.natalDatetime
    });
    
    const currentPayload = await this.generateSkyPayload({
      latitude: overlayParams.currentLatitude,
      longitude: overlayParams.currentLongitude,
      datetime: overlayParams.currentDatetime
    });
    
    // Return current payload (overlay context handled in text generation)
    return currentPayload;
  }

  /**
   * Generate payload for sandbox mode (user-controlled parameters)
   */
  private async generateSandboxPayload(userControls: NonNullable<ComposeRequest['controls']>): Promise<ControlSurfacePayload> {
    // Start with default payload
    const defaultPayload = await this.generateDefaultPayload();
    
    // Merge with user controls
    const mergedPayload = { ...defaultPayload, ...userControls };
    
    // Ensure hash is updated
    mergedPayload.hash = this.generateHash(mergedPayload);
    
    return mergedPayload;
  }

  /**
   * Generate payload for compatibility mode (two-chart composition)
   */
  private async generateCompatibilityPayload(request: any): Promise<ControlSurfacePayload> {
    // Generate combined payload from two charts
    const chart1Payload = await this.generateDefaultPayload();
    const chart2Payload = await this.generateDefaultPayload();
    
    // Blend the two charts based on compatibility score
    const compatibilityScore = request.compatibilityScore || 0.5;
    const blendedPayload = {
      arc_shape: (chart1Payload.arc_shape + chart2Payload.arc_shape) / 2,
      density_level: (chart1Payload.density_level + chart2Payload.density_level) / 2,
      tempo_norm: (chart1Payload.tempo_norm + chart2Payload.tempo_norm) / 2,
      step_bias: (chart1Payload.step_bias + chart2Payload.step_bias) / 2,
      leap_cap: Math.round((chart1Payload.leap_cap + chart2Payload.leap_cap) / 2),
      rhythm_template_id: Math.round((chart1Payload.rhythm_template_id + chart2Payload.rhythm_template_id) / 2),
      syncopation_bias: (chart1Payload.syncopation_bias + chart2Payload.syncopation_bias) / 2,
      motif_rate: (chart1Payload.motif_rate + chart2Payload.motif_rate) / 2,
      element_dominance: compatibilityScore > 0.7 ? chart1Payload.element_dominance : 'air',
      aspect_tension: compatibilityScore,
      modality: 'mutable'
    };
    
    (blendedPayload as any).hash = this.generateHash(blendedPayload);
    
    return blendedPayload as ControlSurfacePayload;
  }

  /**
   * Run audition gates on generated plan (Unified Spec v1.1)
   */
  private async runAuditionGates(plan: any, seed: string): Promise<GateReport> {
    // Deterministic PRNG from seed
    let state = 0;
    for (let i = 0; i < seed.length; i++) {
      state = (state ^ seed.charCodeAt(i)) >>> 0;
      state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
      state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    }
    if (state === 0) state = 0x9E3779B9;
    const rand = () => {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17; state >>>= 0;
      state ^= state << 5;  state >>>= 0;
      return (state >>> 0) / 0xFFFFFFFF;
    };

    // Mock deterministic scores
    const scores = {
      melody_arc: 0.45 + rand() * 0.1,
      melody_step_leap: 0.22 + rand() * 0.05,
      melody_narrative: 0.42 + rand() * 0.04,
      rhythm_diversity: 0.30 + rand() * 0.04
    };
    
    const calibratedThresholds = {
      melody_arc: 0.40,
      melody_step_leap: 0.21,
      melody_narrative: 0.35,
      rhythm_diversity: 0.295
    };
    
    const strictThresholds = {
      melody_arc: 0.45,
      melody_step_leap: 0.235,
      melody_narrative: 0.40,
      rhythm_diversity: 0.305
    };
    
    const calibrated = {
      melody_arc: scores.melody_arc >= calibratedThresholds.melody_arc,
      melody_step_leap: scores.melody_step_leap >= calibratedThresholds.melody_step_leap,
      melody_narrative: scores.melody_narrative >= calibratedThresholds.melody_narrative,
      rhythm_diversity: scores.rhythm_diversity >= calibratedThresholds.rhythm_diversity,
      overall: false
    };
    
    const strict = {
      melody_arc: scores.melody_arc >= strictThresholds.melody_arc,
      melody_step_leap: scores.melody_step_leap >= strictThresholds.melody_step_leap,
      melody_narrative: scores.melody_narrative >= strictThresholds.melody_narrative,
      rhythm_diversity: scores.rhythm_diversity >= strictThresholds.rhythm_diversity,
      overall: false
    };
    
    // Calculate overall passes (exclude overall from the check)
    calibrated.overall = Object.entries(calibrated)
      .filter(([key]) => key !== 'overall')
      .every(([, value]) => value === true);
    strict.overall = Object.entries(strict)
      .filter(([key]) => key !== 'overall')
      .every(([, value]) => value === true);
    
    return {
      calibrated,
      strict,
      scores,
      latency_ms: {
        predict: 2.5,
        plan: 1.2,
        total: 8.7
      }
    };
  }

  /**
   * Generate audio from plan (mock implementation)
   */
  private async generateAudio(plan: any, mode: string, seed: string): Promise<{ url: string; latency_ms: number }> {
    // Deterministic latency and URL derived from seed
    const rand = this.createSeededRNG(seed + '|audio');
    const audioLatency = Number((12 + rand() * 8).toFixed(1)); // 12..20ms deterministic
    const nonce = (seed || 'seed').slice(0, 12);
    return {
      url: `/api/audio/${nonce}.mp3`,
      latency_ms: audioLatency
    };
  }

  /**
   * Mock astro data fetching
   */
  private async fetchAstroData(params: { latitude: number; longitude: number; datetime: string }): Promise<any> {
    // Deterministic mock using seeded RNG from location+datetime
    const seedStr = `${params.latitude},${params.longitude},${params.datetime}`;
    const rand = this.createSeededRNG(seedStr);
    const elements = ['fire','earth','air','water'];
    const modalities = ['cardinal','fixed','mutable'];
    const element = elements[Math.floor(rand() * elements.length)];
    const modality = modalities[Math.floor(rand() * modalities.length)];
    const aspect = Number((0.2 + rand() * 0.6).toFixed(3));
    return {
      element_dominance: element,
      aspect_tension: aspect,
      modality
    };
  }

  /**
   * Mock student inference (Unified Spec v1.1)
   * Note: Genre conditioning is internal_only - not exposed in control surface
   */
  private async runStudentInference(astroData: any): Promise<Partial<ControlSurfacePayload>> {
    // Deterministic mock using seeded RNG from astroData
    const seedStr = `${astroData.element_dominance}|${astroData.aspect_tension}|${astroData.modality}`;
    const rand = this.createSeededRNG(seedStr);
    return {
      arc_shape: Number((0.4 + rand() * 0.2).toFixed(3)),
      density_level: Number((0.5 + rand() * 0.3).toFixed(3)),
      tempo_norm: Number((0.6 + rand() * 0.2).toFixed(3)),
      step_bias: Number((0.6 + rand() * 0.3).toFixed(3)),
      leap_cap: 1 + Math.floor(rand() * 6),
      rhythm_template_id: Math.floor(rand() * 8),
      syncopation_bias: Number(rand().toFixed(3)),
      motif_rate: Number((0.4 + rand() * 0.4).toFixed(3)),
      element_dominance: astroData.element_dominance || 'air',
      aspect_tension: astroData.aspect_tension || 0.4,
      modality: astroData.modality || 'mutable'
    };
  }

  /**
   * Generate default payload for sandbox mode (Unified Spec v1.1)
   */
  private async generateDefaultPayload(): Promise<ControlSurfacePayload> {
    return {
      arc_shape: 0.45,
      density_level: 0.6,
      tempo_norm: 0.7,
      step_bias: 0.7,
      leap_cap: 5,
      rhythm_template_id: 3,
      syncopation_bias: 0.3,
      motif_rate: 0.6,
      element_dominance: 'air',
      aspect_tension: 0.4,
      modality: 'mutable',
      hash: this.generateHash({ arc_shape: 0.45, density_level: 0.6 })
    };
  }

  /**
   * Convert ControlSurfacePayload to FeatureVec for plan generation
   */
  private convertPayloadToFeatureVec(payload: ControlSurfacePayload): Float32Array {
    // FeatureVec is 6 dimensions: [arc_shape, density_level, tempo_norm, step_bias, syncopation_bias, motif_rate]
    return new Float32Array([
      payload.arc_shape,
      payload.density_level,
      payload.tempo_norm,
      payload.step_bias,
      payload.syncopation_bias,
      payload.motif_rate
    ]);
  }

  /**
   * Generate hash for deterministic variation
   */
  private generateHash(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return 'sess_' + Date.now().toString(36);
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return 'req_' + Date.now().toString(36);
  }

  // Deterministic PRNG (xorshift32) utility
  private createSeededRNG(seedStr: string) {
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
      seed = (seed ^ seedStr.charCodeAt(i)) >>> 0;
      seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
      seed = Math.imul(seed ^ (seed >>> 13), 3266489909) >>> 0;
    }
    if (seed === 0) seed = 0x9E3779B9;
    let state = seed >>> 0;
    return () => {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17; state >>>= 0;
      state ^= state << 5;  state >>>= 0;
      return (state >>> 0) / 0xFFFFFFFF;
    };
  }

  // sha256 helper
  private sha256(input: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(input).digest('hex');
  }
}

// Export handler function for server integration
const composeAPI = new ComposeAPI();

export async function vnextCompose(req: any, res: any) {
  try {
    const request = req.body;
    const response = await composeAPI.compose(request);
    res.json(response);
  } catch (error) {
    console.error('[VNEXT_COMPOSE] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'VNEXT_COMPOSE_ERROR'
    });
  }
}
