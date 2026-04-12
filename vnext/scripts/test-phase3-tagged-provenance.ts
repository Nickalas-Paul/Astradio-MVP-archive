/**
 * Phase 3 — tagged provenance invariants (local CI).
 * Reconstruction, sentence coverage, tagging determinism, hash strip stability.
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection, TaggedSectionBody, TaggedSentence } from '../projection/projection-types';
import {
  assertAllSectionsTagged,
  reconstructTaggedSectionBody,
  stripTaggedFromExplanationForHash,
} from '../projection/tagged-text';

const PROVENANCE: ReadonlySet<string> = new Set([
  'claim_body',
  'template',
  'preface',
  'audio_staging',
  'audio_thread',
  'tier_scaffold',
  'synthesis_wrapper',
  'padding',
  'assembler_glue',
]);

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
  if (!cond) throw new Error(`[test-phase3-tagged-provenance] ${msg}`);
}

function walkTaggedSentences(body: TaggedSectionBody, visit: (s: TaggedSentence) => void): void {
  for (const p of body.paragraphs) {
    for (const s of p.sentences) visit(s);
  }
  for (const bb of body.bulletBlocks ?? []) walkTaggedSentences(bb, visit);
}

function taggedPayload(sections: ProjectedExplanationSection[]): unknown {
  return sections.map((s) => s.meta?.tagged);
}

function explanationShape(sections: ProjectedExplanationSection[]): Record<string, unknown> {
  return {
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      text: s.text,
      bullets: s.bullets,
      meta: s.meta,
    })),
  };
}

function main(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'p3');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['p3'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);

  const opts = {
    phaseD: true as const,
    surface: 'profile' as const,
    tier: 'extended' as const,
    narrativePlan: null as null,
  };

  const run1 = projectTextFromSemanticCore(core, 'phase3-det', opts);
  const run2 = projectTextFromSemanticCore(core, 'phase3-det', opts);

  assert(JSON.stringify(taggedPayload(run1)) === JSON.stringify(taggedPayload(run2)), 'tagging determinism: two runs');

  assertAllSectionsTagged(run1, 'test-phase3');

  for (const sec of run1) {
    const tagged = sec.meta!.tagged!;
    assert(reconstructTaggedSectionBody(tagged) === sec.text, `reconstruct body ${sec.id}`);
    walkTaggedSentences(tagged, (row) => {
      assert(row.text.length > 0, `non-empty sentence text ${sec.id}`);
      assert(PROVENANCE.has(row.provenance), `provenance enum ${sec.id} :: ${row.provenance}`);
      if (row.contentProvenance !== undefined) {
        assert(PROVENANCE.has(row.contentProvenance), `contentProvenance enum ${sec.id}`);
      }
    });
  }

  const expl = explanationShape(run1);
  const stripped1 = stripTaggedFromExplanationForHash(expl);
  const stripped2 = stripTaggedFromExplanationForHash(expl);
  assert(JSON.stringify(stripped1) === JSON.stringify(stripped2), 'strip tagged idempotent');

  const tampered = structuredClone(expl) as typeof expl;
  const firstSec = (tampered.sections as { meta?: Record<string, unknown> }[])[0];
  const firstMeta = firstSec?.meta;
  if (!firstMeta) throw new Error('[test-phase3-tagged-provenance] tamper: first section has meta');
  firstMeta.tagged = {
    paragraphs: [{ sentences: [{ text: 'bogus-only-for-strip-test', provenance: 'template' as const }] }],
  };
  assert(
    JSON.stringify(stripTaggedFromExplanationForHash(tampered)) === JSON.stringify(stripped1),
    'hash stability: differing meta.tagged must not change stripped explanation JSON'
  );

  console.log('[test-phase3-tagged-provenance] OK');
}

main();
