/**
 * Phase 4 composition rules — grammar, runs, determinism, reconstruction, hash strip, audio_thread index.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-composition-phase4.js
 */
import { createHash } from 'crypto';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection, ProjectionSurface } from '../projection/projection-types';
import { reconstructTaggedSectionBody, stripTaggedFromExplanationForHash } from '../projection/tagged-text';
import { applyCompositionPhase4, validatePhase4GrammarAndRuns } from '../projection/rule-layer/composition-phase4';
import { assemblePhaseDSections } from '../projection/rule-layer/assemble-sections';
import { normalizeProjectionInput } from '../projection/rule-layer/normalize-input';
import { classifyTemporalVoice } from '../projection/rule-layer/temporal-classify';

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

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-composition-phase4] ${msg}`);
}

function assertReconstructs(sections: ProjectedExplanationSection[], label: string): void {
  for (const s of sections) {
    const t = s.meta?.tagged;
    if (!t) continue;
    assert(reconstructTaggedSectionBody(t) === s.text, `${label} reconstruct body ${s.id}`);
    const bb = t.bulletBlocks;
    if (bb?.length && s.bullets?.length === bb.length) {
      for (let i = 0; i < bb.length; i++) {
        assert(reconstructTaggedSectionBody(bb[i]!) === s.bullets![i], `${label} bullet ${s.id}[${i}]`);
      }
    }
  }
}

function assertMultisetUnchanged(before: ProjectedExplanationSection[], after: ProjectedExplanationSection[]): void {
  const walk = (sec: ProjectedExplanationSection) => {
    const rows: string[] = [];
    const prov: string[] = [];
    const visit = (body: import('../projection/projection-types').TaggedSectionBody) => {
      for (const p of body.paragraphs) {
        for (const s of p.sentences) {
          rows.push(s.text);
          prov.push(s.provenance);
        }
      }
      for (const bb of body.bulletBlocks ?? []) visit(bb);
    };
    if (sec.meta?.tagged) visit(sec.meta.tagged);
    return { rows: rows.sort().join('|'), prov: prov.sort().join('|') };
  };
  const sig = (arr: ProjectedExplanationSection[]) =>
    arr.map((s) => `${s.id}:${walk(s).rows}:${walk(s).prov}`).join('\n');
  assert(sig(before) === sig(after), 'multiset text+provenance per section must match');
}

function explanationHash(sections: ProjectedExplanationSection[]): string {
  const explanation = {
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      text: s.text,
      bullets: s.bullets,
      meta: s.meta,
    })),
  };
  const stripped = stripTaggedFromExplanationForHash(explanation as Record<string, unknown>);
  return createHash('sha256').update(JSON.stringify(stripped), 'utf8').digest('hex');
}

function audioThreadIndex(sections: ProjectedExplanationSection[]): number {
  return sections.findIndex((s) => s.id === 'audio_thread');
}

function expectedAudioThreadIndex(sections: ProjectedExplanationSection[]): number {
  const n = sections.length;
  const idx = sections.findIndex((s) => s.id === 'audio_thread');
  if (idx < 0) return -1;
  const k =
    sections[0]?.id === 'connection_structure' || sections[0]?.id === 'ensemble_framing' ? 1 : 0;
  const lBs = n - 1;
  const p = Math.min(2, lBs);
  return Math.min(k + p, n - 1);
}

function runSurface(
  core: ReturnType<typeof interpretCanonicalReportObject>,
  surface: ProjectionSurface,
  tier: 'baseline' | 'expanded' | 'extended',
  extra?: Partial<import('../projection/projection-types').ProjectionOptions>
): ProjectedExplanationSection[] {
  return projectTextFromSemanticCore(core, `p4-${surface}-${tier}`, {
    phaseD: true,
    surface,
    tier,
    narrativePlan: null,
    ...extra,
  });
}

function main(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'p4');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['p4'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);

  const surfaces: Array<{
    surface: ProjectionSurface;
    tier: 'baseline' | 'expanded' | 'extended';
    extra?: Partial<import('../projection/projection-types').ProjectionOptions>;
  }> = [
    { surface: 'profile', tier: 'baseline' },
    { surface: 'profile', tier: 'extended' },
    { surface: 'overlay_pair', tier: 'extended' },
    { surface: 'compat_pair', tier: 'extended', extra: { connectionMode: 'friends' } },
    { surface: 'group', tier: 'extended', extra: { participantCount: 4 } },
    { surface: 'sandbox', tier: 'expanded' },
    { surface: 'campaign', tier: 'baseline' },
    { surface: 'feed', tier: 'baseline' },
  ];

  for (const cfg of surfaces) {
    const label = `${cfg.surface}/${cfg.tier}`;
    const a = runSurface(core, cfg.surface, cfg.tier, cfg.extra);
    const b = runSurface(core, cfg.surface, cfg.tier, cfg.extra);
    assert(JSON.stringify(a) === JSON.stringify(b), `determinism ${label}`);
    assertReconstructs(a, label);
    const v = validatePhase4GrammarAndRuns(a, cfg.surface);
    assert(v.ok, `grammar+runs ${label}: ${v.violations.join(';')}`);
    assert(a[0]?.meta?.phase4_composition !== undefined, `phase4_composition meta ${label}`);
    const thr = audioThreadIndex(a);
    if (thr >= 0) {
      assert(thr === expectedAudioThreadIndex(a), `audio_thread index ${label}`);
    }
  }

  const synWrongOrder: ProjectedExplanationSection = {
    id: 'synthesis_a',
    title: 'Synthesis',
    text: 'First claim. Second wrap.',
    meta: {
      phaseD: true,
      tagged: {
        paragraphs: [
          {
            sentences: [
              { text: 'First claim.', provenance: 'claim_body' },
              { text: 'Second wrap.', provenance: 'synthesis_wrapper' },
            ],
          },
        ],
      },
    },
  };
  assert(reconstructTaggedSectionBody(synWrongOrder.meta!.tagged!) === synWrongOrder.text, 'synthetic pre');
  const hBefore = explanationHash([synWrongOrder]);
  const p4 = applyCompositionPhase4([synWrongOrder], 'profile');
  const hAfter = explanationHash(p4.sections);
  assert(p4.sections[0]!.text === 'Second wrap. First claim.', 'synthetic CB/SW reorder');
  assert(hBefore !== hAfter, 'synthetic explanation hash must change when sentence order changes');
  assertMultisetUnchanged([synWrongOrder], p4.sections);

  const norm = normalizeProjectionInput(core, 'p4-assem', {
    phaseD: true,
    surface: 'profile',
    tier: 'extended',
  });
  const assembled = assemblePhaseDSections({
    core,
    seed: 'p4-assem',
    options: { phaseD: true, surface: 'profile', tier: 'extended', narrativePlan: null },
    tierMetaRequested: norm.tierMetaRequested,
    tierEff: norm.tierEff,
    surface: 'profile',
    temporalBucket: classifyTemporalVoice(core),
  });
  const hAssem = explanationHash(assembled);
  const p4b = applyCompositionPhase4(assembled, 'profile');
  const hP4 = explanationHash(p4b.sections);
  if (JSON.stringify(assembled.map((s) => s.text)) !== JSON.stringify(p4b.sections.map((s) => s.text))) {
    assert(hAssem !== hP4, 'assembled vs phase4: hash must differ when text order changes');
  } else {
    assert(hAssem === hP4, 'assembled vs phase4: hash stable on no-op reorder');
  }

  const stable = runSurface(core, 'profile', 'baseline');
  const h1 = explanationHash(stable);
  const h2 = explanationHash(stable);
  assert(h1 === h2, 'identical sections → identical explanation hash');

  console.log('[test-composition-phase4] OK');
}

main();
