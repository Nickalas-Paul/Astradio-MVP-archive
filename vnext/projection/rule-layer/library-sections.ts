import type { SnapshotAspect } from '../../contracts';
import type {
  ConnectionMode,
  ProjectedExplanationSection,
  ProjectionOptions,
  ProjectionSurface,
} from '../projection-types';
import { buildAspectKey, getAspectInsight, getRelationalInsight } from '../insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../insight-library/aspect-library-kill-list';
import { composeSynastryMepAspectParagraph } from '../insight-library/synastry-aspect-library-render';
import { taggedSectionBodyFromText } from '../tagged-text';

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
  if (params.surface !== 'group' && params.surface !== 'compat_pair') return [];

  const classCode = params.options.compatClassCode;
  const insight =
    classCode != null
      ? getRelationalInsight(classCode)
      : params.surface === 'group'
        ? getRelationalInsight('GROUP_RELATIONAL_FIELD_NEUTRAL')
        : undefined;
  if (!insight) return [];

  const connectionMode = params.options.connectionMode ?? 'none';
  const romanticPair =
    params.surface !== 'group' &&
    (connectionMode === 'lovers' || (connectionMode as string) === 'romantic');
  const contextText = romanticPair ? insight.romantic : insight.friendship;
  const text = [insight.core, insight.behavioral, contextText].filter(Boolean).join(' ');
  if (!text) return [];

  return [
    {
      id: 'relational_field',
      title: 'Relational Field',
      text,
      meta: {
        tagged: taggedSectionBodyFromText(text, 'claim_body'),
      },
    },
  ];
}
