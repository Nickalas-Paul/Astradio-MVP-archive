'use client';

import { usePlacementHighlight } from '@/core/PlacementHighlightContext';
import { SKY_SECTION_PLANETS } from '@/core/planet-identity';

export type ExplanationSection = {
  sectionId?: string;
  title: string;
  text?: string;
  bullets?: string[];
  planets?: string[];
};

/** Display title for section (new headings vs legacy Theme/Details/Bullets). */
const DISPLAY_TITLES: Record<string, string> = {
  "Astrological Signatures": "Astrological Signatures",
  "Personal Significance": "Personal Significance",
  "Musical Identity and Flow": "Musical Identity and Flow",
  Theme: "Astrological Signatures",
  Details: "Personal Significance",
  Bullets: "Musical Identity and Flow",
};

/** Canonical order for legacy explainer sections. */
const SECTION_ORDER: string[] = [
  "Astrological Signatures",
  "Personal Significance",
  "Musical Identity and Flow",
];

/** Home guest sky report section order (Phase 8C). */
const HOME_SECTION_IDS: string[] = ['todays_sound', 'sky_anchor', 'emotional_weather'];

const HOME_GRADIENT_SECTION_IDS = new Set(HOME_SECTION_IDS);

interface ExplanationPanelProps {
  composeHash: string;
  /** Legacy: single concatenated string (used when sections missing) */
  text?: string;
  /** Structured sections from explanation.sections (Theme, Details, Bullets) */
  sections?: ExplanationSection[];
  isLoading?: boolean;
  className?: string;
  /** When true, panel title is rendered by parent (e.g. Home Card header). */
  embedded?: boolean;
}

const PANEL_TITLE = 'Right now in the sky';
const FALLBACK_LOADING = 'Loading the sky report…';
const FALLBACK_DEFAULT =
  "Today's planetary alignment carries a distinct sonic character. Press play to hear what the sky sounds like right now.";

/** Split text into paragraphs (blank-line or double newline). Backend uses "\n\n" for paragraph breaks so factor correspondence lines render as separate paragraphs. */
function paragraphs(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** If both Theme and Details start with "Tone:", show Tone only in Theme; strip from Details for display. */
function dedupeTone(themeText: string, detailsText: string): string {
  if (!themeText.startsWith('Tone:') || !detailsText.startsWith('Tone:')) return detailsText;
  const toneEnd = detailsText.indexOf('.');
  const prefix = toneEnd > 0 ? detailsText.slice(0, toneEnd + 1).trim() : detailsText.match(/^Tone:[^.]*\.?/)?.[0]?.trim() ?? '';
  if (!prefix || !detailsText.startsWith(prefix)) return detailsText;
  return detailsText.slice(prefix.length).trim();
}

/** Parse legacy bullet text: split on bullet glyph, trim, return list items. */
function parseLegacyBullets(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text
    .split(/[•·]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sectionOrderKey(sec: ExplanationSection): number {
  const id = sec.sectionId ?? '';
  const homeIdx = HOME_SECTION_IDS.indexOf(id);
  if (homeIdx >= 0) return homeIdx;
  const title = DISPLAY_TITLES[sec.title] ?? DISPLAY_TITLES[id] ?? sec.title;
  const legacyIdx = SECTION_ORDER.indexOf(title);
  return legacyIdx >= 0 ? 100 + legacyIdx : 200;
}

function sectionHeadingClass(sec: ExplanationSection, embedded: boolean): string {
  const id = sec.sectionId ?? '';
  if (embedded) {
    return 'reading-section-header mb-3 first:mt-0';
  }
  if (HOME_GRADIENT_SECTION_IDS.has(id)) {
    return 'text-body-sm font-semibold tracking-wide mb-2 bg-gradient-to-r from-accent-light to-[#0bbfbf] bg-clip-text text-transparent';
  }
  return 'text-body-sm font-medium uppercase tracking-wide text-text-secondary mb-2';
}

export function ExplanationPanel({
  composeHash,
  text,
  sections,
  isLoading = false,
  className = '',
  embedded = false,
}: ExplanationPanelProps) {
  const { setHighlight, clearHighlight } = usePlacementHighlight();
  const hasSections = Array.isArray(sections) && sections.length > 0;
  const panelTitleClass = embedded
    ? 'reading-section-header mb-4'
    : 'text-h4 font-semibold text-text-primary';

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {!embedded && <h3 className={panelTitleClass}>{PANEL_TITLE}</h3>}
        <p className="text-body text-text-secondary">{FALLBACK_LOADING}</p>
      </div>
    );
  }

  if (hasSections) {
    const displayTitle = (s: ExplanationSection) =>
      DISPLAY_TITLES[s.title] ?? DISPLAY_TITLES[s.sectionId ?? ''] ?? s.title;
    const sorted = [...sections].sort((a, b) => sectionOrderKey(a) - sectionOrderKey(b));
    let previousText = '';
    return (
      <div className={`space-y-4 ${className}`}>
        {!embedded && <h3 className={panelTitleClass}>{PANEL_TITLE}</h3>}
        <div className="space-y-6 max-w-3xl">
          {sorted.map((sec, idx) => {
            const title = displayTitle(sec);
            let sectionText = sec.text ?? '';
            if (previousText.startsWith('Tone:') && sectionText.startsWith('Tone:')) {
              sectionText = dedupeTone(previousText, sectionText);
            }
            previousText = sec.text ?? '';
            const hasBullets = Array.isArray(sec.bullets) && sec.bullets.length > 0;
            const hasLegacyBulletText = !hasBullets && sec.text && /[•·]/.test(sec.text);
            if (!sectionText && !hasBullets && !hasLegacyBulletText) return null;

            const sectionId = sec.sectionId ?? '';
            const sectionPlanets =
              sec.planets ??
              (sectionId ? SKY_SECTION_PLANETS[sectionId] : undefined) ??
              [];

            return (
              <section
                key={sec.sectionId ?? sec.title ?? idx}
                className="rounded-lg border border-border bg-bgElev p-4"
                onMouseEnter={() => {
                  if (sectionPlanets.length) setHighlight(sectionPlanets);
                }}
                onMouseLeave={() => clearHighlight()}
              >
                <h3 className={sectionHeadingClass(sec, embedded)}>{title}</h3>
                {sectionText && (
                  <div className="text-body text-text-secondary space-y-2">
                    {paragraphs(sectionText).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    {paragraphs(sectionText).length === 0 && <p>{sectionText}</p>}
                  </div>
                )}
                {hasBullets && (
                  <ul className="list-disc list-inside space-y-1 text-text-secondary leading-relaxed mt-2">
                    {sec.bullets!.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {hasLegacyBulletText && (
                  <ul className="list-disc list-inside space-y-1 text-text-secondary leading-relaxed mt-2">
                    {parseLegacyBullets(sec.text!).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  const fallback = text && text.length > 0 ? text : composeHash ? FALLBACK_DEFAULT : FALLBACK_LOADING;
  return (
    <div className={`space-y-4 ${className}`}>
      {!embedded && <h3 className={panelTitleClass}>{PANEL_TITLE}</h3>}
      <div className="prose prose-invert max-w-3xl">
        <p className="text-body text-text-secondary">{fallback}</p>
      </div>
    </div>
  );
}

export default ExplanationPanel;
