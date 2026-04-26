/**
 * Lyria lyria_spec_v1 tag-bucket collapse for aggregate relational weather audio only.
 */

import type { CompositionNarrativePlan } from '../vnext/audio/composition-narrative';
import type { ControlSurfacePayload } from '../vnext/explainer/contracts';
import type { Plan } from '../vnext/contracts';
import {
  buildLyriaPrompt,
  LYRIA_SPEC_V1_KEY_ORDER,
} from '../vnext/render/prompt-from-controls';
import { hashPrompt } from '../vnext/render/export-cache';

function parseBucketLine(prompt: string, key: 'chart_identity_tags' | 'facet_tags'): string[] {
  const line = prompt.split('\n').find((l) => l.startsWith(`${key}=`));
  if (!line) return [];
  const v = line.slice(`${key}=`.length);
  if (!v || v === 'none') return [];
  return v.split('|').filter(Boolean);
}

function stemHistogramAcrossTagBuckets(prompt: string): Map<string, number> {
  const tokens = [...parseBucketLine(prompt, 'chart_identity_tags'), ...parseBucketLine(prompt, 'facet_tags')];
  const m = new Map<string, number>();
  for (const t of tokens) {
    const i = t.indexOf('_');
    const stem = i === -1 ? t : t.slice(0, i);
    if (!stem) continue;
    m.set(stem, (m.get(stem) || 0) + 1);
  }
  return m;
}

function heavyTagsFixture(): {
  payload: ControlSurfacePayload;
  plan: Plan;
  narrative: CompositionNarrativePlan;
} {
  const payload: ControlSurfacePayload = {
    arc_shape: 0.45,
    density_level: 0.08,
    tempo_norm: 0.0,
    step_bias: 0.7,
    leap_cap: 4,
    rhythm_template_id: 3,
    syncopation_bias: 0.3,
    motif_rate: 0.6,
    element_dominance: 'water',
    aspect_tension: 0.08,
    modality: 'mutable',
    genre: 'house',
    hash: 'qa_lyria_tag_collapse_fixture_v1',
  };

  const plan: Plan = {
    id: 'plan_fixture',
    featureHash: 'v6',
    durationSec: 30,
    bpm: 100,
    key: 'C major',
    events: [],
    debug: {},
  };

  const narrative: CompositionNarrativePlan = {
    primaryElement: 'water',
    secondaryElement: 'air',
    modalityBalance: { cardinal: 0.2, fixed: 0.55, mutable: 0.55 },
    brightnessIndex: 0.5,
    tensionIndex: 0.2,
    resolutionIndex: 0.55,
    arcShape: 'cyclic',
    energyCurve: 'stable',
    peakWindow: 'mid',
    endingStyle: 'open',
    rhythmicDrive: 0.5,
    densityProfile: 'stable',
    tonalPolarity: 'balanced',
    stellium: { hasCluster: true, strength: 0.8, element: 'water' },
    angularDominance: { first: true, fourth: true, seventh: true, tenth: true },
    luminaryDominance: 'balanced',
    aspectSignatures: { trineHeavy: true, squareHeavy: true, oppositionHeavy: true },
    semantic_source_object_hash: '0'.repeat(64),
    toneHints: { brightness: 0.5, warmth: 0.5, clarity: 0.5 },
  };

  return { payload, plan, narrative };
}

describe('Lyria relational-weather prompt collapse', () => {
  it('same input + aggregate_relational_weather_v1 → byte-identical prompt', () => {
    const { payload, plan, narrative } = heavyTagsFixture();
    const a = buildLyriaPrompt(payload, plan, narrative, 'aggregate_relational_weather_v1');
    const b = buildLyriaPrompt(payload, plan, narrative, 'aggregate_relational_weather_v1');
    expect(a).toBe(b);
    expect(hashPrompt(a)).toBe(hashPrompt(b));
  });

  it('aggregate_relational_weather_v1 enforces stem caps (angle<=3, others<=2)', () => {
    const { payload, plan, narrative } = heavyTagsFixture();
    const prompt = buildLyriaPrompt(payload, plan, narrative, 'aggregate_relational_weather_v1');
    const hist = stemHistogramAcrossTagBuckets(prompt);
    for (const [stem, n] of hist) {
      if (stem === 'angle') expect(n).toBeLessThanOrEqual(3);
      else expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('lyria_spec_v1 key order and key count unchanged', () => {
    const { payload, plan, narrative } = heavyTagsFixture();
    const prompt = buildLyriaPrompt(payload, plan, narrative, 'aggregate_relational_weather_v1');
    const lines = prompt.split('\n').filter(Boolean);
    expect(lines.length).toBe(LYRIA_SPEC_V1_KEY_ORDER.length);
    const keys = lines.map((ln) => ln.split('=')[0]);
    expect(keys).toEqual([...LYRIA_SPEC_V1_KEY_ORDER]);
  });

  it('default profile prompt is byte-for-byte unchanged vs pre-profile 3-arg call shape', () => {
    const { payload, plan, narrative } = heavyTagsFixture();
    const implicit = buildLyriaPrompt(payload, plan, narrative);
    const explicitDefault = buildLyriaPrompt(payload, plan, narrative, 'default');
    expect(implicit).toBe(explicitDefault);
  });

  it('prompt hash changes only when aggregate_relational_weather_v1 alters tag buckets', () => {
    const { payload, plan, narrative } = heavyTagsFixture();
    const def = buildLyriaPrompt(payload, plan, narrative, 'default');
    const agg = buildLyriaPrompt(payload, plan, narrative, 'aggregate_relational_weather_v1');
    expect(hashPrompt(def)).not.toBe(hashPrompt(agg));
    const histDef = stemHistogramAcrossTagBuckets(def);
    const histAgg = stemHistogramAcrossTagBuckets(agg);
    const angleDef = histDef.get('angle') ?? 0;
    const angleAgg = histAgg.get('angle') ?? 0;
    expect(angleAgg).toBeLessThanOrEqual(angleDef);
  });
});
