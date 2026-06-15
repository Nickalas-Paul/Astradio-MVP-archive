/**
 * Compose API v1.0
 * Unified endpoint for audio + text generation from control-surface payload
 */

import {
  ComposeRequest,
  ComposeResponse,
  ControlSurfacePayload,
  GateReport,
} from '../explainer/contracts';
import { logAudit } from '../logger';
import { generatePlanMLOnly } from '../plan-generator';
import {
  generateArchitecture,
  generateArchitectureFromSnapshot,
  fetchChartSnapshot,
  type ChartInput,
  type ArchitectureOutput,
} from '../core/architecture-engine';
import { computePlanHash } from '../plan-hash';
import { stripTaggedFromExplanationForHash } from '../projection/tagged-text';
import { planToMidiBase64 } from '../midi/plan-to-midi';
import type { EphemerisSnapshot, FeatureVec, Plan } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { DEFAULT_DURATION_S } from '../constants';
import { getProvider } from '../render';
import type { LyriaPromptProfile } from '../render/prompt-from-controls';
import type { CanonicalCompositionInput } from './canonical-compose-input';
import { buildHomeCanonicalInput } from '../adapters/home-compose-adapter';
import { buildProfileNatalCanonicalInput } from '../adapters/profile-natal-compose-adapter';
import { buildSandboxCanonicalInput } from '../adapters/sandbox-compose-adapter';
import { buildOverlayCanonicalInput } from '../adapters/overlay-compose-adapter';
import { controlPayloadFromSeed } from '../compat/payload-from-seed';
import { buildComparisonPlanChartContext, buildGroupPlanChartContext } from './plan-chart-context-reduction';
import { buildArchitectureForAggregate } from './aggregate-architecture';
import { runLyriaAlignedExportBlock, type ExportErrorCode } from './run-lyria-export-block';
import type { RelationalWeatherStateV1 } from '../relational/weather/types';
import { mergeRelationalWeatherIntoPlanChartContext } from '../relational/weather/merge-plan-context';
import {
  buildCanonicalReportForSnapshotSurface,
  buildCanonicalReportForOverlay,
  buildCanonicalReportForAggregate,
} from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore, projectFeedCardFromSemanticCore } from '../projection/text-projection';
import type { CanonicalReportObject } from '../canonical/canonical-report-object';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import {
  toLegacyPairInteractionAspect,
  type ComparisonSeekerContextV1,
} from '../synastry/synastry-types';
import {
  resolveParticipantLabels,
  type AggregateParticipantLabelV1,
} from '../relational/composition/resolve-participant-labels';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCompositionNarrativePlan } from '../audio/composition-narrative';
import type { ExpansionTier, ProjectionSurface, ProjectionValidation } from '../projection/projection-types';
import type { RelationshipMode } from '../compat/types';

function parseExpansionTier(v: unknown): ExpansionTier {
  if (v === 'expanded' || v === 'extended') return v;
  return 'baseline';
}

function firstSentenceForSummary(text: string): string {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^[^.!?]+[.!?]?/);
  return (m ? m[0] : trimmed).trim();
}

/** Phase B — aggregate surfaces (comparison + group) share one downstream runner. */
export type AggregateCompositionInput =
  | {
      kind: 'comparison';
      chartIdLow: string;
      chartIdHigh: string;
      snapLow: EphemerisSnapshot;
      snapHigh: EphemerisSnapshot;
      vecLow: FeatureVec;
      vecHigh: FeatureVec;
      merged: FeatureVec;
      payload: ControlSurfacePayload;
      relationalWeather?: RelationalWeatherStateV1;
      /** From compatibility classification when comparison compose runs after relational scoring. */
      compatClassCode?: string;
      relationshipMode?: RelationshipMode;
      expansionTier?: ExpansionTier;
      output_kind?: 'full' | 'feed_card';
      /** Phase 6C — Community seeker (Chart A) / target (Chart B) chart ids for directed synastry assembly. */
      seekerChartId?: string;
      targetChartId?: string;
      /** When false (default), skip Lyria export — text-only aggregate. */
      generateAudio?: boolean;
    }
  | {
      kind: 'group';
      anchorSnapshot: EphemerisSnapshot;
      snapshotsOrdered: EphemerisSnapshot[];
      /** When set (Sandbox / composition-faithful group), participants use these features instead of encodeFeatures(snapshot). */
      memberFeatureVecs?: FeatureVec[];
      composite: FeatureVec;
      payload: ControlSurfacePayload;
      relationalWeather?: RelationalWeatherStateV1;
      expansionTier?: ExpansionTier;
      output_kind?: 'full' | 'feed_card';
      /** Phase 6E — parallel to snapshotsOrdered (null = birth-only slot). */
      chartIdsOrdered?: ReadonlyArray<string | null>;
      viewerChartId?: string;
      /** When set with viewerChartId, YOUR labeling requires chart.ownerId === this. */
      labelResolutionOwnerId?: string;
      /** Sandbox multi-chart: omit generic ensemble preface (projection-only). */
      suppressEnsembleFraming?: boolean;
      /** When false (default), skip Lyria export — text-only aggregate. */
      generateAudio?: boolean;
    };

/** Phase 6C — maps UI seeker/target chart ids onto lexical slot order (snapLow = slot 0, snapHigh = slot 1). */
function comparisonSeekerContextFromInput(
  input: Extract<AggregateCompositionInput, { kind: 'comparison' }>
): ComparisonSeekerContextV1 | undefined {
  const seeker = input.seekerChartId;
  const target = input.targetChartId;
  if (!seeker || !target || seeker === target) return undefined;
  const { chartIdLow, chartIdHigh } = input;
  if (seeker !== chartIdLow && seeker !== chartIdHigh) return undefined;
  if (target !== chartIdLow && target !== chartIdHigh) return undefined;
  return {
    seekerChartId: seeker,
    targetChartId: target,
    seekerSlotIndex: seeker === chartIdLow ? 0 : 1,
    targetSlotIndex: target === chartIdLow ? 0 : 1,
  };
}

export type AggregateComposeResult = {
  compose_kind: 'comparison_aggregate' | 'group_aggregate';
  plan: Plan;
  planHash: string;
  gateReport: GateReport;
  text: any;
  explanation: {
    spec: string;
    sections: Array<{
      sectionId: string;
      title: string;
      text?: string;
      bullets?: string[];
      meta?: { claimIdsReferenced?: string[]; phaseD?: boolean; projection_validation?: ProjectionValidation };
    }>;
    meta?: {
      phase_d: {
        surface: ProjectionSurface;
        tier: ExpansionTier;
        tierRequested: ExpansionTier;
        tierEffective: ExpansionTier;
        downgradedFrom?: ExpansionTier;
        projection_validation?: ProjectionValidation;
      };
    };
  };
  audio: { format: 'wav'; base64: string; sha256: string; latency_ms: number; size_bytes: number };
  hashes: { control: string; audio: string; explanation: string; plan_sha256: string };
  /** Same export contract as snapshot compose (runLyriaAlignedExportBlock). */
  audio_export_available: boolean;
  export_id?: string;
  export_attempted: boolean;
  export_error: ExportErrorCode | null;
};

export class ComposeAPI {
  // private featureEncoder: FeatureEncoder;
  private runtimeModel: string;
  private compositionCache: Map<string, any>;

  constructor() {
    // this.featureEncoder = new FeatureEncoder();
    // Runtime model switching - defaults to v2.8 for Phase-6 integration
    this.runtimeModel = process.env.RUNTIME_MODEL || 'student-v2.8-slice-batch';
    console.log(`🎯 Runtime model: ${this.runtimeModel}`);
    
    // In-memory cache for idempotency (in production, use Redis)
    this.compositionCache = new Map();
  }

  /**
   * Sky-mode cache key: calendar date + city-level coords (no hour); ignores generateAudio and locationMeta.resolvedAt.
   */
  private compositionCacheKeyForRequest(request: ComposeRequest): string {
    const req = request as ComposeRequest & {
      skyParams?: { latitude: number; longitude: number; datetime: string; timezone?: string };
    };
    if (req.mode === 'sky' && req.skyParams) {
      const sp = req.skyParams;
      const datetime = String(sp.datetime || '');
      const dateOnly = datetime.length >= 10 ? datetime.slice(0, 10) : datetime;
      const lat = Math.round(sp.latitude * 10) / 10;
      const lon = Math.round(sp.longitude * 10) / 10;
      const tz =
        typeof sp.timezone === 'string' && sp.timezone.trim() ? sp.timezone.trim() : 'UTC';
      const normalized = {
        mode: 'sky' as const,
        skyParams: {
          latitude: lat,
          longitude: lon,
          datetime: `${dateOnly}T12:00:00`,
          timezone: tz,
        },
      };
      return this.sha256(JSON.stringify(normalized) + this.runtimeModel);
    }
    return this.sha256(JSON.stringify(request) + this.runtimeModel);
  }

  /**
   * Main compose endpoint - generates audio + text from control-surface payload
   */
  async compose(request: ComposeRequest): Promise<ComposeResponse> {
    const startTime = process.hrtime.bigint();
    
    try {
      // Accept empty body by defaulting to sandbox mode (generateAudio true for legacy empty-POST only)
      if (!request || !request.mode) {
        (request as any) = { mode: 'sandbox', controls: {}, generateAudio: true };
      }

      const requestKey = this.compositionCacheKeyForRequest(request);
      const wantAudio = (request as ComposeRequest).generateAudio === true;

      const isSkyRequest = (request as ComposeRequest).mode === 'sky';

      // Check cache for idempotent response. Sky mode caches failed exports to avoid Lyria retry storms.
      if (this.compositionCache.has(requestKey)) {
        const cached = this.compositionCache.get(requestKey);
        const cachedAudio = cached && cached.audio;
        const cachedExportFailed =
          cachedAudio &&
          cachedAudio.export_enabled === true &&
          cachedAudio.export_attempted === true &&
          cachedAudio.export_error != null;

        if (cachedExportFailed && !isSkyRequest) {
          console.log(
            '[COMPOSE] Ignoring cached failed export for key:',
            requestKey.slice(0, 8),
            'export_error=',
            cachedAudio.export_error
          );
        } else {
          const hasExport = Boolean(cached?.export_id && cached?.audio_export_available);
          if (!wantAudio || hasExport || (isSkyRequest && cachedExportFailed)) {
            if (cachedExportFailed && isSkyRequest && wantAudio) {
              console.log(
                '[COMPOSE] Returning cached failed sky audio for key:',
                requestKey.slice(0, 8),
                'export_error=',
                cachedAudio.export_error
              );
            } else {
              console.log('[COMPOSE] Returning cached composition for key:', requestKey.slice(0, 8));
            }
            return cached;
          }
          console.log(
            '[COMPOSE] Cache hit without export; generating audio for key:',
            requestKey.slice(0, 8)
          );
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
      const { snapshot, features: featureVec, guidance } = architecture;

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
      
      let canonicalReport: CanonicalReportObject;
      if (hasOverlayContext && canonicalInput.overlayNatalSnapshot) {
        const natalSnapshot = canonicalInput.overlayNatalSnapshot;
        const natalFeatureVec = encodeFeatures(natalSnapshot) as FeatureVec;
        const overlayDirected = computeSynastryAspects({
          snapshotsOrdered: [natalSnapshot, architecture.snapshot],
          mode: 'pair',
        });
        const overlayLegacy = overlayDirected.map((r) => toLegacyPairInteractionAspect(r));
        canonicalReport = buildCanonicalReportForOverlay({
          subject_ids: [payload.hash],
          natalSnapshot,
          natalFeatureVec,
          transitSnapshot: architecture.snapshot,
          transitFeatureVec: featureVec,
          control_surface_hash: payload.hash,
          compose_seed: requestSeed,
          guidance: architecture.guidance,
          pair_interaction_aspects: overlayLegacy,
          pair_interaction_aspects_v2: overlayDirected,
        });
      } else {
        const surface_kind =
          (request as any).mode === 'sky' && enableDailyV1Text ? 'home_daily' : 'profile_natal';
        canonicalReport = buildCanonicalReportForSnapshotSurface({
          surface_kind,
          subject_ids: [payload.hash],
          snapshot: architecture.snapshot,
          featureVec,
          control_surface_hash: payload.hash,
          compose_seed: requestSeed,
          guidance: architecture.guidance,
        });
      }

      const semanticCore = interpretCanonicalReportObject(canonicalReport);
      const narrativePlan = buildCompositionNarrativePlan(payload, plan, semanticCore);
      const tier = parseExpansionTier((request as any).expansionTier ?? (request as any).expansion_tier);
      let projectionSurface: ProjectionSurface = 'profile';
      if (hasOverlayContext && canonicalInput.overlayNatalSnapshot) projectionSurface = 'overlay_pair';
      else if ((request as any).mode === 'sky' && enableDailyV1Text) projectionSurface = 'daily';
      else if ((request as any).mode === 'sandbox') projectionSurface = 'sandbox';

      const insightOpts = insightProjectionOptionsFromCanonical(canonicalReport);
      const outputKind = (request as any).output_kind === 'feed_card' ? 'feed_card' : 'full';
      const projected =
        outputKind === 'feed_card'
          ? projectFeedCardFromSemanticCore(semanticCore, payload.hash, {
              ...insightOpts,
              narrativePlan,
              aspectTension: typeof payload.aspect_tension === 'number' ? payload.aspect_tension : null,
            })
          : projectTextFromSemanticCore(semanticCore, payload.hash, {
              phaseD: true,
              surface: projectionSurface,
              tier,
              narrativePlan,
              aspectTension: typeof payload.aspect_tension === 'number' ? payload.aspect_tension : null,
              ...insightOpts,
              ...(projectionSurface === 'overlay_pair' && hasOverlayContext && canonicalInput.overlayNatalSnapshot
                ? {
                    /** Natal placements must use birth chart, not transit sky snapshot. */
                    snapshot: insightOpts.snapshot ?? canonicalInput.overlayNatalSnapshot,
                    secondarySnapshot: insightOpts.secondarySnapshot ?? architecture.snapshot,
                    transitCalendarDate: (request as ComposeRequest).transitCalendarDate,
                    transitDiversificationContext: (request as ComposeRequest).transitDiversificationContext ?? null,
                  }
                : {
                    snapshot: architecture.snapshot,
                  }),
            });

      const dailyLike = projected.map((s) => ({
        id: s.id,
        title: s.title,
        text: s.text,
        bullets: s.bullets,
      }));
      const sig = dailyLike.find(
        (x) =>
          x.id === 'aspects' ||
          x.id === 'group_key_interactions_v1' ||
          x.id === 'signatures' ||
          x.id === 'sky_summary' ||
          x.id === 'todays_sound' ||
          x.id === 'sky_anchor'
      );
      const sigText = sig?.text ?? dailyLike[0]?.text ?? '';
      const mus = dailyLike.find(
        (x) => x.id === 'music_translation'
      );
      const allLong = dailyLike.map((s) => s.text).filter(Boolean).join('\n\n');
      const text: any = {
        short: sigText,
        long: allLong || sigText,
        bullets: mus?.bullets ?? [],
        template_id: 'semantic-core-v1',
        signatures:
          dailyLike.find(
            (s) =>
              s.id === 'aspects' ||
              s.id === 'group_key_interactions_v1' ||
              s.id === 'signatures' ||
              s.id === 'sky_summary' ||
              s.id === 'todays_sound' ||
              s.id === 'sky_anchor'
          )?.text ?? sigText,
        significance:
          dailyLike.find((s) => s.id === 'significance' || s.id === 'personal_emphasis')?.text ?? sigText,
        musicalParagraph: mus?.text ?? '',
        musicalBullets: mus?.bullets ?? [],
      };
      const textMetricsMs = 0;

      const generateAudio = (request as ComposeRequest).generateAudio === true;
      const rCompose = request as ComposeRequest;
      const useLyriaProfileNatalIdentitySeed =
        generateAudio &&
        rCompose.mode === 'sandbox' &&
        !hasOverlayContext &&
        rCompose.lyriaProfileNatalIdentityAudio === true;

      if (useLyriaProfileNatalIdentitySeed) {
        try {
          console.log(
            '[COMPOSE_IDENTITY_NATAL_AUDIO]',
            JSON.stringify({ path: 'sandbox_no_overlay', phase: 'runLyriaExportBlock' })
          );
        } catch {
          /* ignore */
        }
      }

      // Generate audio: shared Lyria/provider path (only when generateAudio is explicitly true)
      const wavExportEnabled = process.env.ENABLE_WAV_EXPORT === '1';
      const wavBundle = generateAudio
        ? await runLyriaAlignedExportBlock(
            (buf, sec) => this.validateRenderedWavDuration(buf, sec),
            {
              plan,
              architecture,
              featureVec,
              payload,
              semanticCore,
              ...(useLyriaProfileNatalIdentitySeed
                ? { lyriaProfileNatalIdentity: { objectIdentityHash: canonicalReport.object_identity_hash } }
                : {}),
              ...((request as ComposeRequest).mode === 'sky' && enableDailyV1Text
                ? { lyriaPromptProfile: 'home_sky_minimal_v1' as const }
                : {}),
            }
          )
        : {
            audio: {
              format: 'wav' as const,
              base64: '',
              sha256: this.sha256('compose_audio_branch_skipped_v1'),
              latency_ms: 0,
              size_bytes: 0,
            },
            audio_export_available: false,
            export_attempted: false,
            export_error: 'export_not_attempted' as ExportErrorCode,
          };
      const audio = wavBundle.audio;
      let audio_export_available = wavBundle.audio_export_available;
      let export_id = wavBundle.export_id;
      let export_meta = wavBundle.export_meta;
      const export_attempted = wavBundle.export_attempted;
      let export_error: ExportErrorCode | null = wavBundle.export_error;
      let audioDebug: any = wavBundle.audioDebug;

      const targetLengthSec = DEFAULT_DURATION_S;
      
      const endTime = process.hrtime.bigint();
      const totalLatency = Number(endTime - startTime) / 1000000;

      let sections: Array<{
        sectionId: string;
        title: string;
        text?: string;
        bullets?: string[];
        meta?: (typeof projected)[0]['meta'];
      }> = projected.map((s) => ({
        sectionId: s.id,
        title: s.title,
        text: s.text,
        bullets: s.bullets,
        ...(s.meta ? { meta: s.meta } : {}),
      }));

      const debugExplain = process.env.DEBUG_EXPLAINER === '1';

      const pvMain = projected[projected.length - 1]?.meta?.projection_validation;

      const explanationMeta: {
        engine: 'semantic-core-v1';
        engineVersion: string;
        canonical_object_hash: string;
        semantic_core_schema: string;
        claim_count: number;
        hasFactorMap: boolean;
        factorCount: number;
        phase_d?: {
          surface: ProjectionSurface;
          tier: ExpansionTier;
          tierRequested: ExpansionTier;
          tierEffective: ExpansionTier;
          downgradedFrom?: ExpansionTier;
          projection_validation?: ProjectionValidation;
        };
        debug?: { aspectsCount: number; housesPresent: boolean };
      } = {
        engine: 'semantic-core-v1',
        engineVersion: 'phase-b-1',
        canonical_object_hash: canonicalReport.object_identity_hash,
        semantic_core_schema: semanticCore.provenance.core_schema_version,
        claim_count: semanticCore.claims.length,
        hasFactorMap: false,
        factorCount: 0,
        phase_d: {
          surface: projectionSurface,
          tier: pvMain?.tierEffective ?? tier,
          tierRequested: pvMain?.tierRequested ?? tier,
          tierEffective: pvMain?.tierEffective ?? tier,
          downgradedFrom: pvMain?.downgradedFrom,
          projection_validation: pvMain,
        },
      };
      if (debugExplain) {
        explanationMeta.debug = {
          aspectsCount: (snapshot as any)?.aspects?.length ?? 0,
          housesPresent: !!((snapshot as any)?.houses?.length >= 10),
        };
      }

      if (debugExplain && sections) {
        sections = [
          ...sections,
          {
            sectionId: 'debug',
            title: 'Debug',
            text: `engine=semantic-core-v1 claims=${semanticCore.claims.length} canonical=${canonicalReport.object_identity_hash.slice(0, 8)}`,
          },
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
        explanation:
          'sha256:' + this.sha256(JSON.stringify(stripTaggedFromExplanationForHash(explanation as Record<string, unknown>))),
        plan_sha256: planHash // Always include plan hash
      };

      const reqGate = request as ComposeRequest;
      if (
        generateAudio &&
        typeof reqGate.expectedPlanSha256 === 'string' &&
        reqGate.expectedPlanSha256.length > 0 &&
        typeof reqGate.expectedObjectIdentityHash === 'string' &&
        reqGate.expectedObjectIdentityHash.length > 0
      ) {
        if (
          planHash !== reqGate.expectedPlanSha256 ||
          explanationMeta.canonical_object_hash !== reqGate.expectedObjectIdentityHash
        ) {
          const err = new Error(
            'HASH_MISMATCH: audio step did not reproduce canonical text artifact hashes'
          ) as Error & { code?: string };
          err.code = 'HASH_MISMATCH';
          throw err;
        }
      }

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

      // Cache the response for idempotency. Non-sky failed exports stay uncached so fixes can take effect.
      const audioMeta = (response as any).audio || {};
      const exportFailed =
        audioMeta.export_enabled === true &&
        audioMeta.export_attempted === true &&
        audioMeta.export_error != null;
      const shouldCache =
        !audioMeta ||
        audioMeta.export_enabled !== true ||
        audioMeta.export_attempted !== true ||
        audioMeta.export_error == null ||
        (isSkyRequest && exportFailed);
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
      if (error?.code === 'HASH_MISMATCH') throw error;
      throw new Error(`Compose API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Phase B — unified aggregate composition (comparison + group composite).
   * Plan context reductions + ExplainSpec + same Lyria/export path as snapshot compose.
   */
  async runAggregateComposition(input: AggregateCompositionInput): Promise<AggregateComposeResult> {
    const payload = input.payload;
    let planChartContext: Record<string, unknown>;
    let architecture: ArchitectureOutput;
    let featureVec: FeatureVec;

    if (input.kind === 'comparison') {
      planChartContext = buildComparisonPlanChartContext(payload, input.snapLow, input.snapHigh);
      featureVec = input.merged;
      architecture = buildArchitectureForAggregate(input.snapLow, featureVec, payload.hash);
    } else {
      planChartContext = buildGroupPlanChartContext(payload, input.snapshotsOrdered);
      featureVec = input.composite;
      architecture = buildArchitectureForAggregate(input.anchorSnapshot, featureVec, payload.hash);
    }

    if (input.relationalWeather) {
      planChartContext = mergeRelationalWeatherIntoPlanChartContext(planChartContext, input.relationalWeather);
    }

    const { plan, diag } = await generatePlanMLOnly(featureVec, planChartContext);
    if (!diag?.ml_used) {
      const err = new Error('ML inference unavailable; cannot serve plan or audio') as Error & { code?: string };
      err.code = 'ML_INFERENCE_UNAVAILABLE';
      throw err;
    }
    const gateReport = await this.runAuditionGates(plan, payload.hash);
    const participants =
      input.kind === 'comparison'
        ? [
            { snapshot: input.snapLow, featureVec: input.vecLow, role: 'primary' as const },
            { snapshot: input.snapHigh, featureVec: input.vecHigh, role: 'member_i' as const },
          ]
        : input.snapshotsOrdered.map((sn, i) => ({
            snapshot: sn,
            featureVec:
              input.memberFeatureVecs != null && input.memberFeatureVecs[i] != null
                ? input.memberFeatureVecs[i]!
                : (encodeFeatures(sn) as FeatureVec),
            role: (i === 0 ? 'primary' : 'member_i') as 'primary' | 'member_i',
          }));

    /**
     * Synastry (S3): participant-count-based mode, not compose entry point.
     * - Comparison: always pair-shaped synastry between the two comparison snapshots.
     * - Group + exactly 2 natals (Community Feed expanded / pair-shaped group compose): `pair` — same
     *   primitive as comparison; transit/relational_weather is orthogonal (merged separately above).
     * - Group + 1 or 0 snapshots: skip (graceful; should not occur in production group compose).
     * - Group + ≥3 natals: `group_matrix` — full pairwise matrix, R1-ranked and capped inside the primitive.
     */
    const directedSynastry =
      input.kind === 'comparison'
        ? computeSynastryAspects({
            snapshotsOrdered: [input.snapLow, input.snapHigh],
            mode: 'pair',
          })
        : input.kind === 'group' && input.snapshotsOrdered.length === 2
          ? computeSynastryAspects({
              snapshotsOrdered: input.snapshotsOrdered,
              mode: 'pair',
            })
          : input.kind === 'group' && input.snapshotsOrdered.length >= 3
            ? computeSynastryAspects({
                snapshotsOrdered: input.snapshotsOrdered,
                mode: 'group_matrix',
              })
            : undefined;

    const legacySynastry =
      directedSynastry != null
        ? directedSynastry.map((r) => toLegacyPairInteractionAspect(r))
        : undefined;

    const comparisonSeekerContextV1 =
      input.kind === 'comparison' ? comparisonSeekerContextFromInput(input) : undefined;

    const canonicalReport = buildCanonicalReportForAggregate({
      kind: input.kind === 'comparison' ? 'comparison' : 'group',
      subject_ids: [payload.hash],
      participants,
      composite: featureVec,
      anchorIndex: 0,
      control_surface_hash: payload.hash,
      compose_seed: payload.hash,
      guidance: architecture.guidance,
      relationalWeather: input.relationalWeather ?? null,
      ...(legacySynastry != null ? { pair_interaction_aspects: legacySynastry } : {}),
      ...(directedSynastry != null ? { pair_interaction_aspects_v2: directedSynastry } : {}),
      ...(comparisonSeekerContextV1 != null
        ? { comparison_seeker_context_v1: comparisonSeekerContextV1 }
        : {}),
    });
    const semanticCore = interpretCanonicalReportObject(canonicalReport);
    const narrativePlan = buildCompositionNarrativePlan(payload, plan, semanticCore);
    const tier = parseExpansionTier((input as { expansionTier?: ExpansionTier }).expansionTier);
    const projectionSurface: ProjectionSurface = input.kind === 'comparison' ? 'compat_pair' : 'group';
    const participantCount = participants.length;
    const insightOptsAgg = insightProjectionOptionsFromCanonical(canonicalReport);
    const compatClassCodeAgg =
      input.kind === 'comparison' ? input.compatClassCode : undefined;

    let aggregateParticipantLabelsV1: AggregateParticipantLabelV1[] | undefined;
    if (input.kind === 'group') {
      const ids = input.chartIdsOrdered;
      if (ids && ids.length === input.snapshotsOrdered.length && ids.length > 0) {
        aggregateParticipantLabelsV1 = await resolveParticipantLabels(ids, {
          viewerChartId: input.viewerChartId,
          labelResolutionOwnerId: input.labelResolutionOwnerId,
        });
      }
    }

    const aggOutputKind = input.output_kind === 'feed_card' ? 'feed_card' : 'full';
    const labelOpts =
      aggregateParticipantLabelsV1 != null && aggregateParticipantLabelsV1.length > 0
        ? { aggregateParticipantLabelsV1 }
        : {};
    const suppressEnsembleFraming =
      input.kind === 'group' && input.suppressEnsembleFraming === true
        ? ({ suppressEnsembleFraming: true } as const)
        : {};
    const projected =
      aggOutputKind === 'feed_card'
        ? projectFeedCardFromSemanticCore(semanticCore, payload.hash, {
            ...insightOptsAgg,
            ...labelOpts,
            ...suppressEnsembleFraming,
            narrativePlan,
            aggregateKind: input.kind === 'comparison' ? 'comparison' : 'group',
            connectionMode: input.kind === 'comparison' ? input.relationshipMode : 'group',
            participantCount,
            aspectTension: typeof payload.aspect_tension === 'number' ? payload.aspect_tension : null,
            compatClassCode: compatClassCodeAgg,
          })
        : projectTextFromSemanticCore(semanticCore, payload.hash, {
            phaseD: true,
            surface: projectionSurface,
            tier,
            narrativePlan,
            aggregateKind: input.kind === 'comparison' ? 'comparison' : 'group',
            connectionMode: input.kind === 'comparison' ? input.relationshipMode : 'group',
            participantCount,
            aspectTension: typeof payload.aspect_tension === 'number' ? payload.aspect_tension : null,
            ...insightOptsAgg,
            ...labelOpts,
            ...suppressEnsembleFraming,
            compatClassCode: compatClassCodeAgg,
          });

    const signaturesText =
      projected.find(
        (s) =>
          s.id === 'aspects' ||
          s.id === 'group_key_interactions_v1' ||
          s.id === 'relational_field' ||
          s.id === 'signatures'
      )?.text || '';
    const significanceText = projected.find((s) => s.id === 'significance')?.text || '';
    const musicalSection = projected.find((s) => s.id === 'music_translation');
    const musicalText = musicalSection?.text || '';
    const musicalBullets = musicalSection?.bullets || [];
    /** Do not join all sections: `short` is already the signatures/relational_field block; joining every section repeated it in `long` (Community + feed UI). */
    const leadSectionIds = new Set(['signatures', 'aspects', 'relational_field', 'group_key_interactions_v1']);
    const longBody = projected
      .filter((s) => !leadSectionIds.has(s.id))
      .map((s) => s.text)
      .filter(Boolean)
      .join('\n\n');

    const summaryCandidates = [
      firstSentenceForSummary(projected.find((s) => s.id === 'relational_field')?.text || signaturesText),
      firstSentenceForSummary(projected.find((s) => s.id === 'interaction_map')?.text || ''),
      firstSentenceForSummary(
        projected.find((s) => s.id === 'contradiction_map')?.text ||
          projected.find((s) => s.id === 'synthesis_b')?.text ||
          ''
      ),
    ].filter((s) => s.length > 0);
    const compressedSummary = summaryCandidates.slice(0, 3).join(' ');

    const text = {
      short: compressedSummary,
      long: longBody,
      bullets: musicalBullets,
      template_id: input.relationalWeather ? 'semantic-core-aggregate-relational-v1' : 'semantic-core-aggregate-v1',
      signatures: signaturesText,
      significance: significanceText,
      musicalParagraph: musicalText,
      musicalBullets,
      relational_weather_v1: input.relationalWeather
        ? { stateHash: input.relationalWeather.stateHash, sectionId: 'relational_weather_v1' }
        : undefined,
    };

    const lyriaPromptProfile: LyriaPromptProfile | undefined = input.relationalWeather
      ? 'aggregate_relational_weather_v1'
      : undefined;

    const generateAudio = input.generateAudio === true;
    const wavBundle = generateAudio
      ? await runLyriaAlignedExportBlock(
          (buf, sec) => this.validateRenderedWavDuration(buf, sec),
          { plan, architecture, featureVec, payload, semanticCore, lyriaPromptProfile }
        )
      : {
          audio: { format: 'wav' as const, base64: '', sha256: '', latency_ms: 0, size_bytes: 0 },
          audio_export_available: false,
          export_attempted: false,
          export_error: 'export_not_attempted' as const,
        };

    const pvAgg = projected[projected.length - 1]?.meta?.projection_validation;
    const explanation = {
      spec: 'UnifiedSpecV1.1',
      sections: projected.map((s) => ({
        sectionId: s.id,
        title: s.title,
        text: s.text,
        bullets: s.bullets,
        ...(s.meta ? { meta: s.meta } : {}),
      })),
      meta: {
        canonical_object_hash: canonicalReport.object_identity_hash,
        phase_d: {
          surface: projectionSurface,
          tier: pvAgg?.tierEffective ?? tier,
          tierRequested: pvAgg?.tierRequested ?? tier,
          tierEffective: pvAgg?.tierEffective ?? tier,
          downgradedFrom: pvAgg?.downgradedFrom,
          projection_validation: pvAgg,
        },
        ...(input.kind === 'comparison' && canonicalReport.pair_interaction_aspects_v2 != null
          ? { assemblyVersion: 'compat_synastry_v2' as const }
          : {}),
      },
    };
    const planHash = computePlanHash(plan);
    const hashes = {
      control: 'sha256:' + this.sha256(JSON.stringify(payload)),
      audio: wavBundle.audio.sha256,
      explanation:
        'sha256:' + this.sha256(JSON.stringify(stripTaggedFromExplanationForHash(explanation as Record<string, unknown>))),
      plan_sha256: planHash,
    };

    return {
      compose_kind: input.kind === 'comparison' ? 'comparison_aggregate' : 'group_aggregate',
      plan,
      planHash,
      gateReport,
      text,
      explanation,
      audio: wavBundle.audio,
      hashes,
      audio_export_available: wavBundle.audio_export_available,
      export_id: wavBundle.export_id,
      export_attempted: wavBundle.export_attempted,
      export_error: wavBundle.export_error,
    };
  }

  /**
   * Explainer-only path for profile chart (no audio). Used by GET /api/profile/chart.
   * Phase C: `guidance` must be the same ArchitectureOutput.guidance used to build features/snapshot (no guidanceFromFeatures fork).
   */
  async getExplainerSectionsForFeatures(
    featureVec: FeatureVec,
    payload: ControlSurfacePayload,
    snapshot: EphemerisSnapshot,
    guidance: ArchitectureOutput['guidance']
  ): Promise<{
    spec: string;
    sections: Array<{ id: string; title: string; text: string; bullets?: string[]; meta?: unknown }>;
    object_identity_hash: string;
    plan_sha256: string;
    surface_kind: 'profile_natal';
    profile_contract_version: number;
    meta: { canonical_object_hash: string };
  }> {
    const { plan, diag } = await generatePlanMLOnly(featureVec, payload);
    if (!diag?.ml_used) {
      const err = new Error('ML inference unavailable') as Error & { code?: string };
      err.code = 'ML_INFERENCE_UNAVAILABLE';
      throw err;
    }
    await this.runAuditionGates(plan, payload.hash);
    const canonicalReport = buildCanonicalReportForSnapshotSurface({
      surface_kind: 'profile_natal',
      subject_ids: [payload.hash],
      snapshot,
      featureVec,
      control_surface_hash: payload.hash,
      compose_seed: payload.hash,
      guidance,
    });
    const semanticCore = interpretCanonicalReportObject(canonicalReport);
    const narrativePlan = buildCompositionNarrativePlan(payload, plan, semanticCore);
    const insightOptsExpl = insightProjectionOptionsFromCanonical(canonicalReport);
    const projected = projectTextFromSemanticCore(semanticCore, payload.hash, {
      phaseD: true,
      surface: 'profile',
      tier: 'baseline',
      narrativePlan,
      aspectTension: typeof payload.aspect_tension === 'number' ? payload.aspect_tension : null,
      snapshot,
      ...insightOptsExpl,
    });
    const object_identity_hash = canonicalReport.object_identity_hash;
    const plan_sha256 = computePlanHash(plan);
    return {
      spec: 'UnifiedSpecV1.1',
      sections: projected.map((s) => ({
        id: s.id,
        title: s.title,
        text: s.text,
        bullets: s.bullets,
        meta: s.meta,
      })),
      object_identity_hash,
      plan_sha256,
      surface_kind: 'profile_natal',
      profile_contract_version: 1,
      meta: { canonical_object_hash: object_identity_hash },
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
      const natalTz =
        typeof request.overlayParams.natalTimezone === 'string' && request.overlayParams.natalTimezone.trim()
          ? request.overlayParams.natalTimezone.trim()
          : undefined;
      const natalInput: ChartInput = {
        date: natalDate,
        time: (natalTimePart || '').slice(0, 5),
        lat: request.overlayParams.natalLatitude,
        lon: request.overlayParams.natalLongitude,
        ...(natalTz ? { timezone: natalTz } : {}),
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
      const seedRaw = typeof req.seed === 'string' ? req.seed.trim() : '';
      const seedLooksCanonicalAnchor = /^[a-f0-9]{64}$/.test(seedRaw);
      const useSeedPayload =
        req.overriddenSnapshot == null &&
        !!req.chartData &&
        seedLooksCanonicalAnchor &&
        (request.controls == null || Object.keys(request.controls).length === 0);
      const payload = useSeedPayload
        ? controlPayloadFromSeed(seedRaw)
        : await this.generateSandboxPayload(request.controls || {});
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
      const timePart = t ? t.replace(/Z$/i, '').slice(0, 5) : '';
      if (!d || !timePart) {
        throw new Error('Invalid skyParams.datetime; expected YYYY-MM-DDTHH:mm[:ss] with optional Z');
      }
      const skyTz =
        typeof req.skyParams.timezone === 'string' && req.skyParams.timezone.trim()
          ? req.skyParams.timezone.trim()
          : undefined;
      return { date: d, time: timePart, lat, lon, ...(skyTz ? { timezone: skyTz } : {}) };
    }

    if (req.mode === 'overlay' && req.overlayParams) {
      const dt = req.overlayParams.currentDatetime;
      const lat = req.overlayParams.currentLatitude;
      const lon = req.overlayParams.currentLongitude;
      const curTz =
        typeof req.overlayParams.currentTimezone === 'string' && req.overlayParams.currentTimezone.trim()
          ? req.overlayParams.currentTimezone.trim()
          : undefined;
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
      return { date: d, time: timePart, lat, lon, ...(curTz ? { timezone: curTz } : {}) };
    }

    if (req.chartData && typeof req.chartData.date === 'string' && typeof req.chartData.time === 'string') {
      const lat = req.chartData.lat;
      const lon = req.chartData.lon;
      const tz =
        typeof req.chartData.timezone === 'string' && req.chartData.timezone.trim()
          ? req.chartData.timezone.trim()
          : undefined;
      if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error('Invalid chartData: lat and lon must be provided as finite numbers');
      }
      return {
        date: String(req.chartData.date).slice(0, 10),
        time: String(req.chartData.time).slice(0, 5),
        lat,
        lon,
        ...(tz ? { timezone: tz } : {}),
      };
    }

    throw new Error('Invalid compose request: chart input (date, time, lat, lon) is required for this mode');
  }

  /**
   * Walk RIFF/WAVE chunks (no fixed `data` offset). Uses RIFF size field to bound the container and
   * classify truncation vs malformed scope. Bounded diagnostics only (no audio payload).
   */
  private parseWavPcmDataChunkMetrics(wavBuffer: Buffer): {
    ok: boolean;
    durationSec: number;
    reason?: string;
    sampleRate?: number;
    dataSize?: number;
    byteRate?: number;
    audioFormat?: number;
    diagnostics?: Record<string, unknown>;
  } {
    const MAX_CHUNKS = 4096;
    const MAX_CHUNK_BODY_BYTES = 256 * 1024 * 1024;
    const MAX_CHUNK_SAMPLES = 5;

    const buildDiag = (
      base: {
        buffer_length: number;
        riff_size_field: number;
        riff_expected_end: number;
        buffer_shorter_than_riff_declared: boolean;
        walk_end_exclusive: number;
        chunk_samples: Array<{ id: string; size: number; offset: number }>;
        failure_offset: number;
        found_fmt: boolean;
        found_data: boolean;
        parse_reason: string;
      },
      extra?: Record<string, unknown>
    ): Record<string, unknown> => ({ ...base, ...(extra || {}) });

    if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length < 12) {
      return {
        ok: false,
        durationSec: 0,
        reason: 'buffer_too_short',
        diagnostics: buildDiag({
          buffer_length: wavBuffer?.length ?? 0,
          riff_size_field: 0,
          riff_expected_end: 0,
          buffer_shorter_than_riff_declared: false,
          walk_end_exclusive: 0,
          chunk_samples: [],
          failure_offset: 0,
          found_fmt: false,
          found_data: false,
          parse_reason: 'buffer_too_short',
        }),
      };
    }
    if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF' || wavBuffer.toString('ascii', 8, 12) !== 'WAVE') {
      return {
        ok: false,
        durationSec: 0,
        reason: 'not_riff_wave',
        diagnostics: buildDiag({
          buffer_length: wavBuffer.length,
          riff_size_field: 0,
          riff_expected_end: 0,
          buffer_shorter_than_riff_declared: false,
          walk_end_exclusive: 0,
          chunk_samples: [],
          failure_offset: 0,
          found_fmt: false,
          found_data: false,
          parse_reason: 'not_riff_wave',
        }),
      };
    }

    const riffSizeField = wavBuffer.readUInt32LE(4);
    const riffExpectedEnd = 8 + riffSizeField;
    const bufferShorterThanRiff = wavBuffer.length < riffExpectedEnd;
    const walkEndExclusive = Math.min(wavBuffer.length, riffExpectedEnd);

    const chunkSamples: Array<{ id: string; size: number; offset: number }> = [];
    let sampleRate = 0;
    let byteRate = 0;
    let blockAlign = 0;
    let audioFormat = 0;
    let haveFmt = false;
    let dataSize = 0;
    let foundData = false;
    let i = 12;
    let chunkIndex = 0;

    const fail = (
      reason: string,
      failureOffset: number,
      extra?: Record<string, unknown>
    ): {
      ok: false;
      durationSec: number;
      reason: string;
      diagnostics: Record<string, unknown>;
    } => ({
      ok: false,
      durationSec: 0,
      reason,
      diagnostics: buildDiag(
        {
          buffer_length: wavBuffer.length,
          riff_size_field: riffSizeField,
          riff_expected_end: riffExpectedEnd,
          buffer_shorter_than_riff_declared: bufferShorterThanRiff,
          walk_end_exclusive: walkEndExclusive,
          chunk_samples: chunkSamples.slice(0, MAX_CHUNK_SAMPLES),
          failure_offset: failureOffset,
          found_fmt: haveFmt,
          found_data: foundData,
          parse_reason: reason,
        },
        { chunk_index: chunkIndex, ...(extra || {}) }
      ),
    });

    while (i < walkEndExclusive && chunkIndex < MAX_CHUNKS) {
      if (i + 8 > wavBuffer.length) {
        return fail(
          bufferShorterThanRiff ? 'truncated_at_chunk_header' : 'unexpected_eof_at_chunk_header',
          i
        );
      }
      if (i + 8 > walkEndExclusive) {
        return fail('chunk_header_past_riff_scope', i);
      }

      const chunkId = wavBuffer.toString('ascii', i, i + 4).replace(/[^\x20-\x7e]/g, '?');
      const chunkSize = wavBuffer.readUInt32LE(i + 4);
      if (chunkSamples.length < MAX_CHUNK_SAMPLES) {
        chunkSamples.push({ id: chunkId, size: chunkSize, offset: i });
      }

      if (chunkSize > MAX_CHUNK_BODY_BYTES) {
        return fail('chunk_size_implausible', i, { chunk_id: chunkId });
      }

      const bodyStart = i + 8;
      const bodyEnd = bodyStart + chunkSize;

      if (bodyEnd > wavBuffer.length) {
        return fail(
          bufferShorterThanRiff ? 'truncated_mid_chunk' : 'chunk_body_past_buffer_end',
          i,
          { chunk_id: chunkId, declared_body_end: bodyEnd }
        );
      }
      if (!bufferShorterThanRiff && bodyEnd > riffExpectedEnd) {
        return fail('chunk_extends_past_riff_container', i, {
          chunk_id: chunkId,
          declared_body_end: bodyEnd,
        });
      }

      if (chunkId === 'fmt ') {
        if (chunkSize < 16) {
          return fail('fmt_too_small', i);
        }
        audioFormat = wavBuffer.readUInt16LE(bodyStart);
        sampleRate = wavBuffer.readUInt32LE(bodyStart + 4);
        byteRate = wavBuffer.readUInt32LE(bodyStart + 8);
        blockAlign = wavBuffer.readUInt16LE(bodyStart + 12);
        haveFmt = true;
      } else if (chunkId === 'data') {
        dataSize = chunkSize;
        foundData = true;
      }

      i = bodyEnd + (chunkSize % 2);
      chunkIndex++;
    }

    if (chunkIndex >= MAX_CHUNKS) {
      return fail('too_many_chunks', i);
    }

    if (!haveFmt) {
      return fail(bufferShorterThanRiff ? 'truncated_missing_fmt' : 'missing_fmt', i);
    }
    if (audioFormat !== 1) {
      return {
        ok: false,
        durationSec: 0,
        reason: 'not_pcm',
        audioFormat,
        diagnostics: buildDiag(
          {
            buffer_length: wavBuffer.length,
            riff_size_field: riffSizeField,
            riff_expected_end: riffExpectedEnd,
            buffer_shorter_than_riff_declared: bufferShorterThanRiff,
            walk_end_exclusive: walkEndExclusive,
            chunk_samples: chunkSamples.slice(0, MAX_CHUNK_SAMPLES),
            failure_offset: i,
            found_fmt: true,
            found_data: foundData,
            parse_reason: 'not_pcm',
          },
          { audio_format: audioFormat }
        ),
      };
    }
    if (!foundData || dataSize <= 0) {
      return fail(bufferShorterThanRiff ? 'truncated_missing_data' : 'missing_data', i);
    }

    const effectiveByteRate =
      byteRate > 0 && Number.isFinite(byteRate)
        ? byteRate
        : sampleRate > 0 && blockAlign > 0
          ? sampleRate * blockAlign
          : 0;
    if (!effectiveByteRate || !Number.isFinite(effectiveByteRate)) {
      return {
        ok: false,
        durationSec: 0,
        reason: 'invalid_byte_rate',
        sampleRate,
        dataSize,
        byteRate,
        audioFormat,
        diagnostics: buildDiag(
          {
            buffer_length: wavBuffer.length,
            riff_size_field: riffSizeField,
            riff_expected_end: riffExpectedEnd,
            buffer_shorter_than_riff_declared: bufferShorterThanRiff,
            walk_end_exclusive: walkEndExclusive,
            chunk_samples: chunkSamples.slice(0, MAX_CHUNK_SAMPLES),
            failure_offset: i,
            found_fmt: true,
            found_data: true,
            parse_reason: 'invalid_byte_rate',
          },
          { sample_rate: sampleRate, data_size: dataSize }
        ),
      };
    }
    const durationSec = dataSize / effectiveByteRate;
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return {
        ok: false,
        durationSec: 0,
        reason: 'invalid_duration_compute',
        sampleRate,
        dataSize,
        byteRate: effectiveByteRate,
        audioFormat,
        diagnostics: buildDiag(
          {
            buffer_length: wavBuffer.length,
            riff_size_field: riffSizeField,
            riff_expected_end: riffExpectedEnd,
            buffer_shorter_than_riff_declared: bufferShorterThanRiff,
            walk_end_exclusive: walkEndExclusive,
            chunk_samples: chunkSamples.slice(0, MAX_CHUNK_SAMPLES),
            failure_offset: i,
            found_fmt: true,
            found_data: true,
            parse_reason: 'invalid_duration_compute',
          },
          { sample_rate: sampleRate, data_size: dataSize, byte_rate: effectiveByteRate }
        ),
      };
    }
    return {
      ok: true,
      durationSec,
      sampleRate,
      dataSize,
      byteRate: effectiveByteRate,
      audioFormat,
    };
  }

  private validateRenderedWavDuration(
    wavBuffer: Buffer,
    expectedDurationSec: number
  ): {
    valid: boolean;
    durationSec: number;
    reason?: string;
    details?: Record<string, number>;
    contractMinS: number;
    contractMaxS: number;
    targetDurationS: number;
    wavParse?: Record<string, unknown>;
  } {
    const LYRIA_EXPORT_DURATION_MIN_S = 27;
    const LYRIA_EXPORT_DURATION_MAX_S = 40;

    const parsed = this.parseWavPcmDataChunkMetrics(wavBuffer);
    if (!parsed.ok) {
      return {
        valid: false,
        durationSec: parsed.durationSec,
        reason: parsed.reason,
        details: {
          ...(parsed.sampleRate != null ? { sample_rate: parsed.sampleRate } : {}),
          ...(parsed.dataSize != null ? { data_size: parsed.dataSize } : {}),
          ...(parsed.byteRate != null ? { byte_rate: parsed.byteRate } : {}),
          ...(parsed.audioFormat != null ? { audio_format: parsed.audioFormat } : {}),
        },
        contractMinS: LYRIA_EXPORT_DURATION_MIN_S,
        contractMaxS: LYRIA_EXPORT_DURATION_MAX_S,
        targetDurationS: expectedDurationSec,
        wavParse: parsed.diagnostics,
      };
    }
    const d = parsed.durationSec;
    const valid = d >= LYRIA_EXPORT_DURATION_MIN_S && d <= LYRIA_EXPORT_DURATION_MAX_S;
    return {
      valid,
      durationSec: d,
      reason: valid ? undefined : 'duration_out_of_contract',
      details: {
        sample_rate: parsed.sampleRate!,
        data_size: parsed.dataSize!,
        byte_rate: parsed.byteRate!,
      },
      contractMinS: LYRIA_EXPORT_DURATION_MIN_S,
      contractMaxS: LYRIA_EXPORT_DURATION_MAX_S,
      targetDurationS: expectedDurationSec,
    };
  }

  /**
   * Sandbox lab: validate overriddenSnapshot shape (EphemerisSnapshot from POST /api/sandbox/snapshot).
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
/** Singleton for compose + aggregate surfaces (runAggregateComposition). Do not duplicate. */
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
    if (code === 'HASH_MISMATCH') {
      res.status(422).json({
        error: error?.message || 'HASH_MISMATCH',
        code: 'HASH_MISMATCH',
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
