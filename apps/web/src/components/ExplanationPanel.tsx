'use client';

export type ExplanationSection = {
  sectionId?: string;
  title: string;
  text?: string;
  bullets?: string[];
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

/** Canonical order for sections. */
const SECTION_ORDER = ["Astrological Signatures", "Personal Significance", "Musical Identity and Flow"] as const;

interface ExplanationPanelProps {
  composeHash: string;
  /** Legacy: single concatenated string (used when sections missing) */
  text?: string;
  /** Structured sections from explanation.sections (Theme, Details, Bullets) */
  sections?: ExplanationSection[];
  isLoading?: boolean;
  className?: string;
}

const FALLBACK_LOADING = 'Loading astrological analysis...';
const FALLBACK_DEFAULT = "Your natal chart combined with today's transits creates a unique musical signature. The planetary positions influence the tempo, harmony, and emotional tone of your personalized soundtrack.";

/** Split text into paragraphs (blank-line or double newline). */
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

export function ExplanationPanel({
  composeHash,
  text,
  sections,
  isLoading = false,
  className = '',
}: ExplanationPanelProps) {
  const hasSections = Array.isArray(sections) && sections.length > 0;

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-semibold text-zinc-100">Astrological Analysis</h3>
        <p className="text-zinc-400 leading-relaxed">{FALLBACK_LOADING}</p>
      </div>
    );
  }

  if (hasSections) {
    const displayTitle = (s: ExplanationSection) =>
      DISPLAY_TITLES[s.title] ?? DISPLAY_TITLES[s.sectionId ?? ''] ?? s.title;
    const orderKey = (s: ExplanationSection) => {
      const t = displayTitle(s);
      const i = SECTION_ORDER.indexOf(t);
      return i >= 0 ? i : SECTION_ORDER.length;
    };
    const sorted = [...sections].sort((a, b) => orderKey(a) - orderKey(b));
    let previousText = '';
    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-semibold text-zinc-100">Astrological Analysis</h3>
        <div className="prose prose-invert max-w-none space-y-5">
          {sorted.map((sec, idx) => {
            const title = displayTitle(sec);
            let text = sec.text ?? '';
            if (previousText.startsWith('Tone:') && text.startsWith('Tone:')) {
              text = dedupeTone(previousText, text);
            }
            previousText = sec.text ?? '';
            const hasBullets = Array.isArray(sec.bullets) && sec.bullets.length > 0;
            const hasLegacyBulletText = !hasBullets && sec.text && /[•·]/.test(sec.text);
            if (!text && !hasBullets && !hasLegacyBulletText) return null;
            return (
              <section key={sec.sectionId ?? sec.title ?? idx}>
                <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-300 mb-2">{title}</h4>
                {text && (
                  <div className="text-zinc-400 leading-relaxed space-y-2">
                    {paragraphs(text).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                    {paragraphs(text).length === 0 && <p>{text}</p>}
                  </div>
                )}
                {hasBullets && (
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 leading-relaxed mt-2">
                    {sec.bullets!.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {hasLegacyBulletText && (
                  <ul className="list-disc list-inside space-y-1 text-zinc-400 leading-relaxed mt-2">
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
      <h3 className="text-lg font-semibold text-zinc-100">Astrological Analysis</h3>
      <div className="prose prose-invert max-w-none">
        <p className="text-zinc-400 leading-relaxed">{fallback}</p>
      </div>
    </div>
  );
}

export default ExplanationPanel;
