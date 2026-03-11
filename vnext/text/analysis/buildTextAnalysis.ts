import type {
  ChartTextInput,
  TextAnalysisIntermediate,
  AstroFacts,
  BodyRegistryEntry,
  AstroAspectFact,
  AnalysisTheme,
  AnalysisTension,
  AnalysisOpportunity
} from '../contracts';
import { bodyOrderIndex, BODY_LABELS, CORE_BODIES } from '../../canonical-bodies';
import { topRankedAspects } from '../../aspect-priority';
import { buildAstroProfile } from '../../astro/profile-from-snapshot';

export function buildTextAnalysis(surface: ChartTextInput['surface'], input: ChartTextInput): TextAnalysisIntermediate {
  const { snapshot, relationalContext, algoVersion, toneVersion } = input;

  const bodyRegistry = buildBodyRegistry(snapshot.planets.map((p) => p.name));
  const astro_facts = buildAstroFacts(snapshot, relationalContext, bodyRegistry);

  const themes = synthesizeThemes(astro_facts);
  const tensions = synthesizeTensions(astro_facts);
  const opportunities = synthesizeOpportunities(astro_facts, themes, tensions);

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
    themes,
    tensions,
    opportunities,
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

function synthesizeThemes(astro: AstroFacts): AnalysisTheme[] {
  if (astro.aspects.length === 0 && astro.placements.length === 0) return [];

  const bodyScores = new Map<string, number>();

  const majorSet = new Set(astro.bodyRegistry.majors.map((b) => b.key.toLowerCase()));
  const minorSet = new Set(astro.bodyRegistry.minors.map((b) => b.key.toLowerCase()));

  for (const asp of astro.aspects) {
    const a = asp.aspect.bodyA;
    const b = asp.aspect.bodyB;
    const bodies = [a, b].filter(Boolean);
    if (bodies.length === 0) continue;

    const base = (asp.ranking.priorityBase ?? 0) + (asp.ranking.strength ?? 0) + (asp.ranking.exactness ?? 0);
    const normalized = base / 3 || 0;

    for (const body of bodies) {
      const key = body.toLowerCase();
      const importance = majorSet.has(key) ? 1 : minorSet.has(key) ? 0.35 : 0.5;
      const current = bodyScores.get(key) ?? 0;
      bodyScores.set(key, current + normalized * importance);
    }
  }

  for (const placement of astro.placements) {
    if (!placement.house) continue;
    const key = placement.body.toLowerCase();
    const importance = majorSet.has(key) ? 1 : minorSet.has(key) ? 0.35 : 0.5;
    const angularBoost = placement.nearAngle ? 0.5 : 0.1;
    const current = bodyScores.get(key) ?? 0;
    bodyScores.set(key, current + angularBoost * importance);
  }

  const entries = Array.from(bodyScores.entries());
  if (entries.length === 0) return [];

  entries.sort((a, b) => b[1] - a[1]);

  const topBodies = entries.slice(0, 3);

  const byId = new Map<string, AnalysisTheme>();
  const placementsById = astro.placements;
  const aspectsById = astro.aspects;

  const houseWeights = astro.houses.slice().sort((a, b) => b.weight - a.weight);
  const topHouse = houseWeights[0];

  for (const [idx, [bodyKey, score]] of topBodies.entries()) {
    const displayName =
      astro.bodyRegistry.all.find((b) => b.key.toLowerCase() === bodyKey)?.name ??
      bodyKey.charAt(0).toUpperCase() + bodyKey.slice(1);

    const relatedPlacements = placementsById.filter((p) => p.body.toLowerCase() === bodyKey);
    const relatedAspects = aspectsById.filter(
      (a) => a.aspect.bodyA.toLowerCase() === bodyKey || a.aspect.bodyB.toLowerCase() === bodyKey
    );

    const factIds = [
      ...relatedPlacements.map((p) => p.id),
      ...relatedAspects.map((a) => a.id)
    ];

    if (factIds.length === 0) continue;

    const hasAngularPlacement = relatedPlacements.some((p) => p.nearAngle != null);
    const normalizedScore = score / (entries[0][1] || 1);
    const angularBoost = hasAngularPlacement ? 0.15 : 0;
    const houseBoost =
      topHouse && relatedPlacements.some((p) => p.house === topHouse.house) && topHouse.weight > 1
        ? Math.min(0.2, topHouse.weight * 0.03)
        : 0;

    const weight = Math.min(1, Math.max(0, normalizedScore + angularBoost + houseBoost));

    const id = `theme:body:${bodyKey}`;
    const existing = byId.get(id);
    if (existing) {
      const mergedFacts = new Set([...existing.citations.factIds, ...factIds]);
      const mergedWeight = Math.max(existing.weight, weight);
      byId.set(id, {
        ...existing,
        weight: mergedWeight,
        citations: { factIds: Array.from(mergedFacts) }
      });
    } else {
      byId.set(id, {
        id,
        label: `${displayName.toLowerCase()} emphasis`,
        weight,
        citations: { factIds }
      });
    }
  }

  if (topHouse && topHouse.weight >= 3) {
    const housePlacements = placementsById.filter((p) => p.house === topHouse.house);
    const factIds = housePlacements.map((p) => p.id);
    if (factIds.length > 0) {
      const base = Math.min(1, 0.4 + topHouse.weight * 0.05);
      const id = `theme:house:${topHouse.house}`;
      const existing = byId.get(id);
      if (existing) {
        const mergedFacts = new Set([...existing.citations.factIds, ...factIds]);
        const mergedWeight = Math.max(existing.weight, base);
        byId.set(id, {
          ...existing,
          weight: mergedWeight,
          citations: { factIds: Array.from(mergedFacts) }
        });
      } else {
        byId.set(id, {
          id,
          label: `house ${topHouse.house} focus`,
          weight: base,
          citations: { factIds }
        });
      }
    }
  }

  const result = Array.from(byId.values());
  result.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const ac = a.citations.factIds.length;
    const bc = b.citations.factIds.length;
    if (bc !== ac) return bc - ac;
    return a.id.localeCompare(b.id);
  });
  return result;
}

function synthesizeTensions(astro: AstroFacts): AnalysisTension[] {
  if (astro.aspects.length === 0) return [];

  const majors = new Set(astro.bodyRegistry.majors.map((b) => b.key.toLowerCase()));
  const minors = new Set(astro.bodyRegistry.minors.map((b) => b.key.toLowerCase()));

  const byId = new Map<string, AnalysisTension>();

  for (const asp of astro.aspects) {
    const { bodyA, bodyB, type, dynamics } = asp.aspect as any;
    const aKey = (bodyA ?? '').toLowerCase();
    const bKey = (bodyB ?? '').toLowerCase();

    const hardTypes = new Set(['square', 'opposition', 'quincunx']);
    const softTypes = new Set(['trine', 'sextile']);

    const isHard = hardTypes.has(String(type).toLowerCase()) || String(dynamics ?? '').toLowerCase() === 'hard';
    const isSoft = softTypes.has(String(type).toLowerCase()) || String(dynamics ?? '').toLowerCase() === 'soft';

    if (!isHard && !isSoft) continue;

    const priorityBase = asp.ranking.priorityBase ?? 0;
    const strength = asp.ranking.strength ?? 0;
    const exactness = asp.ranking.exactness ?? 0;

    const baseScore = (priorityBase + strength + exactness) / 3;

    const aImportance = majors.has(aKey) ? 1 : minors.has(aKey) ? 0.4 : 0.6;
    const bImportance = majors.has(bKey) ? 1 : minors.has(bKey) ? 0.4 : 0.6;
    const importance = (aImportance + bImportance) / 2;

    let polarity: AnalysisTension['polarity'];
    if (isHard && isSoft) polarity = 'mixed';
    else if (isHard) polarity = 'tension';
    else polarity = 'support';

    let weight = baseScore * importance;
    if (polarity === 'tension') weight *= 1.1;
    if (!majors.has(aKey) || !majors.has(bKey)) {
      weight *= 0.6;
    }
    weight = Math.min(1, Math.max(0, weight));

    if (weight < 0.05) continue;

    const id = `tension:${asp.id}`;
    const labelBase = `${bodyA} ${type} ${bodyB}`;
    const labelSuffix =
      polarity === 'tension' ? 'friction' : polarity === 'support' ? 'support' : 'mixed dynamic';

    const factIds = [asp.id];

    // Soft aspects appear here with polarity "support"; opportunities are
    // used to represent integration pathways rather than raw aspect dynamics.
    const existing = byId.get(id);
    if (existing) {
      const mergedFacts = new Set([...existing.citations.factIds, ...factIds]);
      const mergedWeight = Math.max(existing.weight, weight);
      byId.set(id, {
        ...existing,
        weight: mergedWeight,
        citations: { factIds: Array.from(mergedFacts) }
      });
    } else {
      byId.set(id, {
        id,
        label: `${labelBase} ${labelSuffix}`,
        weight,
        polarity,
        citations: { factIds }
      });
    }
  }

  const result = Array.from(byId.values());
  result.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const ac = a.citations.factIds.length;
    const bc = b.citations.factIds.length;
    if (bc !== ac) return bc - ac;
    return a.id.localeCompare(b.id);
  });
  return result.slice(0, 8);
}

function synthesizeOpportunities(astro: AstroFacts, themes: AnalysisTheme[], tensions: AnalysisTension[]): AnalysisOpportunity[] {
  if (astro.aspects.length === 0) return [];

  const majors = new Set(astro.bodyRegistry.majors.map((b) => b.key.toLowerCase()));
  const minors = new Set(astro.bodyRegistry.minors.map((b) => b.key.toLowerCase()));

  const tensionByBody = new Map<string, number>();
  for (const t of tensions) {
    if (t.polarity !== 'tension') continue;
    for (const id of t.citations.factIds) {
      const aspect = astro.aspects.find((a) => a.id === id);
      if (!aspect) continue;
      const { bodyA, bodyB } = aspect.aspect as any;
      for (const body of [bodyA, bodyB]) {
        if (!body) continue;
        const key = body.toLowerCase();
        const current = tensionByBody.get(key) ?? 0;
        tensionByBody.set(key, current + t.weight);
      }
    }
  }

  const byId = new Map<string, AnalysisOpportunity>();

  for (const asp of astro.aspects) {
    const { bodyA, bodyB, type, dynamics } = asp.aspect as any;
    const aKey = (bodyA ?? '').toLowerCase();
    const bKey = (bodyB ?? '').toLowerCase();

    const softTypes = new Set(['trine', 'sextile']);
    const isSoft = softTypes.has(String(type).toLowerCase()) || String(dynamics ?? '').toLowerCase() === 'soft';
    if (!isSoft) continue;

    const priorityBase = asp.ranking.priorityBase ?? 0;
    const strength = asp.ranking.strength ?? 0;
    const exactness = asp.ranking.exactness ?? 0;

    const baseScore = (priorityBase + strength + exactness) / 3;

    const aImportance = majors.has(aKey) ? 1 : minors.has(aKey) ? 0.4 : 0.6;
    const bImportance = majors.has(bKey) ? 1 : minors.has(bKey) ? 0.4 : 0.6;
    const importance = (aImportance + bImportance) / 2;

    const tensionScore = ((tensionByBody.get(aKey) ?? 0) + (tensionByBody.get(bKey) ?? 0)) / 2;
    const tensionBoost = Math.min(0.3, tensionScore * 0.2);

    let weight = baseScore * importance + tensionBoost;
    if (!majors.has(aKey) || !majors.has(bKey)) {
      weight *= 0.6;
    }
    weight = Math.min(1, Math.max(0, weight));

    if (weight < 0.05) continue;

    const id = `opportunity:${asp.id}`;
    const label = `${bodyA} ${type} ${bodyB} opportunity`;
    const factIds = [asp.id];

    const existing = byId.get(id);
    if (existing) {
      const mergedFacts = new Set([...existing.citations.factIds, ...factIds]);
      const mergedWeight = Math.max(existing.weight, weight);
      byId.set(id, {
        ...existing,
        weight: mergedWeight,
        citations: { factIds: Array.from(mergedFacts) }
      });
    } else {
      byId.set(id, {
        id,
        label,
        weight,
        citations: { factIds }
      });
    }
  }

  for (const theme of themes.slice(0, 3)) {
    const bodiesFromTheme = new Set<string>();
    for (const factId of theme.citations.factIds) {
      const aspect = astro.aspects.find((a) => a.id === factId);
      if (!aspect) continue;
      const { bodyA, bodyB } = aspect.aspect as any;
      if (bodyA) bodiesFromTheme.add(bodyA.toLowerCase());
      if (bodyB) bodiesFromTheme.add(bodyB.toLowerCase());
    }
    if (bodiesFromTheme.size === 0) continue;

    const softAspects = astro.aspects.filter((a) => {
      const { bodyA, bodyB, type, dynamics } = a.aspect as any;
      const aKey = (bodyA ?? '').toLowerCase();
      const bKey = (bodyB ?? '').toLowerCase();
      const softTypes = new Set(['trine', 'sextile']);
      const isSoft = softTypes.has(String(type).toLowerCase()) || String(dynamics ?? '').toLowerCase() === 'soft';
      if (!isSoft) return false;
      return bodiesFromTheme.has(aKey) || bodiesFromTheme.has(bKey);
    });

    if (softAspects.length === 0) continue;

    const representative = softAspects[0];
    const base = (representative.ranking.priorityBase ?? 0) + (representative.ranking.strength ?? 0);
    const normalized = base / 2 || 0.1;
    const weight = Math.min(1, Math.max(0.2, normalized));

    const factIds = softAspects.map((a) => a.id);

    const id = `opportunity:integration:${theme.id}`;
    const existing = byId.get(id);
    if (existing) {
      const mergedFacts = new Set([...existing.citations.factIds, ...factIds]);
      const mergedWeight = Math.max(existing.weight, weight);
      byId.set(id, {
        ...existing,
        weight: mergedWeight,
        citations: { factIds: Array.from(mergedFacts) }
      });
    } else {
      byId.set(id, {
        id,
        label: `${theme.label} integration`,
        weight,
        citations: { factIds }
      });
    }
  }

  const result = Array.from(byId.values());
  result.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const ac = a.citations.factIds.length;
    const bc = b.citations.factIds.length;
    if (bc !== ac) return bc - ac;
    return a.id.localeCompare(b.id);
  });
  return result.slice(0, 8);
}


