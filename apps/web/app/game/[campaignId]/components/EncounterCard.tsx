'use client';

export interface EncounterCardProps {
  theme: string;
  obstacle: string;
  dc: number;
  introNarration: string;
  saturnHouse?: number;
}

/** Longer themes are engine prose, not structured data; never parse or display them. */
const MAX_PARSEABLE_THEME_LENGTH = 80;

const ASPECT_WORD: Record<string, string> = {
  conjunction: 'conjunct',
  opposition: 'opposite',
  square: 'square',
  trine: 'trine',
  sextile: 'sextile',
};

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Parse ONLY short structured themes like
 * "mars to mercury (conjunction) in belonging, contribution, and social position"
 * into a transit summary line and domain tag chips. Long narrative themes
 * (engine prose) return nothing and stay hidden from the player.
 */
export function parseThemeTags(theme: string): { aspect: string | null; tags: string[] } {
  const raw = (theme || '').trim();
  if (!raw || raw.length > MAX_PARSEABLE_THEME_LENGTH) {
    return { aspect: null, tags: [] };
  }
  const match = /^\s*(\w+)\s+to\s+(\w+)\s*\(([^)]+)\)\s*(?:in\s+(.+))?$/i.exec(raw);
  if (!match) {
    return { aspect: null, tags: [] };
  }
  const [, bodyA, bodyB, aspectType, domains] = match;
  const aspectWord = ASPECT_WORD[aspectType.trim().toLowerCase()];
  if (!aspectWord) {
    return { aspect: null, tags: [] };
  }
  const tags = (domains || '')
    .split(/,|\band\b/i)
    .map((d) => titleCase(d.trim()))
    .filter(Boolean);
  return { aspect: `${titleCase(bodyA)} ${aspectWord} natal ${titleCase(bodyB)}`, tags };
}

/**
 * Narration-first encounter presentation. Hero text is the DM intro only;
 * engine-internal prose (obstacle templates, theme leads) is never shown.
 */
export function EncounterCard({
  theme,
  dc,
  introNarration,
  saturnHouse,
}: EncounterCardProps) {
  const { aspect, tags } = parseThemeTags(theme);
  const narration =
    (introNarration || '').trim() || 'A new challenge awaits. Choose your approach.';

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8 text-center">
      <p className="font-serif text-[22px] leading-relaxed text-text-primary">{narration}</p>

      {tags.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[20px] px-3 py-1 text-[11px] text-text-muted"
              style={{ background: 'rgba(255,255,255,.04)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className="mx-auto inline-flex flex-col items-center rounded-xl px-5 py-2.5"
        style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)' }}
      >
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Difficulty</span>
        <span className="text-base font-bold text-text-primary">{dc}</span>
      </div>

      {aspect ? (
        <p className="text-[11px] uppercase tracking-wider text-accent">
          {aspect}
          {typeof saturnHouse === 'number' ? ` · ${ordinal(saturnHouse)} House` : ''}
        </p>
      ) : null}
    </div>
  );
}
