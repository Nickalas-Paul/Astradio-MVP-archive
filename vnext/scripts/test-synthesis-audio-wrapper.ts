/**
 * Synthesis wrapper alignment with `SemanticCore.audio` + R3 (no full audio lexicon in projection text).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-synthesis-audio-wrapper.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { validateReportSections } from '../projection/rule-layer/validate-projection';
import { AUDIO_LEXICON_CLAUSE_STRINGS } from '../projection/rule-layer/audio-lexicon';
import type { ProjectedExplanationSection, ExpansionTier, ProjectionSurface } from '../projection/projection-types';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { SemanticCore } from '../semantic/semantic-core';
import type { TempoBandCode } from '../semantic/ontology-codes';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-synthesis-audio-wrapper] ${msg}`);
}

function snap(): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
      { name: 'Mercury', lon: 60 },
      { name: 'Venus', lon: 75 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 120 },
      { name: 'Uranus', lon: 135 },
      { name: 'Neptune', lon: 150 },
      { name: 'Pluto', lon: 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function synthesisWrapperLine(sec: ProjectedExplanationSection | undefined): string {
  if (!sec?.text) return '';
  const parts = sec.text.split(/\n\n+/);
  return (parts[0] ?? '').trim();
}

function synthesisBody(sec: ProjectedExplanationSection | undefined): string {
  if (!sec?.text) return '';
  const parts = sec.text.split(/\n\n+/);
  return parts.slice(1).join('\n\n').trim();
}

function r3ProjectionText(sections: ProjectedExplanationSection[]): string {
  return sections.map((s) => [s.text, ...(s.bullets ?? [])].join('\n')).join('\n');
}

function assertNoFullLexiconSubstring(text: string, where: string): void {
  for (const clause of AUDIO_LEXICON_CLAUSE_STRINGS) {
    assert(
      !text.includes(clause),
      `${where}: must not include full listen lexicon clause: ${clause.slice(0, 40)}...`
    );
  }
}

function runProjection(
  core: SemanticCore,
  seed: string,
  surface: ProjectionSurface,
  tier: ExpansionTier
): ProjectedExplanationSection[] {
  return projectTextFromSemanticCore(core, seed, { phaseD: true, surface, tier, narrativePlan: null });
}

function validate(
  sections: ProjectedExplanationSection[],
  surface: ProjectionSurface,
  tier: ExpansionTier,
  core: SemanticCore
): void {
  const v = validateReportSections(sections, surface, tier, core, tier);
  assert(
    v.ok,
    `validation: ${v.violations.join('; ')} (hard = structural fail)`
  );
  const r3 = v.violations.filter((x) => x.startsWith('r3_audio_family_'));
  assert(r3.length === 0, `R3: ${r3.join('; ')}`);
}

function main(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'synth-aud');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['test-hash'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const base = interpretCanonicalReportObject(canonical);

  const tHi: TempoBandCode = 'TEMPO_HIGH';
  const tLo: TempoBandCode = 'TEMPO_LOW';
  const fast: SemanticCore = { ...base, audio: { ...base.audio, tempo_band: tHi } };
  const slow: SemanticCore = { ...base, audio: { ...base.audio, tempo_band: tLo } };

  const surface: ProjectionSurface = 'profile';
  const tier: ExpansionTier = 'expanded';
  const seed = 'saw-test-seed';

  const a1 = runProjection(fast, seed, surface, tier);
  const a2 = runProjection(fast, seed, surface, tier);
  assert(JSON.stringify(a1) === JSON.stringify(a2), 'determinism: identical core+seed → identical sections');

  const sFast = a1.find((s) => s.id === 'synthesis_a');
  const sSlow = runProjection(slow, seed, surface, tier).find((s) => s.id === 'synthesis_a');
  assert(sFast != null && sSlow != null, 'synthesis_a must exist for profile expanded');
  const wF = synthesisWrapperLine(sFast);
  const wS = synthesisWrapperLine(sSlow);
  assert(wF.length > 0 && wS.length > 0, 'wrappers must be non-empty');
  assert(wF !== wS, 'synthesis_a wrapper must differ when only tempo_band differs (HIGH vs LOW)');
  assert(
    synthesisBody(sFast) === synthesisBody(sSlow),
    'claim block after wrapper must be identical for same claims when only audio.tempo changes'
  );

  validate(a1, surface, tier, fast);
  validate(runProjection(slow, seed, surface, tier), surface, tier, slow);

  const r3 = r3ProjectionText(a1);
  assertNoFullLexiconSubstring(r3, 'r3Text');

  console.log('[test-synthesis-audio-wrapper] OK');
}

main();
