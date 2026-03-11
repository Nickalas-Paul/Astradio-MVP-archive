import type { ChartTextInput, TextAnalysisIntermediate, AstroFacts, BodyRegistryEntry, AstroAspectFact } from '../contracts';
import { bodyOrderIndex, BODY_LABELS, CORE_BODIES } from '../../canonical-bodies';
import { topRankedAspects } from '../../aspect-priority';
import { buildAstroProfile } from '../../astro/profile-from-snapshot';

export function buildTextAnalysis(surface: ChartTextInput['surface'], input: ChartTextInput): TextAnalysisIntermediate {
  const { snapshot, relationalContext, algoVersion, toneVersion } = input;

  const bodyRegistry = buildBodyRegistry(snapshot.planets.map((p) => p.name));
  const astro_facts = buildAstroFacts(snapshot, relationalContext, bodyRegistry);

  const confidenceMissing = [...input.missing];
  if (!input.hasHouses) confidenceMissing.push({ kind: 'no_houses' });
  if (!input.hasAspects) confidenceMissing.push({ kind: 'no_aspects' });

  const confidenceScore = confidenceMissing.length === 0 ? 1 : Math.max(0.2, 1 - confidenceMissing.length * 0.15);

  return {
    surface,
    algoVersion,
    toneVersion,
    hasNatalContext: input.hasNatalContext,
    astro_facts,
    themes: [],
    tensions: [],
    opportunities: [],
    confidence: {
      score: confidenceScore,
      missing: confidenceMissing
    }
  };
}

function buildBodyRegistry(bodyNames: string[]): { all: BodyRegistryEntry[]; majors: BodyRegistryEntry[]; minors: BodyRegistryEntry[] } {
  const lower = bodyNames.map((n) => n.toLowerCase());
  const all: BodyRegistryEntry[] = [];
  for (const key of Object.keys(BODY_LABELS) as Array<keyof typeof BODY_LABELS>) {
    if (!lower.includes(key)) continue;
    const isMajor = CORE_BODIES.includes(key);
    all.push({
      key,
      name: BODY_LABELS[key],
      isMajor
    });
  }
  const majors = all.filter((b) => b.isMajor);
  const minors = all.filter((b) => !b.isMajor);
  return { all, majors, minors };
}

function buildAstroFacts(
  snapshot: import('../../contracts').EphemerisSnapshot,
  relationalContext: import('../../report-context').RelationalChartContext | undefined,
  bodyRegistry: { all: BodyRegistryEntry[]; majors: BodyRegistryEntry[]; minors: BodyRegistryEntry[] }
): AstroFacts {
  const profile = buildAstroProfile(snapshot);

  const placements = profile.planets.map((p) => ({
    id: `placement:${p.name}:${p.sign}:${p.house}`,
    body: p.name,
    sign: p.sign,
    house: p.house ?? null,
    nearAngle: p.nearAngle
  }));

  const houses = Array.from({ length: 12 }, (_, i) => {
    const houseNum = i + 1;
    const count = placements.filter((p) => p.house === houseNum).length;
    return {
      house: houseNum,
      weight: count
    };
  });

  const aspectsSource = relationalContext?.aspects?.length ? relationalContext.aspects : snapshot.aspects;
  const ranked = topRankedAspects(aspectsSource as any, 64);

  const aspects: AstroAspectFact[] = ranked.map((asp, idx) => {
    const base = typeof asp.priorityBase === 'number' ? asp.priorityBase : 0;
    const strength = typeof asp.strength === 'number' ? asp.strength : 0;
    const exactness = typeof asp.exactness === 'number' ? asp.exactness : 0;
    const aBody = asp.bodyA ?? asp.a ?? '';
    const bBody = asp.bodyB ?? asp.b ?? '';
    const orderIndex = bodyOrderIndex(aBody.toLowerCase()) + bodyOrderIndex(bBody.toLowerCase());
    return {
      id: `aspect:${aBody}-${asp.type}-${bBody}`,
      aspect: {
        bodyA: aBody,
        bodyB: bBody,
        type: asp.type as any,
        orb: asp.orb ?? 0,
        exactAngle: asp.exactAngle,
        dynamics: asp.dynamics as any,
        strength: asp.strength,
        exactness: asp.exactness,
        priorityBase: asp.priorityBase
      },
      ranking: {
        priorityBase: base,
        strength,
        exactness,
        orderIndex: orderIndex + idx * 0.001
      }
    };
  });

  return {
    placements,
    houses,
    aspects,
    bodyRegistry
  };
}

