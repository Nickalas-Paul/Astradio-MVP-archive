'use client';

import Link from 'next/link';
import type { ProfileChartSection } from '@/core/social/hooks';

const SIGN_NAMES = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const MAX_ESSENCE_CHARS = 280;

function normLon(lon: number): number {
  let x = lon % 360;
  if (x < 0) x += 360;
  return x;
}

function lonToSign(lon: number): string {
  const x = normLon(lon);
  return SIGN_NAMES[Math.floor(x / 30) % 12]!;
}

function lonToHouse(lon: number, cusps: number[]): number {
  if (!cusps?.length || cusps.length < 12) return 1;
  const x = normLon(lon);
  for (let i = 0; i < 12; i++) {
    const cStart = normLon(cusps[i]!);
    const cEnd = normLon(cusps[(i + 1) % 12]!);
    const inSegment = cStart <= cEnd ? x >= cStart && x < cEnd : x >= cStart || x < cEnd;
    if (inSegment) return i + 1;
  }
  return 1;
}

type SnapshotLike = {
  planets?: Array<{ name: string; lon: number }>;
  houses?: number[];
};

function planetLon(snapshot: SnapshotLike | undefined, name: string): number | null {
  if (!snapshot?.planets?.length) return null;
  const key = name.toLowerCase();
  for (const p of snapshot.planets) {
    if (String(p.name).toLowerCase() === key && typeof p.lon === 'number') {
      return p.lon;
    }
  }
  return null;
}

/** Strip markdown / section chrome from natal explainer prose. */
function cleanMarkdownProse(text: string): string {
  return text
    .replace(/^#{1,6}\s+.+$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/^[A-Z][a-zA-Z0-9\s,'-]+$/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Second-person → third-person for compatibility profiles (describing the other person). */
export function toThirdPersonVoice(sentence: string): string {
  return sentence
    .replace(/\bYourself\b/g, 'Themselves')
    .replace(/\byourself\b/g, 'themselves')
    .replace(/\bYour\b/g, 'Their')
    .replace(/\byour\b/g, 'their')
    .replace(/\bYou\b/g, 'They')
    .replace(/\byou\b/g, 'they');
}

/**
 * One Sun essence sentence in third-person voice.
 * Prefers "Your Sun in {sign} means …" from core_identity, not the full section body.
 */
export function extractSunEssence(sections: ProfileChartSection[]): string {
  const coreSection = sections.find((s) => s.id === 'core_identity');
  const fullText = coreSection?.text ?? '';
  if (!fullText.trim()) return '';

  const signatureMatch = fullText.match(/Your Sun in [A-Za-z]+ means[^.!?]+[.!?]/i);
  if (signatureMatch) {
    return capEssence(toThirdPersonVoice(signatureMatch[0].replace(/\s+/g, ' ').trim()));
  }

  const cleaned = cleanMarkdownProse(fullText);
  const sunSentence = cleaned.match(/Your Sun in [^.!?]+[.!?]/i);
  if (sunSentence) {
    return capEssence(toThirdPersonVoice(sunSentence[0].trim()));
  }

  const firstSentence = cleaned.match(/[^.!?]+[.!?]/);
  if (firstSentence) {
    const raw = firstSentence[0].trim();
    if (/^your sun in/i.test(raw) || /^the foundation/i.test(raw)) {
      return capEssence(toThirdPersonVoice(raw));
    }
  }

  return '';
}

function capEssence(sentence: string): string {
  if (sentence.length <= MAX_ESSENCE_CHARS) return sentence;
  const cut = sentence.slice(0, MAX_ESSENCE_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > 120 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[,;:\s]+$/, '')}…`;
}

function placementLine(snapshot: SnapshotLike | undefined): string | null {
  if (!snapshot) return null;
  const cusps = Array.isArray(snapshot.houses) ? snapshot.houses : [];
  const sunLon = planetLon(snapshot, 'sun');
  const moonLon = planetLon(snapshot, 'moon');
  if (sunLon == null || moonLon == null) return null;

  const sunSign = lonToSign(sunLon);
  const moonSign = lonToSign(moonLon);
  const sunHouse = cusps.length >= 12 ? lonToHouse(sunLon, cusps) : null;
  const moonHouse = cusps.length >= 12 ? lonToHouse(moonLon, cusps) : null;
  const risingSign = cusps.length >= 12 ? lonToSign(cusps[0]!) : null;

  const sunPart = sunHouse ? `Sun in ${sunSign} (${ordinalHouse(sunHouse)})` : `Sun in ${sunSign}`;
  const moonPart = moonHouse ? `Moon in ${moonSign} (${ordinalHouse(moonHouse)})` : `Moon in ${moonSign}`;
  const risingPart = risingSign ? `${risingSign} rising` : null;

  return [sunPart, moonPart, risingPart].filter(Boolean).join(' · ');
}

function ordinalHouse(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export interface BriefIdentitySummaryProps {
  chartData: { snapshot?: SnapshotLike } | null;
  sections: ProfileChartSection[];
  profilePath: string;
  loading?: boolean;
}

export function BriefIdentitySummary({
  chartData,
  sections,
  profilePath,
  loading = false,
}: BriefIdentitySummaryProps) {
  const placements = placementLine(chartData?.snapshot);
  const essence = extractSunEssence(sections);

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-subtext">About their chart</h2>

      {loading ? (
        <p className="text-sm text-subtext">Loading chart summary…</p>
      ) : (
        <>
          {placements ? (
            <p className="text-sm text-text font-medium leading-relaxed">{placements}</p>
          ) : (
            <p className="text-sm text-subtext">Chart placements unavailable.</p>
          )}

          {essence ? (
            <p className="text-sm text-subtext leading-relaxed">{essence}</p>
          ) : null}

          <Link
            href={profilePath}
            className="inline-block text-sm text-accent-light hover:underline font-medium"
          >
            View complete natal chart →
          </Link>
        </>
      )}
    </section>
  );
}
