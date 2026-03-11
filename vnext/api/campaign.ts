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
}

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

        return res.status(200).json({
          scene,
          characterId: character.id,
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
        const choice = (castScene.choices || []).find((c) => c.id === choiceId);
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

