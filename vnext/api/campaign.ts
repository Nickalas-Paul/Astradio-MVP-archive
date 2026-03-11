import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { generateArchitectureFromSnapshot } from '../core/architecture-engine';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildChartSemanticProfile } from '../interpretation/chart-semantic-profile';
import { buildCharacterProfile } from '../rpg/character-builder';
import { buildTransitPressureMap } from '../rpg/transit-pressure-map';
import { buildChallengeScene } from '../rpg/challenge-generator';
import { buildChallengeOutcome } from '../rpg/reflection-mapper';
import { getOrCreateRpgProfileForChart, getOrCreateCampaign, getCampaignById, updateCampaignState } from '../rpg/store/rpg-store';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import type { CampaignState } from '../rpg/types';
import { hashSnapshot } from '../rpg/hash/snapshot-hash';
import {
  normalizeCampaignEntrySelection,
  type CampaignEntrySelection,
  type CampaignEntryContext,
} from '../rpg/campaign-entry';
import { rowToCampaignStateContainer } from '../rpg/campaign-state';
import { resolveCampaignAudioMode } from '../rpg/campaign-audio-policy';

type Express = typeof import('express');

let expressMod: Express | null = null;
function loadExpress(): Express {
  if (!expressMod) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    expressMod = require('express') as Express;
  }
  return expressMod;
}

interface CharacterRequestBody {
  natalSnapshot: EphemerisSnapshot;
  featureVec?: FeatureVec;
}

interface DailyChallengeRequestBody {
  campaignId: string;
  natalSnapshot: EphemerisSnapshot;
  transitSnapshot: EphemerisSnapshot;
  /** Pass 4 — optional; default 'free'. Drives audio resolution (daily vs challenge soundtrack). */
  userTier?: 'free' | 'paid';
}

interface CampaignEntryRequestBody extends CampaignEntrySelection {}

/** Pass 2 — Resolve campaign by owner key; returns deterministic campaign container. */
interface CampaignResolveRequestBody {
  userId: string;
  chartId: string;
  natalSnapshot: EphemerisSnapshot;
}

import type { ChallengeScene } from '../rpg/types';

interface ResolveChoiceRequestBody {
  campaignId: string;
  natalSnapshot: EphemerisSnapshot;
  transitSnapshot: EphemerisSnapshot;
  scene: any;
  choiceId: string;
}

export function createCampaignRouter(): import('express').Router {
  const express = loadExpress();
  const router = express.Router({ mergeParams: true });

  /**
   * Campaign Entry Surface
   *
   * Purpose:
   * Normalize player entry into Campaign before any gameplay logic runs.
   *
   * Responsibilities:
   * • validate entry selection
   * • normalize party membership
   * • establish deterministic seedMemberUserIds (lexicographic order)
   *
   * Non-responsibilities:
   * • character generation
   * • challenge generation
   * • audio policy
   * • party scoring
   *
   * Pipeline compatibility (no transformation required):
   * • Solo: entry.userId is the campaign owner; use with getOrCreateCampaign(userId, chartId, ...).
   * • /campaign/character is chart-scoped (no campaignId); client uses same userId.
   * • /campaign/daily-challenge and /campaign/resolve-choice take campaignId from that campaign.
   * • seedMemberUserIds[0] for solo equals entry.userId; for group it is the deterministic member set.
   */
  router.post(
    '/campaign/entry',
    async (req: import('express').Request, res: import('express').Response) => {
      try {
        const body: CampaignEntryRequestBody = (req.body || {}) as any;
        const entry: CampaignEntryContext = normalizeCampaignEntrySelection({
          userId: body.userId,
          mode: body.mode,
          formationMode: body.formationMode,
          selectedMemberUserIds: body.selectedMemberUserIds,
        });

        return res.status(200).json({ entry });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to normalize campaign entry selection';
        // eslint-disable-next-line no-console
        console.error('[campaign] POST /campaign/entry error:', msg);
        return res.status(400).json({ error: msg });
      }
    }
  );

  /**
   * Campaign Resolve (Pass 2)
   * Deterministic get-or-create campaign by (userId, chartId). Returns campaign container.
   * Fails with 400 if userId, chartId, or natalSnapshot missing. Prevents duplicate campaigns.
   *
   * Single creation rule: Only POST /campaign/resolve may create campaigns. All other campaign
   * endpoints require an existing campaignId: /campaign/character is chart-scoped (no campaign);
   * /campaign/daily-challenge and /campaign/resolve-choice use getCampaignById(campaignId) only.
   */
  router.post(
    '/campaign/resolve',
    async (req: import('express').Request, res: import('express').Response) => {
      try {
        const body: CampaignResolveRequestBody = (req.body || {}) as any;
        const userId = body.userId;
        const chartId = body.chartId;
        const natalSnapshot = body.natalSnapshot;

        if (!userId || typeof userId !== 'string' || !userId.trim()) {
          return res.status(400).json({ error: 'userId required' });
        }
        if (!chartId || typeof chartId !== 'string' || !chartId.trim()) {
          return res.status(400).json({ error: 'chartId required' });
        }
        if (!natalSnapshot || typeof natalSnapshot !== 'object') {
          return res.status(400).json({ error: 'natalSnapshot required' });
        }

        const profile = await getOrCreateRpgProfileForChart({
          userId,
          chartId,
          snapshot: natalSnapshot,
        });
        const bundle = buildRpgEffectsBundleFromSnapshot(natalSnapshot);
        const initialState = initialCampaignState(bundle);

        const campaign = await getOrCreateCampaign({
          userId,
          chartId,
          bundleHash: profile.bundle_hash,
          rpgMapVersion: profile.rpg_map_version,
          rpgAlgoVersion: 'rpg-v1',
          audioAlgoVersion: 'audio-v1',
          initialStateJson: initialState,
        });

        return res.status(200).json({
          campaign: rowToCampaignStateContainer(campaign),
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to resolve campaign';
        // eslint-disable-next-line no-console
        console.error('[campaign] POST /campaign/resolve error:', msg);
        const isValidation = msg === 'userId required' || msg === 'chartId required';
        return res.status(isValidation ? 400 : 500).json({ error: msg });
      }
    }
  );

  router.post(
    '/campaign/character',
    async (req: import('express').Request, res: import('express').Response) => {
      try {
        const body: CharacterRequestBody = req.body || {};
        const natalSnapshot = body.natalSnapshot;
        if (!natalSnapshot || typeof natalSnapshot !== 'object') {
          return res.status(400).json({ error: 'natalSnapshot required' });
        }

        const arch = await generateArchitectureFromSnapshot(natalSnapshot, hashSnapshot(natalSnapshot));
        const semanticProfile = arch.semanticProfile ?? buildChartSemanticProfile({
          snapshot: arch.snapshot,
          featureVec: arch.features,
          guidance: arch.guidance as any,
        });

        const bundle = buildRpgEffectsBundleFromSnapshot(arch.snapshot);
        const character = buildCharacterProfile({
          natalSnapshot: arch.snapshot,
          featureVec: arch.features,
          semanticProfile,
          effectsBundle: bundle,
        });

        return res.status(200).json({
          character,
          bundle: {
            classSlug: bundle.classSlug,
            subclassSlug: bundle.subclassSlug,
            risingModifierSlug: bundle.risingModifierSlug,
            domainSummary: bundle.domainSummary,
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to build campaign character';
        // eslint-disable-next-line no-console
        console.error('[campaign] POST /campaign/character error:', msg);
        return res.status(500).json({ error: msg });
      }
    }
  );

  /**
   * Daily challenge (Pass 3 idempotence).
   * Thin wrapper: reads campaign state, builds character/pressures from body, calls buildChallengeScene, returns { scene, characterId }.
   * No DB writes, no timestamps or non-deterministic metadata in the response.
   * Same campaignId + same (natalSnapshot, transitSnapshot) body + same campaign state → same challenge payload.
   * transitSnapshot.ts is client-provided; client must send a stable snapshot for the intended challenge window to get idempotent results.
   */
  router.post(
    '/campaign/daily-challenge',
    async (req: import('express').Request, res: import('express').Response) => {
      try {
        const body: DailyChallengeRequestBody = req.body || ({} as any);
        const { campaignId, natalSnapshot, transitSnapshot } = body;
        if (!campaignId || typeof campaignId !== 'string') {
          return res.status(400).json({ error: 'campaignId required' });
        }
        if (!natalSnapshot || !transitSnapshot) {
          return res.status(400).json({ error: 'natalSnapshot and transitSnapshot required' });
        }

        const campaign = await getCampaignById(campaignId);
        if (!campaign) {
          return res.status(404).json({ error: `Campaign not found: ${campaignId}` });
        }

        const arch = await generateArchitectureFromSnapshot(natalSnapshot, hashSnapshot(natalSnapshot));
        const semanticProfile = arch.semanticProfile ?? buildChartSemanticProfile({
          snapshot: arch.snapshot,
          featureVec: arch.features,
          guidance: arch.guidance as any,
        });
        const bundle = buildRpgEffectsBundleFromSnapshot(arch.snapshot);
        const character = buildCharacterProfile({
          natalSnapshot: arch.snapshot,
          featureVec: arch.features,
          semanticProfile,
          effectsBundle: bundle,
        });

        const pressures = buildTransitPressureMap({
          natalSnapshot,
          transitSnapshot,
        });

        const state = (campaign.state_json || {}) as CampaignState;
        const scene = buildChallengeScene({
          character,
          pressures,
          state,
          semanticProfile,
          natalSnapshot,
          transitSnapshot,
        });

        // userTier currently accepted from request body for testing. Production behavior should derive user tier from authenticated user context.
        const userTier = body.userTier === 'paid' ? 'paid' : 'free';
        const audio = resolveCampaignAudioMode({
          userTier,
          challengeScene: scene,
          campaignId,
        });

        return res.status(200).json({
          scene,
          characterId: character.id,
          audio: {
            mode: audio.mode,
            ...(audio.audioContextId != null && { audioContextId: audio.audioContextId }),
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to build daily challenge';
        // eslint-disable-next-line no-console
        console.error('[campaign] POST /campaign/daily-challenge error:', msg);
        return res.status(500).json({ error: msg });
      }
    }
  );

  router.post(
    '/campaign/resolve-choice',
    async (req: import('express').Request, res: import('express').Response) => {
      try {
        const body: ResolveChoiceRequestBody = req.body || ({} as any);
        const { campaignId, natalSnapshot, transitSnapshot, scene, choiceId } = body;
        if (!campaignId || typeof campaignId !== 'string') {
          return res.status(400).json({ error: 'campaignId required' });
        }
        if (!natalSnapshot || !transitSnapshot) {
          return res.status(400).json({ error: 'natalSnapshot and transitSnapshot required' });
        }
        if (!scene || typeof scene !== 'object') {
          return res.status(400).json({ error: 'scene required' });
        }
        if (!choiceId || typeof choiceId !== 'string') {
          return res.status(400).json({ error: 'choiceId required' });
        }

        const campaign = await getCampaignById(campaignId);
        if (!campaign) {
          return res.status(404).json({ error: `Campaign not found: ${campaignId}` });
        }

        const castScene = scene as ChallengeScene;
        const choice = (castScene.choices || []).find((c: any) => c.id === choiceId);
        if (!choice) {
          return res.status(400).json({ error: `choiceId not found in scene.choices` });
        }

        const outcome = buildChallengeOutcome({
          scene: castScene,
          choice,
          natalSnapshot,
          transitSnapshot,
        });

        const nextState: CampaignState = {
          ...(campaign.state_json || {}),
          chapter: (campaign.state_json?.chapter ?? 1) + 1,
        } as CampaignState;

        await updateCampaignState({
          campaignId,
          newStateJson: nextState,
          newStateHash: hashSnapshot(natalSnapshot),
        });

        return res.status(200).json({
          outcome,
          newState: nextState,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to resolve campaign choice';
        // eslint-disable-next-line no-console
        console.error('[campaign] POST /campaign/resolve-choice error:', msg);
        return res.status(500).json({ error: msg });
      }
    }
  );

  return router;
}

