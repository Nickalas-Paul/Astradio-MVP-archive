/**
 * Phase 4 expression system — enforcement tests (determinism, glue SOT, collision salting, padding path).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-phase4-expression-enforcement.js
 * Update golden: UPDATE_PHASE4_GOLDEN=1 npm run vnext:build && node dist/vnext/vnext/scripts/test-phase4-expression-enforcement.js
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { projectionNormSentence } from '../projection/rule-layer/repetition-collapse-phase0';
import {
  ALL_INTER_CLAIM_GLUE_LITERALS,
  CLAIM_GLUE_RE,
  pickInterClaimGlue,
} from '../projection/rule-layer/claim-inter-claim-glue';
import { buildSupplementalPanel, selectPhraseFromRoleVariants } from '../projection/rule-layer/claim-synthesize';
import { getClaimExpressionBundle } from '../projection/rule-layer/claim-expression-bundles';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ClaimId } from '../semantic/ontology-codes';
import type { SemanticClaim, SemanticCore } from '../semantic/semantic-core';
import { applyConnectionPreface } from '../projection/rule-layer/connection-preface';
import { listenPointerLine } from '../projection/rule-layer/template-lines';

/** Compiled to `dist/vnext/vnext/scripts/` — four levels up is repo root. */
const GOLDEN_PATH = path.join(__dirname, '../../../..', 'vnext', 'eval', 'phase4-expression-golden-hashes.json');

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-phase4-expression-enforcement] ${msg}`);
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

function hashJson(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex');
}

function splitSents(t: string): string[] {
  const x = t.trim();
  if (!x) return [];
  return x
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function testGlueSot(): void {
  assert(ALL_INTER_CLAIM_GLUE_LITERALS.length >= 12, 'glue pool must be 12+ literals (spec)');
  for (const g of ALL_INTER_CLAIM_GLUE_LITERALS) {
    assert(CLAIM_GLUE_RE.test(g), `CLAIM_GLUE_RE must match literal: ${g}`);
  }
  const reAlts = CLAIM_GLUE_RE.source;
  for (const g of ALL_INTER_CLAIM_GLUE_LITERALS) {
    const esc = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(reAlts.includes(esc) || reAlts.includes(g), `regex source should include escape for: ${g}`);
  }
}

function testPickInterClaimGlue(): void {
  const a = pickInterClaimGlue('C1', 'C2', 'fixed-seed', 0);
  const b = pickInterClaimGlue('C1', 'C2', 'fixed-seed', 0);
  assert(a === b, 'pickInterClaimGlue: same inputs → same output');
  const c = pickInterClaimGlue('C1', 'C2', 'other-seed', 0);
  const d = pickInterClaimGlue('C1', 'C2', 'third-seed', 0);
  const set3 = new Set([a, c, d]);
  assert(set3.size >= 2, 'pickInterClaimGlue: different seeds should diversify (at least 2 distinct among 3)');
}

function testSelectPhraseCollisionNotVariant0Only(): void {
  const id = 'ELEMENT_FIRE_DOM' as ClaimId;
  const bundle = getClaimExpressionBundle(id);
  assert(bundle.core.length >= 2, 'ELEMENT_FIRE_DOM should have multi-core for this test');
  const claim: SemanticClaim = {
    claim_id: id,
    priority_rank: 0,
    strength: 0.7,
    polarity: 'neutral',
    participant_slot_indices: [0],
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  };
  const para: string[] = [];
  const a = selectPhraseFromRoleVariants({
    variants: bundle.core,
    claimId: id,
    role: 'core',
    slotKind: 'test',
    seed: 's',
    claim,
    paragraphNormDeque: para,
    sectionId: 'secA',
    slotIndex: 0,
  });
  const b = selectPhraseFromRoleVariants({
    variants: bundle.core,
    claimId: id,
    role: 'core',
    slotKind: 'test',
    seed: 's',
    claim,
    paragraphNormDeque: para,
    sectionId: 'secB',
    slotIndex: 0,
  });
  if (a === b) {
    const c = selectPhraseFromRoleVariants({
      variants: bundle.core,
      claimId: id,
      role: 'core',
      slotKind: 'test',
      seed: 'different-seed',
      claim,
      paragraphNormDeque: para,
      sectionId: 'secA',
      slotIndex: 0,
    });
    assert(c !== a || bundle.core.length === 1, 'multi-core: section or seed should be able to vary phrasing');
  } else {
    assert(a !== b, 'structural: different sectionId may change core line');
  }
}

function testBuildSupplementalPanelFallbackPath(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'p4supp');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['p4-empty'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'p4',
    guidance: g,
  });
  const full = interpretCanonicalReportObject(canonical);
  const emptyCore: SemanticCore = { ...full, claims: [] };
  const r1 = buildSupplementalPanel(
    emptyCore,
    'p4-fb',
    'depth_panel_0',
    0,
    'baseline',
    'profile',
    [],
    [],
    new Set(),
    'short',
    []
  );
  assert(
    r1.phase4_source_path === 'contextual_pad' || r1.phase4_source_path === 'neutral_pad',
    'empty core: final fallback must be contextual_pad or neutral_pad from reduced pool'
  );
  assert(r1.claimIds.length === 0, 'empty core: no claim ids');
  assert(r1.text.trim().length > 20, 'pad line should be substantial');
}

function testProjectionDeterminismAndSeedSpread(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'p4enf');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['p4-h'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'p4',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);
  const run = (seed: string) =>
    projectTextFromSemanticCore(core, seed, {
      phaseD: true,
      surface: 'profile',
      tier: 'extended',
      narrativePlan: null,
    });
  const e1 = run('golden-seed-7f3a');
  const e2 = run('golden-seed-7f3a');
  assert(hashJson(e1) === hashJson(e2), 'projectTextFromSemanticCore: same seed → identical output');

  const e3 = run('other-seed-9b1c');
  assert(hashJson(e1) !== hashJson(e3), 'projectTextFromSemanticCore: different seed → different output');

  const hProf = hashJson(e1);
  if (process.env.UPDATE_PHASE4_GOLDEN === '1') {
    const dir = path.dirname(GOLDEN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      GOLDEN_PATH,
      JSON.stringify({ profile_extended_hash: hProf, generatedAt: new Date().toISOString() }, null, 2) + '\n',
      'utf8'
    );
    console.log('[test-phase4-expression-enforcement] Wrote', GOLDEN_PATH, hProf);
  } else if (fs.existsSync(GOLDEN_PATH)) {
    const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')) as { profile_extended_hash: string };
    assert(
      golden.profile_extended_hash === hProf,
      `golden hash mismatch — run with UPDATE_PHASE4_GOLDEN=1 after intentional copy changes (got ${hProf})`
    );
  } else {
    throw new Error(`Missing ${GOLDEN_PATH} — run with UPDATE_PHASE4_GOLDEN=1 once to create baseline`);
  }
}

function testRepetitionAcrossSections(sections: ReturnType<typeof projectTextFromSemanticCore>): void {
  const norms: string[] = [];
  for (const sec of sections) {
    for (const field of [sec.text, ...(sec.bullets ?? [])]) {
      for (const sent of splitSents(field)) {
        const n = projectionNormSentence(sent);
        if (n.length < 32) continue;
        norms.push(n);
      }
    }
  }
  const counts = new Map<string, number>();
  for (const n of norms) counts.set(n, (counts.get(n) ?? 0) + 1);
  let worst = 0;
  for (const c of counts.values()) if (c > worst) worst = c;
  // Extended profile reuses a small set of scaffolds (e.g. anchor stems) by design; cap egregious repeats.
  assert(worst <= 3, `repetition audit: long norms should not appear >3 times in one pass (worst=${worst})`);
}

function testListenPointerAndPrefaceSpread(): void {
  const s = new Set<string>();
  for (let i = 0; i < 5; i++) {
    s.add(listenPointerLine(`lp-seed-${i}`, 'profile'));
  }
  assert(s.size >= 2, 'listenPointerLine: multiple seeds should yield ≥2 pointer variants');
  const pre = new Set<string>();
  for (let m = 0; m < 8; m++) {
    const [first] = applyConnectionPreface([], {
      surface: 'compat_pair',
      connectionMode: 'friends',
      tier: 'extended',
      seed: `pf-${m}`,
    });
    if (first?.id === 'connection_structure' && first.text) pre.add(first.text.slice(0, 120));
  }
  assert(pre.size >= 2, 'applyConnectionPreface: different seeds should diversify friend-mode framing (≥2 openings)');
}

function main(): void {
  testGlueSot();
  testPickInterClaimGlue();
  testSelectPhraseCollisionNotVariant0Only();
  testBuildSupplementalPanelFallbackPath();
  testListenPointerAndPrefaceSpread();

  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'p4rep');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['p4-h'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'p4',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);
  const sections = projectTextFromSemanticCore(core, 'repetition-audit-seed', {
    phaseD: true,
    surface: 'profile',
    tier: 'extended',
    narrativePlan: null,
  });
  testRepetitionAcrossSections(sections);

  testProjectionDeterminismAndSeedSpread();

  console.log('[test-phase4-expression-enforcement] OK');
}

main();
