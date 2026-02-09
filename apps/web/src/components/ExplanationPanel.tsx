'use client';

export type ExplanationSection = {
  title: string;
  text?: string;
  bullets?: string[];
};

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
    const themeSection = sections.find((s) => s.title === 'Theme');
    const detailsSection = sections.find((s) => s.title === 'Details');
    const bulletsSection = sections.find((s) => s.title === 'Bullets');
    const themeText = themeSection?.text ?? '';
    let detailsText = detailsSection?.text ?? '';
    detailsText = dedupeTone(themeText, detailsText);

    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-semibold text-zinc-100">Astrological Analysis</h3>
        <div className="prose prose-invert max-w-none space-y-5">
          {themeText && (
            <section>
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-300 mb-2">Theme</h4>
              <div className="text-zinc-400 leading-relaxed space-y-2">
                {paragraphs(themeText).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {paragraphs(themeText).length === 0 && <p>{themeText}</p>}
              </div>
            </section>
          )}
          {detailsText && (
            <section>
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-300 mb-2">Details</h4>
              <div className="text-zinc-400 leading-relaxed space-y-2">
                {paragraphs(detailsText).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {paragraphs(detailsText).length === 0 && <p>{detailsText}</p>}
              </div>
            </section>
          )}
          {(bulletsSection?.bullets?.length || bulletsSection?.text) ? (
            <section>
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-300 mb-2">Bullets</h4>
              {Array.isArray(bulletsSection?.bullets) && bulletsSection.bullets.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 text-zinc-400 leading-relaxed">
                  {bulletsSection.bullets.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : bulletsSection?.text ? (
                <ul className="list-disc list-inside space-y-1 text-zinc-400 leading-relaxed">
                  {parseLegacyBullets(bulletsSection.text).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
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
