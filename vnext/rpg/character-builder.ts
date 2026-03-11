import { buildAstroProfile } from '../astro/profile-from-snapshot';
import type { FeatureVec } from '../contracts';
import type { ChartSemanticProfile } from '../interpretation/chart-semantic-profile';
import type { RPGEffectsBundle } from './contracts';
import type { CharacterProfile, CharacterTemperamentAxes } from './types';
import { hashSnapshot } from './hash/snapshot-hash';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function normalizeVector(values: Record<keyof CharacterTemperamentAxes, number>): CharacterTemperamentAxes {
  const max = Math.max(
    0.0001,
    ...Object.values(values)
  );
  const out: any = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = max > 0 ? clamp01(v / max) : 0;
  }
  return out as CharacterTemperamentAxes;
}

export interface BuildCharacterProfileParams {
  natalSnapshot: Parameters<typeof buildAstroProfile>[0];
  featureVec: FeatureVec;
  semanticProfile: ChartSemanticProfile;
  effectsBundle: RPGEffectsBundle;
}

export function buildCharacterProfile(params: BuildCharacterProfileParams): CharacterProfile {
  const { natalSnapshot, featureVec, semanticProfile, effectsBundle } = params;

  const astro = buildAstroProfile(natalSnapshot);
  const hash = hashSnapshot(natalSnapshot);

  const elements = astro.emphasis.elementsBySign;
  const modalities = astro.emphasis.modalitiesBySign;

  const will =
    (elements.fire ?? 0) * 0.6 +
    (modalities.cardinal ?? 0) * 0.4;

  const insight =
    (elements.water ?? 0) * 0.5 +
    (modalities.mutable ?? 0) * 0.3 +
    (featureVec[10] ?? 0) * 0.2;

  const attunement =
    (elements.water ?? 0) * 0.5 +
    (elements.air ?? 0) * 0.3 +
    (featureVec[12] ?? 0) * 0.2;

  const courage =
    (elements.fire ?? 0) * 0.6 +
    (featureVec[14] ?? 0) * 0.4;

  const discipline =
    (elements.earth ?? 0) * 0.6 +
    (modalities.fixed ?? 0) * 0.3 +
    (featureVec[16] ?? 0) * 0.1;

  const adaptability =
    (modalities.mutable ?? 0) * 0.6 +
    (elements.air ?? 0) * 0.4;

  const bond =
    (semanticProfile.angularEmphasis.seventh ? 1 : 0) * 0.6 +
    (elements.water ?? 0) * 0.3 +
    (featureVec[18] ?? 0) * 0.1;

  const shadowCapacity =
    (semanticProfile.tensionIndex ?? 0) * 0.6 +
    (semanticProfile.aspectSignature.squareHeavy ? 0.25 : 0) +
    (semanticProfile.aspectSignature.oppositionHeavy ? 0.15 : 0);

  const radiance =
    (1 - semanticProfile.tensionIndex) * 0.5 +
    (semanticProfile.resolutionIndex ?? 0) * 0.3 +
    (semanticProfile.tonalPolarity === 'bright' ? 0.2 : 0);

  const temperament = normalizeVector({
    will,
    insight,
    attunement,
    courage,
    discipline,
    adaptability,
    bond,
    shadowCapacity,
    radiance,
  });

  const topDomains = [...effectsBundle.domainSummary]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.domain.localeCompare(b.domain);
    })
    .slice(0, 6)
    .map((d) => ({ domain: d.domain, weight: d.normalizedScore }));

  return {
    id: `char_${hash}`,
    classSlug: effectsBundle.classSlug,
    subclassSlug: effectsBundle.subclassSlug,
    risingModifierSlug: effectsBundle.risingModifierSlug,
    primaryElement: semanticProfile.primaryElement,
    tonalPolarity: semanticProfile.tonalPolarity,
    motionProfile: semanticProfile.motionProfile,
    gravityProfile: semanticProfile.gravityProfile,
    luminaryWeight: semanticProfile.luminaryWeight,
    dominantPlanets: semanticProfile.dominantPlanets,
    angularEmphasis: semanticProfile.angularEmphasis,
    temperament,
    signatureDomains: topDomains,
  };
}

