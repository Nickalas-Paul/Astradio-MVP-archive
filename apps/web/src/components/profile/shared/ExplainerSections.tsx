import type { ProfileChartSection } from '../../../core/social/hooks';
import { stripReadingPresentationNoise } from '../../../lib/reading-presentation-filter';
import { IdentityMarkdown } from '../../shared/IdentityMarkdown';
import { SECTION_TITLES, sectionSortKey } from './profile-reading-utils';

export function ExplainerSections({
  sections,
  hideSectionIds,
}: {
  sections: ProfileChartSection[];
  hideSectionIds?: readonly string[];
}) {
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
      {sorted.map((sec) => (
        <section key={sec.id} className="rounded-lg border border-border bg-bgElev p-4">
          <h2 className="reading-section-header mb-3 first:mt-0">
            {SECTION_TITLES[sec.id] ?? sec.title}
          </h2>
          <IdentityMarkdown content={sec.text} />
          {sec.bullets && sec.bullets.length > 0 && (
            <ul className="mt-3 list-disc list-inside text-subtext text-sm space-y-1">
              {sec.bullets.map((b, i) => (
                <li key={i}>{stripReadingPresentationNoise(b)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
