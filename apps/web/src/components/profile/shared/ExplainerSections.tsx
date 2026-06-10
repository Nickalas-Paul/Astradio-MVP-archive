'use client';

import type { ProfileChartSection } from '../../../core/social/hooks';
import { stripReadingPresentationNoise } from '../../../lib/reading-presentation-filter';
import { usePlacementHighlight } from '../../../core/PlacementHighlightContext';
import { IDENTITY_TIER_PLANETS, parsePlanetNamesFromAspectKey } from '../../../core/planet-identity';
import { IdentityMarkdown } from '../../shared/IdentityMarkdown';
import { SECTION_TITLES, sectionSortKey } from './profile-reading-utils';

function sectionHighlightPlanets(sec: ProfileChartSection): string[] {
  if (sec.planets?.length) return sec.planets;
  if (sec.id === 'aspects' && sec.aspectKeys?.length) {
    return [...new Set(sec.aspectKeys.flatMap((k) => parsePlanetNamesFromAspectKey(k)))];
  }
  return IDENTITY_TIER_PLANETS[sec.id] ?? [];
}

export function ExplainerSections({
  sections,
  hideSectionIds,
}: {
  sections: ProfileChartSection[];
  hideSectionIds?: readonly string[];
}) {
  const { setHighlight, clearHighlight } = usePlacementHighlight();
  const hidden = hideSectionIds ? new Set(hideSectionIds) : null;
  const visible = hidden ? sections.filter((s) => !hidden.has(s.id)) : sections;
  const sorted = [...visible].sort((a, b) => {
    const da = sectionSortKey(a.id);
    const db = sectionSortKey(b.id);
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id, 'en');
  });
  return (
    <div className="space-y-6">
      {sorted.map((sec) => {
        const planets = sectionHighlightPlanets(sec);
        return (
          <section
            key={sec.id}
            className="rounded-lg border border-border bg-bgElev p-4"
            onMouseEnter={() => {
              if (planets.length) setHighlight(planets);
            }}
            onMouseLeave={() => clearHighlight()}
          >
            <h2 className="reading-section-header mb-3 first:mt-0">
              {SECTION_TITLES[sec.id] ?? sec.title}
            </h2>
            <IdentityMarkdown content={sec.text} sectionPlanets={planets} />
            {sec.bullets && sec.bullets.length > 0 && (
              <ul className="mt-3 list-disc list-inside text-body text-text-secondary space-y-1">
                {sec.bullets.map((b, i) => (
                  <li key={i}>{stripReadingPresentationNoise(b)}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
