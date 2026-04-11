/**
 * Phase 1 — Claim Expression Expansion validation.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-phase1-claim-expression.js
 */
import { CLAIM_IDS, type ClaimId } from '../semantic/ontology-codes';
import {
  CLAIM_BUNDLE_FORBIDDEN_SUBSTRINGS,
  CLAIM_EXPRESSION_BUNDLES,
  type ClaimOptionalRole,
  getClaimExpressionBundle,
} from '../projection/rule-layer/claim-expression-bundles';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import {
  buildCanonicalReportForSnapshotSurface,
  buildCanonicalReportForAggregate,
  buildCanonicalReportForOverlay,
} from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore, projectFeedCardFromSemanticCore } from '../projection/text-projection';
import { mergeFeatureVectors } from '../compat/fusion';
import { projectionNormSentence } from '../projection/rule-layer/repetition-collapse-phase0';
import { normalizeProjectionInput } from '../projection/rule-layer/normalize-input';
import { validateReportSections } from '../projection/rule-layer/validate-projection';
import { renderClaimExpressionBlock } from '../projection/rule-layer/claim-synthesize';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ExpansionTier, ProjectionSurface, ProjectedExplanationSection } from '../projection/projection-types';
import type { SemanticClaim } from '../semantic/semantic-core';

const GENERIC_FALLBACK_LITERALS = [
  'This picture carries an additional emphasis shows up strongly in this view; it may show up as subtle shifts rather than a single fixed behavioral label.',
  'This picture carries an additional emphasis shows up moderately in this view; it may show up as subtle shifts rather than a single fixed behavioral label.',
] as const;

const GENERIC_FALLBACK_NORM = new Set(GENERIC_FALLBACK_LITERALS.map(projectionNormSentence));

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-phase1-claim-expression] ${msg}`);
}

function snap(d = 0): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128 + d,
    lon: -74.006 + d,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 + d },
      { name: 'Moon', lon: 45 + d },
      { name: 'Mercury', lon: 60 + d },
      { name: 'Venus', lon: 75 + d },
      { name: 'Mars', lon: 90 + d },
      { name: 'Jupiter', lon: 105 + d },
      { name: 'Saturn', lon: 120 + d },
      { name: 'Uranus', lon: 135 + d },
      { name: 'Neptune', lon: 150 + d },
      { name: 'Pluto', lon: 165 + d },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function splitSents(para: string): string[] {
  const t = para.trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function countGenericFallbackNormsInSections(sections: ProjectedExplanationSection[]): number {
  let n = 0;
  for (const sec of sections) {
    for (const body of [sec.text, ...(sec.bullets ?? [])]) {
      for (const para of body.split(/\n\n+/)) {
        for (const s of splitSents(para)) {
          const norm = projectionNormSentence(s);
          if (GENERIC_FALLBACK_NORM.has(norm)) n++;
        }
      }
    }
  }
  return n;
}

function allVisibleText(sections: ProjectedExplanationSection[]): string {
  return sections
    .map((s) => [s.title, s.text, ...(s.bullets ?? [])].join('\n'))
    .join('\n');
}

function assertProjectionMatrix(
  label: string,
  core: ReturnType<typeof interpretCanonicalReportObject>,
  surface: ProjectionSurface,
  tier: ExpansionTier,
  extra: Record<string, unknown> = {}
): void {
  const seed = `p1-${label}`;
  const a = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface,
    tier,
    narrativePlan: null,
    aspectTension: null,
    ...extra,
  });
  const b = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface,
    tier,
    narrativePlan: null,
    aspectTension: null,
    ...extra,
  });
  assert(JSON.stringify(a) === JSON.stringify(b), `${label}: determinism`);
  const gf = countGenericFallbackNormsInSections(a);
  assert(gf === 0, `${label}: GENERIC_FALLBACK count must be 0, got ${gf}`);
  assert(!allVisibleText(a).includes('This picture carries an additional emphasis'), `${label}: no legacy generic`);

  const norm = normalizeProjectionInput(core, seed, { surface, tier, phaseD: true, ...extra });
  const tierForDensity = surface === 'feed' ? (tier ?? 'baseline') : norm.tierEff;
  const validateTier = surface === 'feed' ? 'baseline' : norm.tierEff;
  const vr = validateReportSections(a, surface, validateTier, core, tierForDensity);
  assert(vr.ok, `${label}: validateReportSections: ${vr.violations.join(';')}`);
}

function main(): void {
  for (const id of CLAIM_IDS) {
    const b = getClaimExpressionBundle(id);
    assert(b === CLAIM_EXPRESSION_BUNDLES[id], `bundle ref ${id}`);
    for (const k of ['core', 'mechanism', 'experience', 'variation', 'implication'] as const) {
      const s = b[k];
      if (typeof s !== 'string') continue;
      const lower = s.toLowerCase();
      for (const f of CLAIM_BUNDLE_FORBIDDEN_SUBSTRINGS) {
        assert(!lower.includes(f.toLowerCase()), `${id}.${k} must not contain forbidden: ${f}`);
      }
    }
  }

  const natal = snap(0);
  const natal2 = snap(5);
  const natal3 = snap(11);
  const transit = snap(10);
  const fv = encodeFeatures(natal) as FeatureVec;
  const fv2 = encodeFeatures(natal2) as FeatureVec;
  const fv3 = encodeFeatures(natal3) as FeatureVec;
  const fvt = encodeFeatures(transit) as FeatureVec;
  const g = guidanceFromFeatures(fv, natal, 'p1');
  const merged = mergeFeatureVectors(fv, fv2, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 });
  const m12 = mergeFeatureVectors(fv, fv2, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 });
  const merged3 = mergeFeatureVectors(m12, fv3, { relationshipMode: 'neutral', wA: 0.67, wB: 0.33 });

  const coreProfile = interpretCanonicalReportObject(
    buildCanonicalReportForSnapshotSurface({
      surface_kind: 'profile_natal',
      subject_ids: ['p1'],
      snapshot: natal,
      featureVec: fv,
      control_surface_hash: 'p1',
      compose_seed: 'p1',
      guidance: g,
    })
  );
  const coreDaily = interpretCanonicalReportObject(
    buildCanonicalReportForSnapshotSurface({
      surface_kind: 'home_daily',
      subject_ids: ['p1d'],
      snapshot: natal,
      featureVec: fv,
      control_surface_hash: 'p1d',
      compose_seed: 'p1d',
      guidance: g,
    })
  );
  const coreOverlay = interpretCanonicalReportObject(
    buildCanonicalReportForOverlay({
      subject_ids: ['p1o'],
      natalSnapshot: natal,
      natalFeatureVec: fv,
      transitSnapshot: transit,
      transitFeatureVec: fvt,
      control_surface_hash: 'p1o',
      compose_seed: 'p1o',
      guidance: g,
    })
  );
  const coreCompat = interpretCanonicalReportObject(
    buildCanonicalReportForAggregate({
      kind: 'comparison',
      subject_ids: ['p1c'],
      participants: [
        { snapshot: natal, featureVec: fv, role: 'primary' },
        { snapshot: natal2, featureVec: fv2, role: 'member_i' },
      ],
      composite: merged as FeatureVec,
      anchorIndex: 0,
      control_surface_hash: 'p1c',
      compose_seed: 'p1c',
      guidance: g,
      relationalWeather: null,
    })
  );
  const coreGroup = interpretCanonicalReportObject(
    buildCanonicalReportForAggregate({
      kind: 'group',
      subject_ids: ['p1g'],
      participants: [
        { snapshot: natal, featureVec: fv, role: 'primary' },
        { snapshot: natal2, featureVec: fv2, role: 'member_i' },
        { snapshot: natal3, featureVec: fv3, role: 'member_i' },
      ],
      composite: merged3 as FeatureVec,
      anchorIndex: 0,
      control_surface_hash: 'p1g',
      compose_seed: 'p1g',
      guidance: g,
      relationalWeather: null,
    })
  );

  assertProjectionMatrix('profile-A-baseline', coreProfile, 'profile', 'baseline');
  assertProjectionMatrix('profile-A-extended', coreProfile, 'profile', 'extended');
  assertProjectionMatrix('profile-A+C(t)-daily-extended', coreDaily, 'daily', 'extended');
  assertProjectionMatrix('sandbox-single-extended', coreProfile, 'sandbox', 'extended');
  assertProjectionMatrix('overlay-pair-extended', coreOverlay, 'overlay_pair', 'extended');
  assertProjectionMatrix('compat-A+B-extended', coreCompat, 'compat_pair', 'extended', { connectionMode: 'lovers' });
  assertProjectionMatrix('group-A+B+N-extended', coreGroup, 'group', 'extended', {
    connectionMode: 'group',
    participantCount: 3,
  });
  assertProjectionMatrix('campaign-baseline', coreProfile, 'campaign', 'baseline');

  const feedA = projectFeedCardFromSemanticCore(coreProfile, 'p1-feed');
  const feedB = projectFeedCardFromSemanticCore(coreProfile, 'p1-feed');
  assert(JSON.stringify(feedA) === JSON.stringify(feedB), 'feed determinism');
  assert(countGenericFallbackNormsInSections(feedA) === 0, 'feed: no generic fallback');

  const claim: SemanticClaim = {
    claim_id: 'ELEMENT_FIRE_DOM' as ClaimId,
    priority_rank: 0,
    strength: 0.7,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const secR: ClaimOptionalRole[] = [];
  const paraN: string[] = [];
  const block = renderClaimExpressionBlock({
    claim,
    localIndex: 0,
    seed: 'p1|fire|unit',
    surface: 'profile',
    tier: 'baseline',
    sectionRoleDeque: secR,
    paragraphNormDeque: paraN,
  });
  const parts = splitSents(block.text);
  assert(parts.length >= 2, `renderClaimExpressionBlock must emit core + secondary (sentences=${parts.length})`);

  console.log('[test-phase1-claim-expression] OK');
}

main();
