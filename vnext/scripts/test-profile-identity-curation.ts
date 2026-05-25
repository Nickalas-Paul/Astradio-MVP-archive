/**
 * Phase 7 Batch 6 — Identity curation (sentence caps, sonic preservation, UI filter).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-profile-identity-curation.js
 */

import assert from 'node:assert/strict';
import { encodeFeatures } from '../feature-encode';
import type { EphemerisSnapshot, FeatureVec, SnapshotAspect } from '../contracts';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { capToMaxSentences } from '../projection/rule-layer/claim-synthesize';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { getAspectInsight } from '../projection/insight-library/insight-library-index';

function filterSectionsForIdentityDisplay<T extends { id: string }>(sections: readonly T[]): T[] {
  return sections.filter((section) => section.id !== 'audio_staging');
}

function snap(d = 0): EphemerisSnapshot {
  const aspects: SnapshotAspect[] = [
    { bodyA: 'SUN', bodyB: 'MOON', type: 'trine', orb: 1.2, priorityBase: 0.9 },
    { bodyA: 'SUN', bodyB: 'MARS', type: 'square', orb: 2.1, priorityBase: 0.85 },
    { bodyA: 'VENUS', bodyB: 'JUPITER', type: 'sextile', orb: 1.5, priorityBase: 0.8 },
    { bodyA: 'MERCURY', bodyB: 'SATURN', type: 'opposition', orb: 2.8, priorityBase: 0.75 },
    { bodyA: 'MOON', bodyB: 'NEPTUNE', type: 'conjunction', orb: 3.0, priorityBase: 0.7 },
    { bodyA: 'MARS', bodyB: 'PLUTO', type: 'trine', orb: 2.5, priorityBase: 0.65 },
  ];
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
    aspects,
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function sumSectionCharacters(sections: Array<{ text?: string; bullets?: string[] }>): number {
  return sections.reduce((n, s) => n + (s.text?.length ?? 0) + (s.bullets?.join('').length ?? 0), 0);
}

function profileSections(seed: string, chart: EphemerisSnapshot) {
  const fv = encodeFeatures(chart) as FeatureVec;
  const g = guidanceFromFeatures(fv, chart, seed);
  const core = interpretCanonicalReportObject(
    buildCanonicalReportForSnapshotSurface({
      surface_kind: 'profile_natal',
      subject_ids: [seed],
      snapshot: chart,
      featureVec: fv,
      control_surface_hash: seed,
      compose_seed: seed,
      guidance: g,
    })
  );
  return projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'profile',
    tier: 'extended',
    narrativePlan: null,
    snapshot: chart,
    snapshotAspects: chart.aspects,
  });
}

function testPlacementSentenceCaps() {
  const mockSignInsight = {
    core: 'Sentence 1. Sentence 2. Sentence 3. Sentence 4.',
    behavioral: 'Sentence 1. Sentence 2. Sentence 3.',
    sonic: 'Sentence 1. Sentence 2.',
  };
  const cappedCore = capToMaxSentences(mockSignInsight.core, 2);
  const cappedBehavioral = capToMaxSentences(mockSignInsight.behavioral, 2);
  const cappedSonic = capToMaxSentences(mockSignInsight.sonic, 1);
  assert.equal(cappedCore, 'Sentence 1. Sentence 2.');
  assert.equal(cappedBehavioral, 'Sentence 1. Sentence 2.');
  assert.equal(cappedSonic, 'Sentence 1.');
}

function testSonicContentPreservation() {
  const sections = profileSections('identity-sonic', snap(0));
  const placementText = sections
    .filter((s) =>
      [
        'core_identity',
        'direction_foundation',
        'personal_expression',
        'growth_expansion',
        'evolutionary_currents',
      ].includes(s.id)
    )
    .map((s) => s.text)
    .join('\n');
  const sonicSectionCount =
    (placementText.match(/\*\*Sonic Signature\*\*/g) || []).length +
    (placementText.match(/\*\*Aesthetic Resonance\*\*/g) || []).length;
  const ascendantSonicCount = (placementText.match(/\*\*Physical Presence\*\*/g) || []).length;
  const mcSonicCount = (placementText.match(/\*\*Legacy Sound\*\*/g) || []).length;
  const icSonicCount = (placementText.match(/\*\*Interior Resonance\*\*/g) || []).length;
  assert.equal(sonicSectionCount, 20, `expected 20 planet sonic sections, got ${sonicSectionCount}`);
  assert.equal(ascendantSonicCount, 1, `expected 1 Ascendant sonic section, got ${ascendantSonicCount}`);
  assert.equal(mcSonicCount, 1, `expected 1 Midheaven sonic section, got ${mcSonicCount}`);
  assert.equal(icSonicCount, 1, `expected 1 IC sonic section, got ${icSonicCount}`);
}

function testAscendantInCoreIdentity() {
  const sections = profileSections('identity-asc', snap(0));
  const coreIdentity = sections.find((s) => s.id === 'core_identity');
  assert.ok(coreIdentity?.text, 'core_identity section present');
  const text = coreIdentity.text!;
  assert.ok(text.includes('### Ascendant in Aries'), 'Ascendant block with sign');
  assert.ok(text.includes('**First Impressions**'), 'Ascendant First Impressions label');
  assert.ok(text.includes('**Natural Approach**'), 'Ascendant Natural Approach label');
  assert.ok(text.includes('**Physical Presence**'), 'Ascendant Physical Presence label');
  const sunIdx = text.indexOf('### Sun in');
  const moonIdx = text.indexOf('### Moon in');
  const ascIdx = text.indexOf('### Ascendant in');
  assert.ok(sunIdx >= 0 && moonIdx > sunIdx && ascIdx > moonIdx, 'Big 3 order: Sun, Moon, Ascendant');
  const nextHeading = text.indexOf('###', ascIdx + 1);
  const ascBlock = text.slice(ascIdx, nextHeading > ascIdx ? nextHeading : text.length);
  assert.ok(!ascBlock.includes('**How You Show Up**'), 'Ascendant has no house subsection');

  const insight = getAspectInsight('PLCMT_ASCENDANT_ARIES');
  assert.ok(insight?.core?.includes('Ascendant in Aries'));
}

function testMidheavenInDirectionFoundation() {
  const sections = profileSections('identity-mc', snap(0));
  const direction = sections.find((s) => s.id === 'direction_foundation');
  assert.ok(direction?.text, 'direction_foundation section present');
  const text = direction.text!;
  assert.ok(text.includes('### Midheaven in Capricorn'), 'Midheaven block with sign (houses[9]=270)');
  assert.ok(text.includes('**Public Direction**'), 'Midheaven Public Direction label');
  assert.ok(text.includes('**Achievement Style**'), 'Midheaven Achievement Style label');
  assert.ok(text.includes('**Legacy Sound**'), 'Midheaven Legacy Sound label');
  const mcBlock = text.slice(text.indexOf('### Midheaven in'));
  assert.ok(!mcBlock.includes('**How You Show Up**'), 'Midheaven has no house subsection');

  const coreIdentity = sections.find((s) => s.id === 'core_identity');
  const personal = sections.find((s) => s.id === 'personal_expression');
  assert.ok(coreIdentity && direction && personal, 'tier sections exist');
  const order = sections.map((s) => s.id);
  const ci = order.indexOf('core_identity');
  const df = order.indexOf('direction_foundation');
  const pe = order.indexOf('personal_expression');
  assert.ok(ci >= 0 && df > ci && pe > df, 'tier order: core_identity → direction_foundation → personal_expression');

  const insight = getAspectInsight('PLCMT_MC_CAPRICORN');
  assert.ok(insight?.core?.includes('Midheaven in Capricorn'));
}

function testIcInDirectionFoundation() {
  const sections = profileSections('identity-ic', snap(0));
  const direction = sections.find((s) => s.id === 'direction_foundation');
  assert.ok(direction?.text, 'direction_foundation section present');
  const text = direction.text!;
  assert.ok(text.includes('### Midheaven in Capricorn'), 'Midheaven block present');
  assert.ok(text.includes('### IC in Cancer'), 'IC block with sign (houses[3]=90)');
  assert.ok(text.includes('**Emotional Foundation**'), 'IC Emotional Foundation label');
  assert.ok(text.includes('**Private Sanctuary**'), 'IC Private Sanctuary label');
  assert.ok(text.includes('**Interior Resonance**'), 'IC Interior Resonance label');

  const mcIdx = text.indexOf('### Midheaven in');
  const icIdx = text.indexOf('### IC in');
  assert.ok(mcIdx >= 0 && icIdx > mcIdx, 'MC before IC in direction_foundation');

  const icBlock = text.slice(icIdx, text.indexOf('###', icIdx + 1) > icIdx ? text.indexOf('###', icIdx + 1) : text.length);
  assert.ok(!icBlock.includes('**How You Show Up**'), 'IC has no house subsection');

  const insight = getAspectInsight('PLCMT_IC_CANCER');
  assert.ok(insight?.core?.includes('IC in Cancer'));
}

function testAspectSentenceCaps() {
  const mockAspectInsight = {
    core: 'Core sentence 1. Core sentence 2. Core sentence 3.',
    behavioral: 'Behavioral sentence 1. Behavioral sentence 2.',
  };
  const coreText = capToMaxSentences(mockAspectInsight.core, 2);
  const behavioralText = capToMaxSentences(mockAspectInsight.behavioral, 1);
  const aspectText = [coreText, behavioralText].filter(Boolean).join(' ');
  assert.ok(aspectText.includes('Core sentence 1. Core sentence 2.'));
  assert.ok(aspectText.includes('Behavioral sentence 1.'));
  assert.ok(!aspectText.includes('Core sentence 3'));
  assert.ok(!aspectText.includes('Behavioral sentence 2'));

  const insight = getAspectInsight('SUN_MOON_TRINE');
  assert.ok(insight);
  const uncappedLen = `${insight.core} ${insight.behavioral}`.length;
  const cappedLen = [
    capToMaxSentences(insight.core || '', 2),
    capToMaxSentences(insight.behavioral || '', 1),
  ]
    .filter(Boolean)
    .join(' ').length;
  assert.ok(cappedLen < uncappedLen, 'library aspect prose shorter when capped');
}

function testCharacterCountRange() {
  const totals = [snap(0), snap(3), snap(7)].map((chart, i) =>
    sumSectionCharacters(profileSections(`identity-chars-${i}`, chart))
  );
  for (const totalChars of totals) {
    assert.ok(totalChars >= 12000 && totalChars <= 18000, `total chars ${totalChars} within 12k-18k`);
  }
}

function testAudioStagingHiddenFromUi() {
  const sections = profileSections('identity-ui', snap(1));
  const visible = filterSectionsForIdentityDisplay(sections);
  assert.ok(!visible.some((s) => s.id === 'audio_staging'), 'audio_staging hidden from Identity UI');
  assert.ok(sections.some((s) => s.id === 'audio_staging'), 'audio_staging still in raw sections');
}

function testOverlayUnchanged() {
  const natal = snap(0);
  const transit = snap(10);
  const fv = encodeFeatures(natal) as FeatureVec;
  const fvt = encodeFeatures(transit) as FeatureVec;
  const g = guidanceFromFeatures(fv, natal, 'overlay-regression');
  const core = interpretCanonicalReportObject(
    buildCanonicalReportForSnapshotSurface({
      surface_kind: 'profile_natal',
      subject_ids: ['overlay-regression'],
      snapshot: natal,
      featureVec: fv,
      control_surface_hash: 'overlay-regression',
      compose_seed: 'overlay-regression',
      guidance: g,
    })
  );
  const overlay = projectTextFromSemanticCore(core, 'overlay-regression', {
    phaseD: true,
    surface: 'overlay_pair',
    tier: 'extended',
    snapshot: natal,
    secondarySnapshot: transit,
    pairInteractionAspectsV2: [
      {
        bodyA: 'sun',
        bodyB: 'jupiter',
        type: 'sextile',
        orb: 1,
        exactAngle: 0,
        dynamics: 'flowing',
        strength: 0.5,
        exactness: 0.9,
        priorityBase: 0.9,
        sourceSlotIndex: 0,
        targetSlotIndex: 1,
      },
    ],
  });
  assert.ok(overlay.some((s) => s.id === 'todays_sound'), 'transit overlay still has todays_sound');
}

function main() {
  testPlacementSentenceCaps();
  testSonicContentPreservation();
  testAscendantInCoreIdentity();
  testMidheavenInDirectionFoundation();
  testIcInDirectionFoundation();
  testAspectSentenceCaps();
  testCharacterCountRange();
  testAudioStagingHiddenFromUi();
  testOverlayUnchanged();
  console.log('[test-profile-identity-curation] all tests passed');
}

main();
