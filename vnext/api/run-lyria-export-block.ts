/**
 * Shared Lyria / provider WAV export path for snapshot and aggregate composition.
 * Single implementation so aggregate export policy cannot diverge from snapshot.
 */

import { createHash } from 'crypto';
import type { Plan, FeatureVec } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';
import type { ArchitectureOutput } from '../core/architecture-engine';
import type { SemanticCore } from '../semantic/semantic-core';
import { DEFAULT_DURATION_S } from '../constants';
import { renderWithProvider, buildLyriaPrompt, getProvider, localWavProvider, isProductionOrPreview } from '../render';
import type { LyriaPromptProfile } from '../render/prompt-from-controls';
import {
  computeExportKey,
  hashPrompt,
  getCachedWav,
  writeExport,
  readIntegrity,
  type IntegrityMeta,
} from '../render/export-cache';
import { computePlanHash } from '../plan-hash';
import { buildCompositionNarrativePlan } from '../audio/composition-narrative';
import { applyEndingPolish } from '../audio/ending-polish';

export type ExportErrorCode =
  | 'export_disabled'
  | 'export_not_attempted'
  | 'storage_unavailable'
  | 'render_failed'
  | 'lyria_recitation_blocked'
  | 'provider_not_configured'
  | 'invalid_duration'
  | 'incomplete_wav_payload';

export type LyriaExportAudio = {
  format: 'wav';
  base64: string;
  sha256: string;
  latency_ms: number;
  size_bytes: number;
};

export type LyriaExportBundle = {
  audio: LyriaExportAudio;
  audio_export_available: boolean;
  export_id?: string;
  export_meta?: {
    provider: string;
    modelVersion: string;
    promptHash: string;
    payload_hash: string;
    duration_s: number;
    sha256: string;
  };
  export_attempted: boolean;
  export_error: ExportErrorCode | null;
  audioDebug?: Record<string, unknown>;
};

type ValidateWavFn = (
  wavBuffer: Buffer,
  expectedDurationSec: number
) => {
  valid: boolean;
  durationSec: number;
  reason?: string;
  details?: Record<string, number>;
  contractMinS: number;
  contractMaxS: number;
  targetDurationS: number;
  wavParse?: Record<string, unknown>;
};

export async function runLyriaAlignedExportBlock(
  validateRenderedWavDuration: ValidateWavFn,
  params: {
    plan: Plan;
    architecture: ArchitectureOutput;
    featureVec: FeatureVec;
    payload: ControlSurfacePayload;
    semanticCore: SemanticCore;
    /** When set, Lyria integer seed is derived with server object_identity_hash (profile natal identity audio only). */
    lyriaProfileNatalIdentity?: { objectIdentityHash: string };
    /** Optional Lyria prompt conditioning profile (aggregate relational weather only). */
    lyriaPromptProfile?: LyriaPromptProfile;
  }
): Promise<LyriaExportBundle> {
  const { plan, architecture, featureVec, payload, semanticCore, lyriaProfileNatalIdentity, lyriaPromptProfile } =
    params;
  const wavExportEnabled = process.env.ENABLE_WAV_EXPORT === '1';

  const stubAudio: LyriaExportAudio = {
    format: 'wav',
    base64: '',
    sha256: '',
    latency_ms: 0,
    size_bytes: 0,
  };

  let audio: LyriaExportAudio = { ...stubAudio };
  let audio_export_available = false;
  let export_id: string | undefined;
  let export_meta: LyriaExportBundle['export_meta'];
  let export_attempted = false;
  let export_error: ExportErrorCode | null = wavExportEnabled ? null : 'export_disabled';
  let audioDebug: Record<string, unknown> | undefined;

  const store = (process as any).__astradio_export_store as
    | { get?: (k: string) => Promise<Buffer | null>; put?: (k: string, buf: Buffer, meta: IntegrityMeta) => Promise<void> }
    | undefined;

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
      const narrativePlan = buildCompositionNarrativePlan(payload, plan, semanticCore);
      prompt = buildLyriaPrompt(payload, plan, narrativePlan, lyriaPromptProfile ?? 'default');
      promptHash = hashPrompt(prompt);
      if (
        lyriaProfileNatalIdentity &&
        typeof lyriaProfileNatalIdentity.objectIdentityHash === 'string' &&
        lyriaProfileNatalIdentity.objectIdentityHash.length > 0
      ) {
        const objectIdentityHash = lyriaProfileNatalIdentity.objectIdentityHash.trim();
        const seedPreimage = [planHash, objectIdentityHash, 'lyria_profile_identity_v2'].join('\n');
        lyriaSeed = createHash('sha256').update(Buffer.from(seedPreimage, 'utf8')).digest('hex');
      } else {
        lyriaSeed = planHash + ':phase3';
      }
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
          size_bytes: cached.length,
        };
        export_id = exportKey;
        export_meta = integrity
          ? {
              provider: integrity.provider,
              modelVersion: integrity.modelVersion,
              promptHash: integrity.promptHash,
              payload_hash: integrity.payload_hash,
              duration_s: integrity.duration_s,
              sha256: integrity.sha256,
            }
          : undefined;
        audio_export_available = true;
        console.log('[COMPOSE_EXPORT] cache_hit exportKey=', exportKey.slice(0, 16) + '...');
      } else {
        exportStep = 'render';
        if (
          lyriaProfileNatalIdentity &&
          typeof lyriaProfileNatalIdentity.objectIdentityHash === 'string' &&
          lyriaProfileNatalIdentity.objectIdentityHash.trim().length > 0
        ) {
          const objectIdentityHash = lyriaProfileNatalIdentity.objectIdentityHash.trim();
          try {
            console.log(
              '[LYRIA_SEED_MODE]',
              JSON.stringify({
                mode: 'identity_v2',
                planHash: planHash.slice(0, 12),
                objectIdentityHash: objectIdentityHash.slice(0, 12),
              })
            );
          } catch {
            /* logging must not break export */
          }
        }
        const result = await renderWithProvider({
          prompt,
          seed: lyriaSeed,
          duration_s: DEFAULT_DURATION_S,
          plan,
          payload,
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
        const durationCheck = validateRenderedWavDuration(wavToStore, DEFAULT_DURATION_S);
        if (!durationCheck.valid) {
          export_error = 'invalid_duration';
          audio_export_available = false;
          audioDebug = {
            export_failure: 'B',
            step: 'render',
            code: 'INVALID_WAV_DURATION',
            reason: durationCheck.reason ?? 'unknown',
            message: durationCheck.reason
              ? `Rendered WAV rejected (${durationCheck.reason}): ${durationCheck.durationSec.toFixed(3)}s`
              : `Rendered WAV duration out of contract: ${durationCheck.durationSec.toFixed(3)}s`,
            measured_duration_s: durationCheck.durationSec,
            duration_contract_min_s: durationCheck.contractMinS,
            duration_contract_max_s: durationCheck.contractMaxS,
            target_duration_s: durationCheck.targetDurationS,
            ...(durationCheck.details ?? {}),
            ...(durationCheck.wavParse != null ? { wav_parse: durationCheck.wavParse } : {}),
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
          duration_s: DEFAULT_DURATION_S,
        };
        // Inline audio may be present before store write; do NOT set export_id / export_meta
        // / audio_export_available until store.put or writeExport completes successfully
        // (strict write contract — no ghost export ids for identity / GET /api/exports/:id).
        audio = {
          format: 'wav',
          base64: wavToStore.toString('base64'),
          sha256: sha256ToUse,
          latency_ms: Number((process.hrtime.bigint() - audioStartTime) / BigInt(1_000_000)),
          size_bytes: sizeBytesToUse,
        };
        exportStep = 'store';
        try {
          if (store?.put) {
            await store.put(exportKey, wavToStore, integrity);
            console.log('[COMPOSE_EXPORT] store_put_ok exportKey=', exportKey.slice(0, 16) + '...');
          } else {
            writeExport(exportKey, wavToStore, integrity);
            console.log('[COMPOSE_EXPORT] writeExport_ok exportKey=', exportKey.slice(0, 16) + '...');
          }
          export_id = exportKey;
          export_meta = {
            provider: integrity.provider,
            modelVersion: integrity.modelVersion,
            promptHash: integrity.promptHash,
            payload_hash: integrity.payload_hash,
            duration_s: integrity.duration_s,
            sha256: integrity.sha256,
          };
          audio_export_available = true;
        } catch (storeErr) {
          console.warn(
            '[COMPOSE_EXPORT] store/write failed (no durable export_id; returning inline audio only):',
            storeErr instanceof Error ? storeErr.message : String(storeErr)
          );
          export_error = 'storage_unavailable';
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
            payload,
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
              duration_s: DEFAULT_DURATION_S,
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
              duration_s: DEFAULT_DURATION_S,
            });
          }
          const fbStart = process.hrtime.bigint();
          audio = {
            format: 'wav',
            base64: fallbackResult.wavBuffer.toString('base64'),
            sha256: fallbackResult.sha256,
            latency_ms: Number((process.hrtime.bigint() - fbStart) / BigInt(1_000_000)),
            size_bytes: fallbackResult.size_bytes,
          };
          export_id = fallbackExportKey;
          export_meta = {
            provider: 'local_wav',
            modelVersion: 'local-v1',
            promptHash,
            payload_hash: payload.hash,
            duration_s: DEFAULT_DURATION_S,
            sha256: fallbackResult.sha256,
          };
          export_error = null;
          audio_export_available = true;
          fallbackSucceeded = true;
          console.log('[COMPOSE_EXPORT] dev-only fallback local_wav exportKey=', fallbackExportKey.slice(0, 16) + '...');
        } catch (fallbackErr) {
          console.log(
            '[COMPOSE_EXPORT] local_wav fallback failed:',
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
          );
        }
      }
      if (!fallbackSucceeded) {
        if (code === 'INCOMPLETE_WAV_PAYLOAD') {
          export_error = 'incomplete_wav_payload';
        } else if (code === 'LYRIA_RECITATION_BLOCKED') {
          export_error = 'lyria_recitation_blocked';
        } else if (export_error == null) {
          if (exportStep === 'provider') export_error = 'provider_not_configured';
          else if (exportStep === 'render') export_error = 'render_failed';
          else export_error = 'storage_unavailable';
        }
        const failureClass = exportStep === 'store' ? 'C' : 'B';
        const errReason = (err as Error & { reason?: string }).reason;
        const errStatus = (err as Error & { statusCode?: number }).statusCode;
        const catchDebug: Record<string, unknown> = {
          export_failure: failureClass,
          step: exportStep,
          message: err.message,
          ...(code ? { code } : {}),
          ...(typeof errStatus === 'number' ? { lyria_status_code: errStatus } : {}),
          ...(code === 'INCOMPLETE_WAV_PAYLOAD'
            ? { reason: typeof errReason === 'string' && errReason ? errReason : 'provider_payload_truncated' }
            : {}),
        };
        if (
          export_error === 'invalid_duration' &&
          audioDebug &&
          typeof audioDebug === 'object' &&
          (audioDebug as { code?: string }).code === 'INVALID_WAV_DURATION'
        ) {
          Object.assign(audioDebug as object, catchDebug);
        } else {
          audioDebug = catchDebug;
        }
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

  if (lyriaProfileNatalIdentity) {
    try {
      const ad = audioDebug;
      const ly400 =
        (ad &&
          typeof ad === 'object' &&
          (ad as { lyria_status_code?: number }).lyria_status_code === 400) ||
        (ad && typeof ad === 'object' && /Lyria API error:\s*400/i.test(String((ad as { message?: string }).message || '')));
      console.log(
        '[LYRIA_IDENTITY_EXPORT]',
        JSON.stringify({
          seed_mode: 'profile_natal',
          export_id: export_id ?? null,
          audio_export_available,
          export_error: export_error ?? null,
          lyria_http_400: Boolean(ly400),
        })
      );
    } catch {
      /* logging must not break export */
    }
  }

  return {
    audio,
    audio_export_available,
    export_id,
    export_meta,
    export_attempted,
    export_error,
    audioDebug,
  };
}
