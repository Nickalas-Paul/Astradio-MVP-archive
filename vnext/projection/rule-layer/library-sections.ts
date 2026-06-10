import type { EphemerisSnapshot, SnapshotAspect } from '../../contracts';
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
} from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { composeSynastryMepAspectParagraph } from '../insight-library/synastry-aspect-library-render';
import { taggedSectionBodyFromText } from '../tagged-text';
import { capToMaxSentences } from './claim-synthesize';

function formatPlanetName(planet: string): string {
  const p = String(planet || '').toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function formatAspectName(aspect: string): string {
  return String(aspect || '').toLowerCase();
}

function buildAspectHeader(bodyA: string, type: string, bodyB: string): string {
  return `### ${formatPlanetName(bodyA)} ${formatAspectName(type)} ${formatPlanetName(bodyB)}`;
}

function assembleProfileIdentityAspectBlock(
  aspect: Pick<SnapshotAspect, 'bodyA' | 'bodyB' | 'type'>,
  insight: NonNullable<ReturnType<typeof getAspectInsight>>,
): string | null {
  const selfCore = insight.core_self || insight.core_synastry || insight.core || '';
  const selfBehavioral =
    insight.behavioral_self || insight.behavioral_synastry || insight.behavioral || '';
  const coreText = capToMaxSentences(selfCore, 2);
  const behavioralText = capToMaxSentences(selfBehavioral, 1);
  const body = [coreText, behavioralText].filter(Boolean).join('\n\n');
  if (!body) return null;

  const header = buildAspectHeader(
    String(aspect.bodyA),
    String(aspect.type),
    String(aspect.bodyB),
  );
  return `${header}\n\n${body}`;
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

  const collectedAspectKeys: string[] = [];
  const paragraphs = rawAspects
    .slice(0, count)
    .map((aspect) => {
      const key = buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type);
      if (isAspectLibraryKillListed(key)) return null;
      const insight = getAspectInsight(key);
      if (!insight) return null;

      let paragraph: string | null = null;
      if (params.surface === 'compat_pair') {
        paragraph = composeSynastryMepAspectParagraph(insight, romantic ? 'romantic' : 'friendship');
      } else if (params.surface === 'profile' || params.surface === 'sandbox') {
        paragraph = assembleProfileIdentityAspectBlock(aspect, insight);
      } else {
        paragraph = [insight.core, insight.behavioral].filter(Boolean).join(' ');
      }

      if (paragraph) collectedAspectKeys.push(key);
      return paragraph;
    })
    .filter((text): text is string => Boolean(text));

  if (paragraphs.length === 0) return [];

  const text = paragraphs.join('\n\n');
  return [
    {
      id: 'aspects',
      title: 'Planetary Relationships',
      text,
      meta: {
        tagged: taggedSectionBodyFromText(text, 'template'),
        aspectKeys: collectedAspectKeys,
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
