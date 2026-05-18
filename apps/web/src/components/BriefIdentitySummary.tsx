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

export function extractFirstSentence(text: string | undefined): string {
  if (!text?.trim()) return '';
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  if (match) return match[0].trim();
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
}

function placementLine(snapshot: SnapshotLike | undefined): string | null {
  if (!snapshot) return null;
  const cusps = Array.isArray(snapshot.houses) ? snapshot.houses : [];
  const sunLon = planetLon(snapshot, 'sun');
  const moonLon = planetLon(snapshot, 'moon');
  if (sunLon == null || moonLon == null) return null;

  const sunSign = lonToSign(sunLon);
  const moonSign = lonToSign(moonLon);
  const sunHouse = Array.isArray(cusps) && cusps.length >= 12 ? lonToHouse(sunLon, cusps) : null;
  const moonHouse = Array.isArray(cusps) && cusps.length >= 12 ? lonToHouse(moonLon, cusps) : null;
  const risingSign =
    Array.isArray(cusps) && cusps.length >= 12 ? lonToSign(cusps[0]!) : null;

  const sunPart = sunHouse ? `Sun in ${sunSign} (${ordinalHouse(sunHouse)})` : `Sun in ${sunSign}`;
  const moonPart = moonHouse ? `Moon in ${moonSign} (${ordinalHouse(moonHouse)})` : `Moon in ${moonSign}`;
  const risingPart = risingSign ? `${risingSign} rising` : null;

  return [sunPart, moonPart, risingPart].filter(Boolean).join(' · ');
}

function ordinalHouse(n: number): string {
  const suffix =
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n >= 4 && n <= 20 ? `${n}th` : `${n}th`;
  return `${suffix} house`;
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
  const coreSection = sections.find((s) => s.id === 'core_identity');
  const essence = extractFirstSentence(coreSection?.text);

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
            className="inline-block text-sm text-emerald hover:underline font-medium"
          >
            View complete natal chart →
          </Link>
        </>
      )}
    </section>
  );
}
