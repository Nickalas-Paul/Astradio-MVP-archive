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
import { astroSummaryFromSnapshot } from '../explainer/astro-summary-from-snapshot';
import { logAudit } from '../logger';
import { generatePlanMLOnly } from '../plan-generator';
import { generateArchitecture, generateArchitectureFromSnapshot, fetchChartSnapshot, type ChartInput } from '../core/architecture-engine';
import { computePlanHash } from '../plan-hash';
import { planToMidiBase64 } from '../midi/plan-to-midi';
import type { EphemerisSnapshot, FeatureVec, Plan } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { buildExplainSpecSingle, buildExplainSpecOverlay } from '../explainer/text-generation-engine';
import { renderExplainSpecToSections } from '../explainer/renderers/deterministic';
import { guidanceSummaryFromFeatureVec } from '../explainer/guidance-atoms';
import { buildPlanSummary } from '../explainer/plan-summary';
import { DEFAULT_DURATION_S } from '../constants';
import { renderWithProvider, buildLyriaPrompt, getProvider, localWavProvider, isProductionOrPreview } from '../render';
import {
  computeExportKey,
  hashPrompt,
  getCachedWav,
  writeExport,
  readIntegrity,
  type IntegrityMeta,
} from '../render/export-cache';
import { buildTextAnalysis } from '../text/analysis/buildTextAnalysis';
import { renderDaily } from '../text/renderers/daily';
import { loadDailyToneSpec } from '../text';
import type { ChartTextInput } from '../text/contracts';
import { buildRelationalChartContext } from '../report-context';
import { buildCompositionNarrativePlan } from '../audio/composition-narrative';
import { applyEndingPolish } from '../audio/ending-polish';
import type { ChartSemanticProfile } from '../interpretation/chart-semantic-profile';
import type { CanonicalCompositionInput } from './canonical-compose-input';
import { buildHomeCanonicalInput } from '../adapters/home-compose-adapter';
import { buildProfileNatalCanonicalInput } from '../adapters/profile-natal-compose-adapter';
import { buildSandboxCanonicalInput } from '../adapters/sandbox-compose-adapter';
import { buildOverlayCanonicalInput } from '../adapters/overlay-compose-adapter';

/** Daily v1 section shape (id, title, text). Reusable for Profile/Community later. */
type DailySection = { id: string; title: string; text: string };

/** Map daily v1 sections to response section shape. Reusable for Profile/Community. */
function mapDailySectionsToResponseSections(
  dailySections: DailySection[]
): Array<{ sectionId: string; title: string; text?: string; bullets?: string[] }> {
  return dailySections.map((s) => ({ sectionId: s.id, title: s.title, text: s.text, bullets: undefined }));
}

/** Derive legacy text fields from daily sections for response.text compatibility. Reusable for Profile/Community. */
function legacyTextFromDailySections(dailySections: DailySection[]): {
  short: string;
  long: string;
  bullets: string[];
  template_id: string;
  signatures: string;
  significance: string;
  musicalParagraph: string;
  musicalBullets: string[];
} {
  const first = dailySections[0]?.text ?? '';
  const allLong = dailySections.map((s) => s.text).filter(Boolean).join('\n\n');
  const musicSection = dailySections.find((s) => s.id === 'music_translation');
  return {
    short: first,
    long: allLong,
    bullets: [],
    template_id: 'daily-v1',
    signatures: first,
    significance: dailySections.length > 1 ? (dailySections[1].text ?? first) : first,
    musicalParagraph: musicSection?.text ?? '',
    musicalBullets: [],
  };
}

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
      
      // Check cache for idempotent response, but never reuse cached exports that failed.
      if (this.compositionCache.has(requestKey)) {
        const cached = this.compositionCache.get(requestKey);
        const cachedAudio = cached && cached.audio;
        if (
          cachedAudio &&
          cachedAudio.export_enabled === true &&
          cachedAudio.export_attempted === true &&
          cachedAudio.export_error != null
        ) {
          console.log(
            '[COMPOSE] Ignoring cached failed export for key:',
            requestKey.slice(0, 8),
            'export_error=',
            cachedAudio.export_error
          );
        } else {
          console.log('[COMPOSE] Returning cached composition for key:', requestKey.slice(0, 8));
          return cached;
        }
      }
      
      const canonicalInput = await this.buildCanonicalInputFromRequest(request);
      const payload = canonicalInput.payload;
      const requestSeed = canonicalInput.seed || payload.hash;
      const enableDailyV1Text = canonicalInput.enableDailyV1Text === true;
      const hasOverlayContext = !!canonicalInput.overlayNatalSnapshot;

      let architecture: Awaited<ReturnType<typeof generateArchitecture>>;
      architecture = await this.runSharedComposePipeline(() =>
        generateArchitectureFromSnapshot(canonicalInput.snapshot, requestSeed)
      );
      const { snapshot, features: featureVec, guidance, semanticProfile } = architecture;

      // Compute provenance hashes
      const snapshot_sha256 = this.hashSnapshot(snapshot);
      const featurevec_sha256 = this.hashFeatureVec(featureVec);

      // Pass architecture output to plan generator (features + payload with guidance context)
      // Note: generatePlanMLOnly will use guidance internally, but we pass payload for compatibility
      const { plan, diag } = await generatePlanMLOnly(featureVec, {
        ...payload,
        // Ensure plan-generator can access snapshot for guidance computation
        ts: snapshot.ts,
        tz: snapshot.tz,
        lat: snapshot.lat,
        lon: snapshot.lon,
        houseSystem: snapshot.houseSystem,
        planets: snapshot.planets,
        houses: snapshot.houses,
        aspects: snapshot.aspects,
        moonPhase: snapshot.moonPhase,
        dominantElements: snapshot.dominantElements
      });
      
      // Compute v6 hash from diag
      const v6_sha256 = diag?.v6 ? this.hashV6(diag.v6) : '';

      const mlUsed = !!diag?.ml_used;
      const mlLog = {
        tf_backend: diag?.tf_backend ?? 'unknown',
        model_version: diag?.modelVersion ?? 'unknown',
        model_sha: diag?.model_sha ?? 'unknown',
        inference_ms: typeof diag?.inference_ms === 'number' ? diag.inference_ms : 0,
        ml_used: mlUsed,
      };
      console.log('[COMPOSE_ML]', JSON.stringify(mlLog));

      if (!mlUsed) {
        const err = new Error('ML inference unavailable; cannot serve controls or audio') as Error & { code?: string };
        err.code = 'ML_INFERENCE_UNAVAILABLE';
        throw err;
      }

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
      
      // Generate text explanation using new ExplainSpec engine (Text Generation Engine v1.0)
      // Use architecture output (already computed)
      const guidanceSummary = guidanceSummaryFromFeatureVec(featureVec);
      const planSummary = buildPlanSummary(plan);
      
      // Build ExplainSpec from canonical pipeline inputs (using architecture output)
      const spec = buildExplainSpecSingle({
        seed: payload.hash,
        snapshot: architecture.snapshot,
        featureVec: architecture.features,
        guidanceSummary,
        plan,
        planSummary,
        gateReport
      });
      
      // Render ExplainSpec to sections
      const rendered = renderExplainSpecToSections(spec);

      // Optional vNext text engine (Phase 1, daily only, behind VNEXT_TEXT_ENGINE)
      const useTextEngineVnext = process.env.VNEXT_TEXT_ENGINE === 'v1';
      let textVnextDaily: any = undefined;
      let textEngineFailureStage: string | undefined;
      let textEngineFailureName: string | undefined;
      let textEngineFailureMessage: string | undefined;
      if (useTextEngineVnext && enableDailyV1Text) {
        console.log('[COMPOSE_TEXT] daily-v1 branch entered', JSON.stringify({ VNEXT_TEXT_ENGINE: process.env.VNEXT_TEXT_ENGINE ?? '(unset)', request_mode: request.mode }));
        try {
          const snapshot = architecture.snapshot;
          let chartInput: ChartTextInput;
          try {
            chartInput = {
              snapshot,
              relationalContext: buildRelationalChartContext(snapshot),
              surface: 'daily',
              algoVersion: 'vnext-text-1',
              toneVersion: 'daily.personality.v1',
              hasHouses: Array.isArray(snapshot.houses) && snapshot.houses.length >= 12,
              hasAspects: Array.isArray(snapshot.aspects) && snapshot.aspects.length > 0,
              hasNatalContext: false,
              missing: [
                { kind: 'no_natal_context' }
              ]
            };
          } catch (e: any) {
            textEngineFailureStage = 'buildRelationalChartContext';
            textEngineFailureName = e?.name ?? 'Error';
            textEngineFailureMessage = typeof e?.message === 'string' ? e.message.slice(0, 200) : String(e).slice(0, 200);
            console.warn('[COMPOSE_TEXT] daily-v1 failed', JSON.stringify({ stage: textEngineFailureStage, name: textEngineFailureName, message: textEngineFailureMessage }));
            throw e;
          }
          let analysis: any;
          try {
            analysis = buildTextAnalysis('daily', chartInput, semanticProfile as ChartSemanticProfile);
          } catch (e: any) {
            textEngineFailureStage = 'buildTextAnalysis';
            textEngineFailureName = e?.name ?? 'Error';
            textEngineFailureMessage = typeof e?.message === 'string' ? e.message.slice(0, 200) : String(e).slice(0, 200);
            console.warn('[COMPOSE_TEXT] daily-v1 failed', JSON.stringify({ stage: textEngineFailureStage, name: textEngineFailureName, message: textEngineFailureMessage }));
            throw e;
          }
          let toneSpec;
          try {
            toneSpec = loadDailyToneSpec();
          } catch (e: any) {
            textEngineFailureStage = 'loadDailyToneSpec';
            textEngineFailureName = e?.name ?? 'Error';
            textEngineFailureMessage = typeof e?.message === 'string' ? e.message.slice(0, 200) : String(e).slice(0, 200);
            console.warn('[COMPOSE_TEXT] daily-v1 failed', JSON.stringify({ stage: textEngineFailureStage, name: textEngineFailureName, message: textEngineFailureMessage }));
            throw e;
          }
          try {
            const daily = renderDaily(analysis, toneSpec);
            textVnextDaily = {
              surface: daily.surface,
              hasNatalContext: daily.hasNatalContext,
              confidence: daily.confidence,
              sections: daily.sections
            };
            console.log('[COMPOSE_TEXT] daily-v1 success', JSON.stringify({ sectionCount: daily.sections?.length ?? 0 }));
          } catch (e: any) {
            textEngineFailureStage = 'renderDaily';
            textEngineFailureName = e?.name ?? 'Error';
            textEngineFailureMessage = typeof e?.message === 'string' ? e.message.slice(0, 200) : String(e).slice(0, 200);
            console.warn('[COMPOSE_TEXT] daily-v1 failed', JSON.stringify({ stage: textEngineFailureStage, name: textEngineFailureName, message: textEngineFailureMessage }));
            throw e;
          }
        } catch {
          // Fail closed: never disturb existing behavior if vNext text path errors.
        }
      }
      
      // Legacy text explainer (fallback for overlay mode and backward compatibility)
      const astro = astroSummaryFromSnapshot(architecture.snapshot, architecture.features, payload.modality);
      const context: any = {
        mode: request.mode,
        session_id: this.generateSessionId(),
        request_id: this.generateRequestId(),
        chartHash: snapshot_sha256,
        featuresVersion: 'v1.0'
      };
      const explainerInputs = { astro, featureVec: architecture.features, plan };

      let text: any;
      let textMetricsMs: number | undefined;
      if (hasOverlayContext && request.overlayParams) {
        const useOverlayExplainSpec = process.env.VNEXT_OVERLAY_EXPLAINSPEC === '1';
        if (useOverlayExplainSpec) {
          const natalSnapshot = canonicalInput.overlayNatalSnapshot;
          if (!natalSnapshot) {
            throw new Error('Overlay mode requires natal snapshot context.');
          }
          const natalFeatureVec = encodeFeatures(natalSnapshot) as FeatureVec;
          const overlaySpec = buildExplainSpecOverlay({
            seed: payload.hash,
            natalSnapshot,
            natalFeatureVec,
            currentSnapshot: architecture.snapshot,
            currentFeatureVec: architecture.features,
            plan,
            gateReport,
          });
          const overlayRendered = renderExplainSpecToSections(overlaySpec);
          text = {
            short: overlayRendered.sections.find(s => s.id === 'signatures')?.text ?? '',
            long: overlayRendered.sections.find(s => s.id === 'significance')?.text ?? '',
            bullets: overlayRendered.sections.find(s => s.id === 'musical')?.bullets ?? [],
            template_id: 'explainspec-overlay-v1',
            signatures: overlayRendered.sections.find(s => s.id === 'signatures')?.text ?? '',
            significance: overlayRendered.sections.find(s => s.id === 'significance')?.text ?? '',
            musicalParagraph: overlayRendered.sections.find(s => s.id === 'musical')?.text ?? '',
            musicalBullets: overlayRendered.sections.find(s => s.id === 'musical')?.bullets ?? [],
          };
          textMetricsMs = 0;
        } else {
          const natalPayload = await this.generateSkyPayload({
            latitude: request.overlayParams.natalLatitude,
            longitude: request.overlayParams.natalLongitude,
            datetime: request.overlayParams.natalDatetime
          });
          const currentPayload = payload;
          const natalGateReport = await this.runAuditionGates(plan, natalPayload.hash);
          const currentGateReport = gateReport;
          const overlayResult = (this.textExplainer as any).generateOverlayExplanation(
            natalPayload,
            currentPayload,
            natalGateReport,
            currentGateReport,
            context,
            explainerInputs
          );
          text = overlayResult.text;
          textMetricsMs = overlayResult.metrics?.total_ms;
        }
      } else {
        // Single mode: use daily v1 when enabled and available; otherwise ExplainSpec
        if (textVnextDaily?.sections?.length > 0) {
          text = legacyTextFromDailySections(textVnextDaily.sections as DailySection[]);
        } else {
          // ExplainSpec path: build legacy text format for backward compatibility
          const signaturesText = rendered.sections.find(s => s.id === 'signatures')?.text || '';
          const significanceText = rendered.sections.find(s => s.id === 'significance')?.text || '';
          const musicalSection = rendered.sections.find(s => s.id === 'musical');
          const musicalText = musicalSection?.text || '';
          const musicalBullets = musicalSection?.bullets || [];

          const hasAnyContent =
            !!signaturesText.trim() ||
            !!significanceText.trim() ||
            !!musicalText.trim();

          if (!hasAnyContent) {
            const fallbackMessage = 'Explanation unavailable for this composition (ExplainSpec returned empty content).';
            text = {
              short: fallbackMessage,
              long: fallbackMessage,
              bullets: [],
              template_id: 'explainspec-empty-v1',
              signatures: '',
              significance: '',
              musicalParagraph: '',
              musicalBullets: []
            };
          } else {
            text = {
              short: signaturesText,
              long: significanceText + (musicalText ? '\n\n' + musicalText : ''),
              bullets: musicalBullets,
              template_id: 'explainspec-v1',
              signatures: signaturesText,
              significance: significanceText,
              musicalParagraph: musicalText,
              musicalBullets: musicalBullets
            };
          }
        }
        textMetricsMs = 0; // ExplainSpec/daily generation is fast (no ML)
      }
      
      // Generate audio: cache-first, then RenderProvider. Production/preview: Lyria-only; no local_wav fallback.
      const wavExportEnabled = process.env.ENABLE_WAV_EXPORT === '1';
      const stubAudio = {
        format: 'wav' as const,
        base64: '',
        sha256: '',
        latency_ms: 0,
        size_bytes: 0
      };
      let audio: typeof stubAudio & { base64: string; sha256: string; latency_ms: number; size_bytes: number } = { ...stubAudio };
      let audio_export_available = false;
      let export_id: string | undefined;
      let export_meta: { provider: string; modelVersion: string; promptHash: string; payload_hash: string; duration_s: number; sha256: string } | undefined;

      // Export gating signals (always present in response; no secrets)
      type ExportErrorCode = 'export_disabled' | 'export_not_attempted' | 'storage_unavailable' | 'render_failed' | 'provider_not_configured' | 'invalid_duration';
      let export_attempted = false;
      let export_error: ExportErrorCode | null = wavExportEnabled ? null : 'export_disabled';

      const store = (process as any).__astradio_export_store as { get?: (k: string) => Promise<Buffer | null>; put?: (k: string, buf: Buffer, meta: IntegrityMeta) => Promise<void> } | undefined;

      let audioDebug: any = undefined;
      type ExportStep = 'provider' | 'render' | 'store';
      let exportStep: ExportStep = 'provider';
      if (wavExportEnabled) {
        export_attempted = true;
        console.log('[COMPOSE_EXPORT] wavExportEnabled=', wavExportEnabled);
        let prompt = '';
        let promptHash = '';
        let lyriaSeed = '';
        try {
          const planHash = computePlanHash(plan);
          const narrativePlan = buildCompositionNarrativePlan(
            architecture,
            featureVec,
            payload,
            plan,
            architecture.semanticProfile as ChartSemanticProfile
          );
          prompt = buildLyriaPrompt(payload, plan, narrativePlan);
          promptHash = hashPrompt(prompt);
          lyriaSeed = planHash + ':phase3';
          exportStep = 'provider';
          const provider = getProvider();
          console.log('[COMPOSE_EXPORT] provider=', provider.name);
          const modelVersion = provider.name === 'lyria' ? 'lyria-002' : 'local-v1';
          const exportKey = computeExportKey(payload.hash, provider.name, modelVersion, promptHash, DEFAULT_DURATION_S);

          let cached: Buffer | null = null;
          if (store?.get) {
            cached = await store.get(exportKey);
          }
          if (!cached && (!store || !store.get)) {
            cached = getCachedWav(exportKey);
          }
          const audioStartTime = process.hrtime.bigint();
          if (cached && cached.length > 0) {
            const integrity = readIntegrity(exportKey);
            const sha256 = integrity?.sha256 ?? require('crypto').createHash('sha256').update(cached).digest('hex');
            audio = {
              format: 'wav',
              base64: cached.toString('base64'),
              sha256,
              latency_ms: 0,
              size_bytes: cached.length
            };
            export_id = exportKey;
            export_meta = integrity ? { provider: integrity.provider, modelVersion: integrity.modelVersion, promptHash: integrity.promptHash, payload_hash: integrity.payload_hash, duration_s: integrity.duration_s, sha256: integrity.sha256 } : undefined;
            audio_export_available = true;
            console.log('[COMPOSE_EXPORT] cache_hit exportKey=', exportKey.slice(0, 16) + '...');
          } else {
            exportStep = 'render';
            const result = await renderWithProvider({
              prompt,
              seed: lyriaSeed,
              duration_s: DEFAULT_DURATION_S,
              plan,
              payload
            });
            let wavToStore = result.wavBuffer;
            let sha256ToUse = result.sha256;
            let sizeBytesToUse = result.size_bytes;
            const providerName = (result.provider_meta.provider as string) || '';
            if (providerName === 'lyria') {
              const polishResult = applyEndingPolish(wavToStore, {
                tailWindowSeconds: 2.5,
                endingStyle: narrativePlan.endingStyle,
              });
              if (polishResult.applied) {
                wavToStore = polishResult.buffer;
                sha256ToUse = require('crypto').createHash('sha256').update(wavToStore).digest('hex');
                sizeBytesToUse = wavToStore.length;
                try {
                  console.log(
                    '[ENDING_POLISH]',
                    JSON.stringify({
                      applied: true,
                      tailWindowSeconds: polishResult.tailWindowSeconds,
                      endingStyleUsed: polishResult.endingStyleUsed ?? null,
                    })
                  );
                } catch {
                  // logging must not break export
                }
              }
            }
            const durationCheck = this.validateRenderedWavDuration(wavToStore, DEFAULT_DURATION_S);
            if (!durationCheck.valid) {
              export_error = 'invalid_duration';
              audio_export_available = false;
              audioDebug = {
                export_failure: 'B',
                step: 'render',
                message: `Rendered WAV duration out of bounds: ${durationCheck.durationSec.toFixed(3)}s`,
                code: 'INVALID_WAV_DURATION',
              };
              throw new Error(`Invalid WAV duration (${durationCheck.durationSec.toFixed(3)}s)`);
            }
            const integrity: IntegrityMeta = {
              sha256: sha256ToUse,
              size_bytes: sizeBytesToUse,
              createdAt: new Date().toISOString(),
              payload_hash: payload.hash,
              promptHash,
              provider: result.provider_meta.provider as string,
              modelVersion: (result.provider_meta.modelVersion as string) ?? modelVersion,
              duration_s: DEFAULT_DURATION_S
            };
            export_meta = { provider: integrity.provider, modelVersion: integrity.modelVersion, promptHash: integrity.promptHash, payload_hash: integrity.payload_hash, duration_s: integrity.duration_s, sha256: integrity.sha256 };
            audio = {
              format: 'wav',
              base64: wavToStore.toString('base64'),
              sha256: sha256ToUse,
              latency_ms: Number((process.hrtime.bigint() - audioStartTime) / BigInt(1_000_000)),
              size_bytes: sizeBytesToUse
            };
            export_id = exportKey;
            audio_export_available = true;
            exportStep = 'store';
            try {
              if (store?.put) {
                await store.put(exportKey, wavToStore, integrity);
                console.log('[COMPOSE_EXPORT] store_put_ok exportKey=', exportKey.slice(0, 16) + '...');
              } else {
                writeExport(exportKey, wavToStore, integrity);
                console.log('[COMPOSE_EXPORT] writeExport_ok exportKey=', exportKey.slice(0, 16) + '...');
              }
            } catch (storeErr) {
              console.warn('[COMPOSE_EXPORT] store/write failed (returning inline audio):', storeErr instanceof Error ? storeErr.message : String(storeErr));
            }
          }
        } catch (audioError) {
          const err = audioError instanceof Error ? audioError : new Error(String(audioError));
          const code = (err as Error & { code?: string }).code;
          console.log('[COMPOSE_EXPORT] error step=', exportStep, 'message=', err.message, code ? 'code=' + code : '');
          const primaryProvider = getProvider().name;
          const allowFallback =
            !isProductionOrPreview() &&
            process.env.ALLOW_LYRIA_FALLBACK === '1' &&
            primaryProvider === 'lyria' &&
            (exportStep === 'provider' || exportStep === 'render');
          let fallbackSucceeded = false;
          if (allowFallback) {
            try {
              const fallbackResult = await localWavProvider.render({
                prompt,
                seed: lyriaSeed,
                duration_s: DEFAULT_DURATION_S,
                plan,
                payload
              });
              const fallbackExportKey = computeExportKey(payload.hash, 'local_wav', 'local-v1', promptHash, DEFAULT_DURATION_S);
              exportStep = 'store';
              if (store?.put) {
                const fallbackIntegrity: IntegrityMeta = {
                  sha256: fallbackResult.sha256,
                  size_bytes: fallbackResult.size_bytes,
                  createdAt: new Date().toISOString(),
                  payload_hash: payload.hash,
                  promptHash,
                  provider: 'local_wav',
                  modelVersion: 'local-v1',
                  duration_s: DEFAULT_DURATION_S
                };
                await store.put(fallbackExportKey, fallbackResult.wavBuffer, fallbackIntegrity);
              } else {
                writeExport(fallbackExportKey, fallbackResult.wavBuffer, {
                  sha256: fallbackResult.sha256,
                  size_bytes: fallbackResult.size_bytes,
                  createdAt: new Date().toISOString(),
                  payload_hash: payload.hash,
                  promptHash,
                  provider: 'local_wav',
                  modelVersion: 'local-v1',
                  duration_s: DEFAULT_DURATION_S
                });
              }
              const audioStartTime = process.hrtime.bigint();
              audio = {
                format: 'wav',
                base64: fallbackResult.wavBuffer.toString('base64'),
                sha256: fallbackResult.sha256,
                latency_ms: Number((process.hrtime.bigint() - audioStartTime) / BigInt(1_000_000)),
                size_bytes: fallbackResult.size_bytes
              };
              export_id = fallbackExportKey;
              export_meta = { provider: 'local_wav', modelVersion: 'local-v1', promptHash, payload_hash: payload.hash, duration_s: DEFAULT_DURATION_S, sha256: fallbackResult.sha256 };
              export_error = null;
              audio_export_available = true;
              fallbackSucceeded = true;
              console.log('[COMPOSE_EXPORT] dev-only fallback local_wav exportKey=', fallbackExportKey.slice(0, 16) + '...');
            } catch (fallbackErr) {
              console.log('[COMPOSE_EXPORT] local_wav fallback failed:', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
            }
          }
          if (!fallbackSucceeded) {
            if (export_error == null) {
              if (exportStep === 'provider') export_error = 'provider_not_configured';
              else if (exportStep === 'render') export_error = 'render_failed';
              else export_error = 'storage_unavailable';
            }
            const failureClass = exportStep === 'store' ? 'C' : 'B';
            audioDebug = { export_failure: failureClass, step: exportStep, message: err.message, ...(code && { code }) };
            if (!(global as any).__wav_export_unavailable_logged) {
              console.warn('[COMPOSE] Render unavailable:', err.message, code ? `code=${code}` : '');
              if (process.env.DEBUG_WAV === '1' && err.stack) console.warn('[COMPOSE] Render stack:', err.stack);
              (global as any).__wav_export_unavailable_logged = true;
            }
          }
        }
      } else {
        console.log('[COMPOSE_EXPORT] wavExportEnabled=false, ENABLE_WAV_EXPORT=', process.env.ENABLE_WAV_EXPORT);
        audioDebug = { export_failure: 'A', message: 'wavExportEnabled is false' };
        if (!(global as any).__wav_export_unavailable_logged) {
          console.warn('[COMPOSE] WAV export disabled (set ENABLE_WAV_EXPORT=1 to enable)');
          (global as any).__wav_export_unavailable_logged = true;
        }
      }

      const targetLengthSec = DEFAULT_DURATION_S;
      
      const endTime = process.hrtime.bigint();
      const totalLatency = Number(endTime - startTime) / 1000000;

      // Unified Spec v1.1: structured sections from ExplainSpec (or legacy fallback)
      const t = text as any;
      let sections: Array<{ sectionId: string; title: string; text?: string; bullets?: string[] }>;
      
      if (hasOverlayContext && request.overlayParams) {
        if (process.env.VNEXT_OVERLAY_EXPLAINSPEC === '1' && (text as any)?.template_id === 'explainspec-overlay-v1') {
          sections = [
            { sectionId: 'signatures', title: 'Natal Signatures', text: t.signatures ?? '' },
            { sectionId: 'significance', title: 'Transit vs Natal', text: t.significance ?? '' },
            { sectionId: 'musical', title: 'Musical Relationship', text: t.musicalParagraph ?? '', bullets: Array.isArray(t.musicalBullets) ? t.musicalBullets : undefined }
          ];
        } else {
          const hasStructured = t?.signatures != null && t?.significance != null;
          sections = hasStructured
            ? [
                { sectionId: 'signatures', title: 'Astrological Signatures', text: t.signatures ?? '' },
                { sectionId: 'significance', title: 'Personal Significance', text: t.significance ?? '' },
                { sectionId: 'musical', title: 'Musical Identity and Flow', text: t.musicalParagraph ?? '', bullets: Array.isArray(t.musicalBullets) ? t.musicalBullets : undefined }
              ]
            : (() => {
              const short = t?.short ?? '';
              const long = t?.long ?? '';
              const bulletsRaw = Array.isArray(t?.bullets) ? t.bullets : [] as string[];
              const bulletsClean = bulletsRaw.map((b: string) => (b.replace(/^\s*[•·]\s*/, '').trim())).filter(Boolean);
              let detailsText = long;
              if (short.startsWith('Tone:') && long.startsWith('Tone:')) {
                const toneEnd = long.indexOf('.');
                const tonePrefix = toneEnd > 0 ? long.slice(0, toneEnd + 1).trim() : long.match(/^Tone:[^.]*\.?/)?.[0]?.trim() ?? '';
                if (tonePrefix && long.startsWith(tonePrefix)) detailsText = long.slice(tonePrefix.length).trim();
              }
              return [
                { sectionId: 'theme', title: 'Theme', text: short },
                { sectionId: 'details', title: 'Details', text: detailsText },
                { sectionId: 'bullets', title: 'Bullets', text: bulletsClean.length ? bulletsClean.join(' ') : bulletsRaw.join(' '), bullets: bulletsClean.length ? bulletsClean : undefined }
              ];
            })();
        }
      } else {
        // Single mode: use daily v1 sections when enabled and available; otherwise ExplainSpec
        const useDailySections = enableDailyV1Text && (textVnextDaily?.sections?.length ?? 0) > 0;
        if (useDailySections) {
          sections = mapDailySectionsToResponseSections(textVnextDaily.sections as DailySection[]);
        } else {
          sections = rendered.sections.map(s => ({
            sectionId: s.id,
            title: s.title,
            text: s.text,
            bullets: s.bullets
          }));
        }
      }

      const isSpecEngine = !hasOverlayContext || process.env.VNEXT_OVERLAY_EXPLAINSPEC === '1';
      const usedDailyV1 = enableDailyV1Text && (textVnextDaily?.sections?.length ?? 0) > 0;
      const hasFactorMap = isSpecEngine && !!(spec?.single?.factorMap?.factors?.length);
      const factorCount = isSpecEngine ? (spec?.single?.factorMap?.factors?.length ?? 0) : 0;
      const debugExplain = process.env.DEBUG_EXPLAINER === '1';

      const explanationMeta: {
        engine: 'legacy' | 'spec' | 'daily-v1';
        engineVersion: string;
        hasFactorMap: boolean;
        factorCount: number;
        debug?: { aspectsCount: number; dominantPlanetsLength: number; housesPresent: boolean };
        text_vnext_daily?: any;
        text_engine_attempted?: string;
        text_engine_fallback?: boolean;
        text_engine_failure_stage?: string;
        text_engine_failure_name?: string;
        text_engine_failure_message?: string;
      } = {
        engine: usedDailyV1 ? 'daily-v1' : isSpecEngine ? 'spec' : 'legacy',
        engineVersion: 'tge-1.0',
        hasFactorMap,
        factorCount
      };
      if (debugExplain && isSpecEngine) {
        explanationMeta.debug = {
          aspectsCount: (snapshot as any)?.aspects?.length ?? 0,
          dominantPlanetsLength: spec?.single?.signatures?.dominantPlanets?.length ?? 0,
          housesPresent: !!((snapshot as any)?.houses?.length >= 10)
        };
      }
      if (textVnextDaily) {
        explanationMeta.text_vnext_daily = textVnextDaily;
      }
      if (useTextEngineVnext && enableDailyV1Text && (textVnextDaily?.sections?.length ?? 0) === 0) {
        explanationMeta.text_engine_attempted = 'daily-v1';
        explanationMeta.text_engine_fallback = true;
        if (textEngineFailureStage !== undefined) explanationMeta.text_engine_failure_stage = textEngineFailureStage;
        if (textEngineFailureName !== undefined) explanationMeta.text_engine_failure_name = textEngineFailureName;
        if (textEngineFailureMessage !== undefined) explanationMeta.text_engine_failure_message = textEngineFailureMessage;
      }

      if (debugExplain && sections) {
        sections = [
          ...sections,
          {
            sectionId: 'debug',
            title: 'Debug',
            text: `engine=${explanationMeta.engine} factorCount=${factorCount} hasFactorMap=${hasFactorMap}`
          }
        ];
      }

      const explanation = {
        spec: 'UnifiedSpecV1.1',
        sections,
        meta: explanationMeta
      };

      // Hashes for control, audio, explanation, plan (deterministic)
      const controlHash = 'sha256:' + this.sha256(JSON.stringify(payload));
      const planHash = computePlanHash(plan);
      const hashes = {
        control: controlHash,
        audio: audio.sha256, // Use actual audio SHA256 from renderer
        explanation: 'sha256:' + this.sha256(JSON.stringify(explanation)),
        plan_sha256: planHash // Always include plan hash
      };

      // Guardrail: log planner/provider for each compose call to prove that a single
      // planner and a single provider were used for this response.
      try {
        const plannerName = 'generatePlanMLOnly';
        const providerName =
          audio_export_available && export_meta?.provider
            ? export_meta.provider
            : audio_export_available
              ? getProvider().name
              : 'none';
        const guardrailLog = {
          planner: plannerName,
          provider: providerName,
          plan_sha256: planHash,
          export_id: export_id || null,
        };
        console.log('[COMPOSE_PATH]', JSON.stringify(guardrailLog));
        (globalThis as any).__lastComposePath = guardrailLog;
      } catch {
        // Guardrail logging must never break compose; ignore logging failures.
      }

      // Structured observability log (single line) - CRITICAL for soak diagnostics
      try {
        const calibratedPass = !!gateReport?.calibrated?.overall;
        const strictPass = !!gateReport?.strict?.overall;
        const templateId = (text as any)?.template_id;
        const requestId = this.generateRequestId();
        const logEntry = {
          request_id: requestId,
          compose_hash: payload.hash,
          feature_checksum: controlHash,
          gate_pass: calibratedPass,
          audio_sha256: audio.sha256,
          audio_ms: audio.latency_ms,
          audio_bytes: audio.size_bytes,
          phase: 'compose',
          controls_hash: payload.hash,
          seed_used: payload.hash,
          template_id: templateId,
          latency_ms: {
            predict: gateReport.latency_ms.predict,
            plan: gateReport.latency_ms.plan,
            text_total: textMetricsMs,
            audio: audio.latency_ms,
            total: Number(totalLatency.toFixed(2)),
          },
          gate_scores: gateReport.scores,
          gates: {
            calibrated: gateReport.calibrated,
            strict: gateReport.strict,
          },
          fail_closed_text: !calibratedPass,
          artifacts: {
            model: '084c92dca9af2f09',
            mapping_tables_version: 'v1.1',
          },
          ml: mlLog,
        };
        console.log('[COMPOSE_OBS]', JSON.stringify(logEntry));
        logAudit({ evt: 'compose_done', ...logEntry });
      } catch {}

      // Determine if plan should be included in response
      const shouldIncludePlan = !audio_export_available || 
        request.includePlan === true || 
        request.includePlan === 1 ||
        process.env.ALWAYS_INCLUDE_PLAN === '1';

      // Determine if MIDI should be included (will be computed if requested)
      const shouldIncludeMidi = request.includeMidi === true || 
        request.includeMidi === 1 ||
        process.env.ENABLE_MIDI_EXPORT === '1';

      // Generate MIDI if requested
      let midiArtifact: any = undefined;
      if (shouldIncludeMidi) {
        try {
          const midiStartTime = process.hrtime.bigint();
          const midiResult = planToMidiBase64(plan);
          const midiEndTime = process.hrtime.bigint();
          midiArtifact = {
            base64: midiResult.base64,
            sha256: midiResult.sha256,
            ppq: midiResult.ppq,
            tracks: midiResult.tracks,
            bytes: midiResult.bytes
          };
          (hashes as any).midi_sha256 = midiResult.sha256;
          console.log(`[COMPOSE] MIDI generated: ${midiResult.bytes} bytes, ${midiResult.tracks} tracks, sha256=${midiResult.sha256.slice(0, 8)}`);
        } catch (midiError) {
          console.warn('[COMPOSE] MIDI generation failed:', midiError instanceof Error ? midiError.message : String(midiError));
          // Don't fail the request if MIDI generation fails
        }
      }

      const explainText = text as any;

      const response = {
        compose_kind: 'snapshot_canonical',
        duration_s: DEFAULT_DURATION_S,
        ...(export_id != null && { export_id }),
        ...(export_meta != null && { export_meta }),
        audio_export_available: audio_export_available,
        controls: payload,
        astro: {
          element_dominance: payload.element_dominance,
          aspect_tension: payload.aspect_tension,
          modality: payload.modality
        },
        gate_report: gateReport,
        audio: {
          format: audio.format,
          base64: audio.base64,
          sha256: audio.sha256,
          digest: hashes.audio, // Keep for backward compatibility
          latency_ms: audio.latency_ms,
          size_bytes: audio.size_bytes,
          // Export gating (always present; no secrets)
          export_enabled: wavExportEnabled,
          export_attempted,
          export_id: export_id ?? null,
          export_error,
          ...((): { provider_used: string | null; provider_mode: string | null } => {
            const requested = (process.env.RENDER_PROVIDER || 'lyria').toLowerCase();
            if (audio_export_available && export_meta) {
              const used = export_meta.provider;
              return { provider_used: used, provider_mode: `requested=${requested}, used=${used}` };
            }
            if (audio_export_available) {
              const used = (requested === 'lyria' || requested === 'local_wav') ? getProvider().name : 'unknown';
              return { provider_used: used, provider_mode: `requested=${requested}, used=${used}` };
            }
            if (export_attempted) return { provider_used: null, provider_mode: `requested=${requested}, used=null` };
            return { provider_used: null, provider_mode: null };
          })()
        },
        text: {
          short: explainText.short,
          long: explainText.long,
          bullets: Array.isArray(explainText.bullets) ? explainText.bullets : [],
          template_id: explainText.template_id,
          signatures: explainText.signatures,
          significance: explainText.significance,
          musicalParagraph: explainText.musicalParagraph,
          musicalBullets: Array.isArray(explainText.musicalBullets) ? explainText.musicalBullets : [],
          digest: hashes.explanation,
          // Preserve any structured blocks if present, without replacing the canonical fields.
          ...(explainText.blocks ? { blocks: explainText.blocks } : {})
        },
        // Phase-6 Spec v1.1 surface with shared FeatureEncoder provenance
        explanation,
        hashes,
        artifacts: {
          model: '084c92dca9af2f09',
          encoder: 'db4eb96e52b3f63e',
          chartHash: snapshot_sha256,
          featuresVersion: 'v1.0',
          snapset: '185371267270f0ef',
          gate: 'v2.3-final',
          mapping_tables_version: 'v1.1',
          timestamp: new Date().toISOString(),
          ...(midiArtifact && { midi: midiArtifact }),
          provenance: {
            snapshot_sha256,
            featurevec_sha256,
            v6_sha256,
            model_id: diag?.modelVersion || this.runtimeModel,
            model_sha: diag?.model_sha || 'unknown',
            plan_sha256: planHash,
            audio_sha256: audio.sha256,
            payload_hash: payload.hash,
            encoder_version: 'v1.0',
            features_version: 'v1.0',
            chartHash: snapshot_sha256, // Backward compat
            seed: (request as any).seed || payload.hash,
            modelVersions: {
              audio: this.runtimeModel,
              text: 'v1.1',
              matching: 'v1.0'
            },
            houseSystem: 'placidus',
            tzDiscipline: 'utc'
          }
        },
        telemetry: {
          ml_used: mlLog.ml_used,
          inference_ms: mlLog.inference_ms,
          model_version: mlLog.model_version,
          model_sha: mlLog.model_sha,
          tf_backend: mlLog.tf_backend,
        },
        ...(shouldIncludePlan && { plan }),
        ...(audioDebug !== undefined && { audio_debug: audioDebug })
      } as any;

      // Cache the response for idempotency, but do not cache failed exports so fixes can take effect.
      const audioMeta = (response as any).audio || {};
      const shouldCache =
        !audioMeta ||
        audioMeta.export_enabled !== true ||
        audioMeta.export_attempted !== true ||
        audioMeta.export_error == null;
      if (shouldCache) {
        this.compositionCache.set(requestKey, response);
        console.log('[COMPOSE] Cached composition for key:', requestKey.slice(0, 8));
      } else {
        console.log(
          '[COMPOSE] Skipping cache for key:',
          requestKey.slice(0, 8),
          'due to failed export (export_error=',
          audioMeta.export_error,
          ')'
        );
      }
      console.log('[COMPOSE_RESPONSE]', JSON.stringify({
        export_id: export_id ?? null,
        export_error,
        base64_length: (audio && typeof audio.base64 === 'string') ? audio.base64.length : 0,
        audio_export_available
      }));
      return response;
      
    } catch (error: any) {
      if (error?.code === 'ML_INFERENCE_UNAVAILABLE') throw error;
      throw new Error(`Compose API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compose from a pre-computed feature vector and payload (for compatibility / comparison flow).
   * Same pipeline as compose(): plan → gates → explainer → optional WAV. Does not touch cache.
   * Used by POST /api/comparisons only; /api/compose is unchanged.
   */
  async composeFromFeatures(
    featureVec: FeatureVec,
    payload: ControlSurfacePayload
  ): Promise<{
    compose_kind: 'group_aggregate_legacy';
    plan: Plan;
    planHash: string;
    gateReport: GateReport;
    text: any;
    explanation: { spec: string; sections: Array<{ title: string; text: string }> };
    audio: { format: 'wav'; base64: string; sha256: string; latency_ms: number; size_bytes: number };
    hashes: { control: string; audio: string; explanation: string; plan_sha256: string };
  }> {
    const { plan, diag } = await generatePlanMLOnly(featureVec, payload);
    if (!diag?.ml_used) {
      const err = new Error('ML inference unavailable; cannot serve plan or audio') as Error & { code?: string };
      err.code = 'ML_INFERENCE_UNAVAILABLE';
      throw err;
    }
    const gateReport = await this.runAuditionGates(plan, payload.hash);
    const context: any = {
      mode: 'sandbox',
      session_id: this.generateSessionId(),
      request_id: this.generateRequestId(),
      chartHash: payload.hash, // composeFromFeatures doesn't have snapshot, use payload hash
      featuresVersion: 'v1.0'
    };
    const base = (this.textExplainer as any).generateExplanation(payload, gateReport, context);
    const text = base.text;

    const wavExportEnabled = process.env.ENABLE_WAV_EXPORT === '1';
    const stubAudio = {
      format: 'wav' as const,
      base64: '',
      sha256: '',
      latency_ms: 0,
      size_bytes: 0
    };
    let audio: typeof stubAudio & { base64: string; sha256: string; latency_ms: number; size_bytes: number } = { ...stubAudio };
    if (wavExportEnabled) {
      try {
        const mod = await import('../audio/wav-renderer');
        const audioStartTime = process.hrtime.bigint();
        const audioResult = mod.renderWav60s(plan, payload, payload.hash, {
          sampleRate: 22050,
          channels: 1,
          bitDepth: 16
        });
        const audioEndTime = process.hrtime.bigint();
        audio = {
          format: 'wav',
          base64: audioResult.buffer.toString('base64'),
          sha256: audioResult.sha256,
          latency_ms: Number((audioEndTime - audioStartTime) / BigInt(1_000_000)),
          size_bytes: audioResult.size_bytes
        };
      } catch (_) {
        // leave stub
      }
    }

    const explanation = {
      spec: 'UnifiedSpecV1.1',
      sections: [
        { title: 'Theme', text: (text as any)?.short ?? '' },
        { title: 'Details', text: (text as any)?.long ?? '' },
        { title: 'Bullets', text: Array.isArray((text as any)?.bullets) ? (text as any).bullets.join(' · ') : '' }
      ]
    };
    const planHash = computePlanHash(plan);
    const hashes = {
      control: 'sha256:' + this.sha256(JSON.stringify(payload)),
      audio: audio.sha256,
      explanation: 'sha256:' + this.sha256(JSON.stringify(explanation)),
      plan_sha256: planHash
    };
    return {
      compose_kind: 'group_aggregate_legacy' as const,
      plan,
      planHash,
      gateReport,
      text,
      explanation,
      audio,
      hashes
    };
  }

  /**
   * Explainer-only path for profile chart (no audio). Used by GET /api/profile/chart.
   * Same pipeline: plan → gates → ExplainSpec → render. Additive; does not change compose().
   */
  async getExplainerSectionsForFeatures(
    featureVec: FeatureVec,
    payload: ControlSurfacePayload,
    snapshot: EphemerisSnapshot
  ): Promise<{ spec: string; sections: Array<{ id: string; title: string; text: string; bullets?: string[] }> }> {
    const { plan, diag } = await generatePlanMLOnly(featureVec, payload);
    if (!diag?.ml_used) {
      const err = new Error('ML inference unavailable') as Error & { code?: string };
      err.code = 'ML_INFERENCE_UNAVAILABLE';
      throw err;
    }
    const gateReport = await this.runAuditionGates(plan, payload.hash);
    const guidanceSummary = guidanceSummaryFromFeatureVec(featureVec);
    const planSummary = buildPlanSummary(plan);
    const spec = buildExplainSpecSingle({
      seed: payload.hash,
      snapshot,
      featureVec,
      guidanceSummary,
      plan,
      planSummary,
      gateReport
    });
    const rendered = renderExplainSpecToSections(spec);
    return {
      spec: 'UnifiedSpecV1.1',
      sections: rendered.sections.map((s) => ({
        id: s.id,
        title: s.title,
        text: s.text,
        bullets: s.bullets
      }))
    };
  }

  private async buildCanonicalInputFromRequest(request: ComposeRequest): Promise<CanonicalCompositionInput> {
    const req = request as any;
    if (req.mode === 'sky') {
      const chartInput = this.extractChartInput(request);
      const snapshot = await fetchChartSnapshot(chartInput);
      const payload = await this.generateSkyPayload(request.skyParams!);
      return buildHomeCanonicalInput({
        snapshot,
        payload,
        seed: req.seed || payload.hash,
        enableDailyV1Text: true,
      });
    }

    if (req.mode === 'overlay') {
      if (!request.overlayParams) {
        throw new Error('Overlay mode requires overlayParams.');
      }
      const snapshot = await fetchChartSnapshot(this.extractChartInput(request));
      const payload = await this.generateOverlayPayload(request.overlayParams);
      const natalDt = request.overlayParams.natalDatetime;
      const [natalDate, natalTimePart] = String(natalDt).split('T');
      const natalInput: ChartInput = {
        date: natalDate,
        time: (natalTimePart || '').slice(0, 5),
        lat: request.overlayParams.natalLatitude,
        lon: request.overlayParams.natalLongitude,
      };
      const natalSnapshot = await fetchChartSnapshot(natalInput);
      return buildOverlayCanonicalInput({
        snapshot,
        natalSnapshot,
        payload,
        seed: req.seed || payload.hash,
      });
    }

    if (req.mode === 'sandbox') {
      const payload = await this.generateSandboxPayload(request.controls || {});
      if (req.overriddenSnapshot != null) {
        const snapshot = this.validateOverriddenSnapshot(req.overriddenSnapshot);
        return buildSandboxCanonicalInput({
          snapshot,
          payload,
          seed: req.seed || payload.hash,
        });
      }
      if (!req.chartData) {
        throw new Error('Sandbox mode requires overriddenSnapshot from POST /api/sandbox/snapshot or chartData');
      }
      const snapshot = await fetchChartSnapshot(this.extractChartInput(request));
      return buildProfileNatalCanonicalInput({
        snapshot,
        payload,
        seed: req.seed || payload.hash,
      });
    }

    throw new Error(`Unsupported compose mode: ${String(req.mode)}`);
  }

  private async runSharedComposePipeline<T>(runner: () => Promise<T>): Promise<T> {
    return runner();
  }

  /**
   * Extract chart input from compose request.
   * Used by architecture engine to fetch snapshot.
   */
  private extractChartInput(request: ComposeRequest): ChartInput {
    const req = request as any;
    if (req.mode === 'sky' && req.skyParams) {
      const dt = req.skyParams.datetime;
      const lat = req.skyParams.latitude;
      const lon = req.skyParams.longitude;
      if (
        typeof dt !== 'string' ||
        !dt.includes('T') ||
        typeof lat !== 'number' ||
        typeof lon !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        throw new Error('Invalid skyParams: latitude, longitude, and ISO datetime are required');
      }
      const [d, t] = dt.split('T');
      const timePart = t ? t.slice(0, 5) : '';
      if (!d || !timePart) {
        throw new Error('Invalid skyParams.datetime; expected YYYY-MM-DDTHH:mm:ssZ');
      }
      return { date: d, time: timePart, lat, lon };
    }

    if (req.mode === 'overlay' && req.overlayParams) {
      const dt = req.overlayParams.currentDatetime;
      const lat = req.overlayParams.currentLatitude;
      const lon = req.overlayParams.currentLongitude;
      if (
        typeof dt !== 'string' ||
        !dt.includes('T') ||
        typeof lat !== 'number' ||
        typeof lon !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        throw new Error('Invalid overlayParams: currentLatitude, currentLongitude, and currentDatetime are required');
      }
      const [d, t] = dt.split('T');
      const timePart = t ? t.slice(0, 5) : '';
      if (!d || !timePart) {
        throw new Error('Invalid overlayParams.currentDatetime; expected YYYY-MM-DDTHH:mm:ssZ');
      }
      return { date: d, time: timePart, lat, lon };
    }

    if (req.chartData && typeof req.chartData.date === 'string' && typeof req.chartData.time === 'string') {
      const lat = req.chartData.lat;
      const lon = req.chartData.lon;
      if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('Invalid chartData: lat and lon must be provided as finite numbers');
      }
      return {
        date: String(req.chartData.date).slice(0, 10),
        time: String(req.chartData.time).slice(0, 5),
        lat,
        lon,
      };
    }

    throw new Error('Invalid compose request: chart input (date, time, lat, lon) is required for this mode');
  }

  private validateRenderedWavDuration(
    wavBuffer: Buffer,
    expectedDurationSec: number
  ): { valid: boolean; durationSec: number } {
    if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length < 44) {
      return { valid: false, durationSec: 0 };
    }
    const riff = wavBuffer.toString('ascii', 0, 4);
    const wave = wavBuffer.toString('ascii', 8, 12);
    if (riff !== 'RIFF' || wave !== 'WAVE') {
      return { valid: false, durationSec: 0 };
    }
    const channels = wavBuffer.readUInt16LE(22);
    const sampleRate = wavBuffer.readUInt32LE(24);
    const bitsPerSample = wavBuffer.readUInt16LE(34);
    const dataSize = wavBuffer.readUInt32LE(40);
    const bytesPerSample = (bitsPerSample / 8) * channels;
    if (!Number.isFinite(bytesPerSample) || bytesPerSample <= 0 || sampleRate <= 0) {
      return { valid: false, durationSec: 0 };
    }
    const durationSec = dataSize / (sampleRate * bytesPerSample);
    const toleranceSec = 1.0;
    const valid = Number.isFinite(durationSec) && Math.abs(durationSec - expectedDurationSec) <= toleranceSec;
    return { valid, durationSec };
  }

  /**
   * Phase 6 Sandbox: validate overriddenSnapshot shape (EphemerisSnapshot from POST /api/sandbox/snapshot).
   * Fail closed with explicit error if invalid.
   */
  private validateOverriddenSnapshot(raw: unknown): EphemerisSnapshot {
    if (raw == null || typeof raw !== 'object') {
      throw new Error('Invalid overriddenSnapshot: must be an object (EphemerisSnapshot from POST /api/sandbox/snapshot)');
    }
    const o = raw as Record<string, unknown>;
    if (typeof o.ts !== 'string' || typeof o.tz !== 'string' || typeof o.houseSystem !== 'string') {
      throw new Error('Invalid overriddenSnapshot: ts, tz, houseSystem must be strings');
    }
    if (typeof o.lat !== 'number' || !Number.isFinite(o.lat) || typeof o.lon !== 'number' || !Number.isFinite(o.lon)) {
      throw new Error('Invalid overriddenSnapshot: lat, lon must be finite numbers');
    }
    if (!Array.isArray(o.planets)) {
      throw new Error('Invalid overriddenSnapshot: planets must be an array');
    }
    for (let i = 0; i < o.planets.length; i++) {
      const p = o.planets[i] as Record<string, unknown>;
      if (p == null || typeof p !== 'object' || typeof (p.name as string) !== 'string' || typeof (p.lon as number) !== 'number' || !Number.isFinite(p.lon as number)) {
        throw new Error(`Invalid overriddenSnapshot: planets[${i}] must have name (string) and lon (finite number)`);
      }
    }
    if (!Array.isArray(o.houses) || o.houses.length < 12) {
      throw new Error('Invalid overriddenSnapshot: houses must be an array of at least 12 numbers');
    }
    for (let i = 0; i < 12; i++) {
      const h = o.houses[i];
      if (typeof h !== 'number' || !Number.isFinite(h)) {
        throw new Error(`Invalid overriddenSnapshot: houses[${i}] must be a finite number`);
      }
    }
    if (!Array.isArray(o.aspects)) {
      throw new Error('Invalid overriddenSnapshot: aspects must be an array');
    }
    if (typeof o.moonPhase !== 'number' || !Number.isFinite(o.moonPhase)) {
      throw new Error('Invalid overriddenSnapshot: moonPhase must be a finite number');
    }
    const de = o.dominantElements;
    if (de == null || typeof de !== 'object') {
      throw new Error('Invalid overriddenSnapshot: dominantElements must be an object');
    }
    const elem = de as Record<string, unknown>;
    for (const key of ['fire', 'earth', 'air', 'water']) {
      if (typeof elem[key] !== 'number' || !Number.isFinite(elem[key] as number)) {
        throw new Error(`Invalid overriddenSnapshot: dominantElements.${key} must be a finite number`);
      }
    }
    return {
      ts: o.ts as string,
      tz: o.tz as string,
      lat: o.lat as number,
      lon: o.lon as number,
      houseSystem: o.houseSystem as string,
      planets: o.planets as EphemerisSnapshot['planets'],
      houses: (o.houses as number[]).slice(0, 12) as EphemerisSnapshot['houses'],
      aspects: o.aspects as EphemerisSnapshot['aspects'],
      moonPhase: o.moonPhase as number,
      dominantElements: {
        fire: elem.fire as number,
        earth: elem.earth as number,
        air: elem.air as number,
        water: elem.water as number,
      },
    };
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
      genre: 'house', // Default genre
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
    
    // Merge with user controls (genre defaults to 'house' if not specified)
    const mergedPayload = { ...defaultPayload, ...userControls };
    if (!mergedPayload.genre) {
      mergedPayload.genre = 'house';
    }
    
    // Ensure hash is updated
    mergedPayload.hash = this.generateHash(mergedPayload);
    
    return mergedPayload;
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

  // generateAudio removed - now using renderWav60s from audio/wav-renderer.ts

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
      genre: 'house', // Default genre
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

  /**
   * Canonical hash for EphemerisSnapshot (stable key order)
   */
  private hashSnapshot(snapshot: EphemerisSnapshot): string {
    const canonical = {
      ts: snapshot.ts,
      tz: snapshot.tz,
      lat: snapshot.lat,
      lon: snapshot.lon,
      houseSystem: snapshot.houseSystem,
      planets: snapshot.planets.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => ({
        name: p.name,
        lon: p.lon,
        lat: p.lat ?? null,
        speed: p.speed ?? null
      })),
      houses: snapshot.houses,
      aspects: snapshot.aspects.slice().sort((a, b) => {
        const cmp = a.bodyA.localeCompare(b.bodyA);
        return cmp !== 0 ? cmp : a.bodyB.localeCompare(b.bodyB);
      }),
      moonPhase: snapshot.moonPhase,
      dominantElements: snapshot.dominantElements
    };
    return this.sha256(JSON.stringify(canonical));
  }

  /**
   * Canonical hash for FeatureVec (fixed precision floats)
   */
  private hashFeatureVec(featureVec: FeatureVec): string {
    const precision = 6;
    const parts = Array.from(featureVec).map(v => v.toFixed(precision));
    return this.sha256(parts.join(','));
  }

  /**
   * Canonical hash for v6 vector (fixed precision floats)
   */
  private hashV6(v6: number[]): string {
    const precision = 6;
    const parts = v6.map(v => v.toFixed(precision));
    return this.sha256(parts.join(','));
  }
}

// Export handler function for server integration
const composeAPI = new ComposeAPI();
/** Singleton for compat/comparison flow only (composeFromFeatures). Do not use from /api/compose. */
export { composeAPI };

export async function vnextCompose(req: any, res: any) {
  const requestId = (req.headers && req.headers['x-request-id']) || require('crypto').randomBytes(4).toString('hex');
  const mode = req.body && req.body.mode;
  console.log('[api/compose] entered rid=%s mode=%s', requestId, mode ?? '—');
  try {
    const request = req.body;
    const response = await composeAPI.compose(request);
    res.json(response);
  } catch (error: any) {
    console.error('[VNEXT_COMPOSE] Error:', error);
    const code = error?.code;
    if (code === 'ML_INFERENCE_UNAVAILABLE') {
      res.status(503).json({
        error: error?.message || 'ML inference unavailable',
        code: 'ML_INFERENCE_UNAVAILABLE',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'VNEXT_COMPOSE_ERROR',
    });
  }
}
