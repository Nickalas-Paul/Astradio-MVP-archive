import type { EphemerisSnapshot, SnapshotAspect } from '../../contracts';
import type { SemanticCore } from '../../semantic/semantic-core';
import type {
  ConnectionMode,
  ProjectedExplanationSection,
  ProjectionOptions,
  ProjectionSurface,
} from '../projection-types';
import {
  buildAspectKey,
  getAspectInsight,
  getRelationalInsight,
  getStructuralInsight,
} from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { composeSynastryMepAspectParagraph } from '../insight-library/synastry-aspect-library-render';
import { taggedSectionBodyFromText } from '../tagged-text';
import { buildPlacementKeys, type PlacementKey } from '../placement-keys';
import { capToMaxSentences } from './claim-synthesize';

const HOME_PERSONAL_LANGUAGE_RE =
  /\b(your|yours|you|yourself|this person|these two|connection|between these|core_transit|behavioral_transit)\b/i;
const HOME_OWNED_CHART_LANGUAGE_RE = /\b(the person|the person's|their|they|them|his|her)\b/i;

function isHomeSafe(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return Boolean(normalized) && !HOME_PERSONAL_LANGUAGE_RE.test(normalized) && !HOME_OWNED_CHART_LANGUAGE_RE.test(normalized);
}

function splitHomeSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractHomeSafeText(text: string | undefined, maxSentences: number): string | null {
  if (!text) return null;
  const safeSentences = splitHomeSentences(text).filter(isHomeSafe).slice(0, maxSentences);
  if (safeSentences.length === 0) return null;
  return safeSentences.join(' ');
}

function sectionFromHomeText(id: string, title: string, text: string): ProjectedExplanationSection {
  return {
    id,
    title,
    text,
    meta: {
      tagged: taggedSectionBodyFromText(text, 'claim_body'),
      claimIdsReferenced: [],
      phaseD: true,
    },
  };
}

function getHomePlacementText(placement: PlacementKey, maxSentences: number): string | null {
  const insight = getAspectInsight(placement.signKey);
  if (!insight) return null;
  return extractHomeSafeText(insight.feed, maxSentences) ?? extractHomeSafeText(insight.core, maxSentences);
}

function getCoveredAspectKeys(snapshot: EphemerisSnapshot): string[] {
  return (snapshot.aspects ?? [])
    .map((aspect) => buildAspectKey(String(aspect.bodyA), String(aspect.bodyB), String(aspect.type)))
    .filter((key) => !isAspectLibraryKillListed(key) && Boolean(getAspectInsight(key)))
    .slice(0, 3);
}

function findActivePattern(snapshot: EphemerisSnapshot, core: SemanticCore): { text: string } | null {
  for (const aspectKey of getCoveredAspectKeys(snapshot).slice(0, 2)) {
    const insight = getAspectInsight(aspectKey);
    const text = extractHomeSafeText(insight?.core, 3) ?? extractHomeSafeText(insight?.behavioral, 3);
    if (text) {
      return { text: capToMaxSentences(text, 3) };
    }
  }

  for (const claim of core.claims.slice(0, 5)) {
    const insight = getStructuralInsight(claim.claim_id);
    const text = extractHomeSafeText(insight?.core, 3);
    if (text) {
      return { text: capToMaxSentences(text, 3) };
    }
  }

  return null;
}

function buildHomeSonicSection(params: {
  sunPlacement: PlacementKey;
  moonPlacement: PlacementKey;
  aspectKeys: readonly string[];
}): ProjectedExplanationSection | null {
  const sonicParts: string[] = [];
  for (const key of [params.sunPlacement.signKey, params.moonPlacement.signKey]) {
    const sonic = getAspectInsight(key)?.sonic;
    if (sonic && isHomeSafe(sonic)) {
      sonicParts.push(capToMaxSentences(sonic, 6));
    }
  }

  for (const aspectKey of params.aspectKeys.slice(0, 1)) {
    const sonic = getAspectInsight(aspectKey)?.sonic;
    if (sonic && isHomeSafe(sonic)) {
      sonicParts.push(capToMaxSentences(sonic, 6));
    }
  }

  if (sonicParts.length === 0) return null;
  return sectionFromHomeText('sonic_signature', "Today's Sonic Signature", sonicParts.join('\n\n'));
}

/**
 * Phase 4B: HOME daily sky report for the public landing page.
 *
 * Builds from current-sky library content only:
 * 1. Sun sign anchor
 * 2. Moon sign emotional weather
 * 3. Current aspect/structural active pattern
 * 4. Sonic signature showcase
 */
export function assembleHomeDailySections(params: {
  snapshot: EphemerisSnapshot;
  core: SemanticCore;
  surface: ProjectionSurface;
}): ProjectedExplanationSection[] {
  if (params.surface !== 'daily') return [];

  const placements = buildPlacementKeys(params.snapshot);
  const sunPlacement = placements.find((placement) => placement.planet === 'SUN');
  const moonPlacement = placements.find((placement) => placement.planet === 'MOON');
  if (!sunPlacement || !moonPlacement) return [];

  const sections: ProjectedExplanationSection[] = [];
  const sunText = getHomePlacementText(sunPlacement, 3);
  if (sunText) {
    sections.push(sectionFromHomeText('today_sky_anchor', "Today's Sky Anchor", sunText));
  }

  const moonText = getHomePlacementText(moonPlacement, 3);
  if (moonText) {
    sections.push(sectionFromHomeText('emotional_weather', 'Emotional Weather', moonText));
  }

  const activePattern = findActivePattern(params.snapshot, params.core);
  if (activePattern) {
    sections.push(sectionFromHomeText('active_pattern', 'Active Pattern', activePattern.text));
  }

  const sonicSection = buildHomeSonicSection({
    sunPlacement,
    moonPlacement,
    aspectKeys: getCoveredAspectKeys(params.snapshot),
  });
  if (sonicSection) {
    sections.push(sonicSection);
  }

  return sections;
}

function aspectsForLibrarySection(options: ProjectionOptions): readonly Pick<SnapshotAspect, 'bodyA' | 'bodyB' | 'type'>[] {
  if (options.pairInteractionAspects != null && options.pairInteractionAspects.length > 0) {
    return options.pairInteractionAspects;
  }
  if (options.pairInteractionAspectsV2 != null && options.pairInteractionAspectsV2.length > 0) {
    return options.pairInteractionAspectsV2;
  }
  return options.snapshotAspects ?? [];
}

export function assembleLibraryPlanetaryAspects(params: {
  options: ProjectionOptions;
  surface: ProjectionSurface;
  connectionMode?: ConnectionMode;
  maxAspects?: number;
}): ProjectedExplanationSection[] {
  if (params.surface === 'group' || params.surface === 'feed' || params.surface === 'overlay_pair') return [];

  const rawAspects = aspectsForLibrarySection(params.options);
  if (rawAspects.length === 0) return [];

  const count = params.maxAspects ?? 5;
  const romantic =
    params.connectionMode === 'lovers' || (params.connectionMode as string | undefined) === 'romantic';

  const paragraphs = rawAspects
    .slice(0, count)
    .map((aspect) => {
      const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
      if (isAspectLibraryKillListed(key)) return null;
      const insight = getAspectInsight(key);
      if (!insight) return null;

      if (params.surface === 'compat_pair') {
        return composeSynastryMepAspectParagraph(insight, romantic ? 'romantic' : 'friendship');
      }

      if (params.surface === 'profile') {
        const coreText = capToMaxSentences(insight.core || '', 2);
        const behavioralText = capToMaxSentences(insight.behavioral || '', 1);
        return [coreText, behavioralText].filter(Boolean).join(' ');
      }

      return [insight.core, insight.behavioral].filter(Boolean).join(' ');
    })
    .filter((text): text is string => Boolean(text));

  if (paragraphs.length === 0) return [];

  const text = paragraphs.join('\n\n---\n\n');
  return [
    {
      id: 'aspects',
      title: 'Planetary Relationships',
      text,
      meta: {
        tagged: taggedSectionBodyFromText(text, 'template'),
      },
    },
  ];
}

export function assembleLibraryRelationalField(params: {
  options: ProjectionOptions;
  surface: ProjectionSurface;
}): ProjectedExplanationSection[] {
  const classCode = params.options.compatClassCode;
  if (!classCode) return [];

  const compatInsight = getRelationalInsight(classCode);
  if (!compatInsight) return [];

  const connectionMode = params.options.connectionMode ?? 'none';
  const effSurface = params.options.surface ?? params.surface;
  const romanticPairSurface =
    params.surface !== 'group' &&
    (connectionMode === 'lovers' || (connectionMode as string) === 'romantic');
  const context = romanticPairSurface ? 'romantic' : (effSurface as string) === 'discovery' ? 'discovery' : 'friendship';
  const contextText =
    context === 'romantic'
      ? compatInsight.romantic
      : context === 'discovery'
        ? compatInsight.discovery
        : compatInsight.friendship;
  const libraryText = [compatInsight.core, compatInsight.behavioral, contextText].filter(Boolean).join(' ');
  if (!libraryText) return [];

  return [
    {
      id: 'relational_field',
      title: 'Relational Field',
      text: libraryText,
      meta: {
        tagged: taggedSectionBodyFromText(libraryText, 'claim_body'),
      },
    },
  ];
}

export function assembleLibraryRelationalWeather(params: {
  options: ProjectionOptions;
  surface: ProjectionSurface;
}): ProjectedExplanationSection[] {
  const themes: readonly string[] = params.options.relationalWeatherThemes ?? [];
  const primaryTheme = themes[0];
  if (!primaryTheme) return [];

  const weatherInsight = getRelationalInsight(primaryTheme);
  if (!weatherInsight) return [];

  const effSurface = params.options.surface ?? params.surface;
  const weatherText =
    effSurface === 'feed'
      ? weatherInsight.feed
      : [weatherInsight.core, weatherInsight.behavioral].filter(Boolean).join(' ');
  if (!weatherText) return [];

  return [
    {
      id: 'relational_weather_v1',
      title: 'Relational Field (Structural)',
      text: weatherText,
      meta: {
        tagged: taggedSectionBodyFromText(weatherText, 'claim_body'),
      },
    },
  ];
}
