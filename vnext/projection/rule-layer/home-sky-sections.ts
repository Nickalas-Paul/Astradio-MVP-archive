/**
 * Home sky report sections — insight-library planet-in-sign pulls (collective sky voice).
 * Replaces Phase 8C guest-safe static tables with PLCMT_* / SIGN_* library content.
 */
import type { EphemerisSnapshot } from '../../contracts';
import { lonToSign } from '../../astro/profile-from-snapshot';
import { getAspectInsight } from '../insight-library/insight-library-index';
import type { ProjectedExplanationSection } from '../projection-types';
import { taggedSectionBodyFromText } from '../tagged-text';
import { capToMaxSentences } from './claim-synthesize';

export type GuestSignSlug =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

const FEATURED_INNER_PLANETS = ['MERCURY', 'VENUS', 'MARS'] as const;
type FeaturedInnerPlanet = (typeof FEATURED_INNER_PLANETS)[number];

// DEPRECATED Phase 8C guest tables — retained commented for rollback until sky library rewire is signed off.
// const GUEST_SUN: Record<GuestSignSlug, string> = { … };
// const GUEST_MOON: Record<GuestSignSlug, string> = { … };
// const GUEST_SONIC: Record<GuestSignSlug, string> = { … };

function signSlugFromLon(lon: number): GuestSignSlug {
  const { sign } = lonToSign(lon);
  return sign.toLowerCase() as GuestSignSlug;
}

export function formatSignName(slug: GuestSignSlug | string): string {
  const s = String(slug).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function planetLon(snapshot: EphemerisSnapshot, name: string): number | null {
  const planet = (snapshot.planets ?? []).find((p) => String(p.name || '').toUpperCase() === name);
  return typeof planet?.lon === 'number' ? planet.lon : null;
}

function formatPlanetName(planet: string): string {
  const p = planet.toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function getDayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = d.getTime() - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function resolveFeaturedPlanet(snapshot: EphemerisSnapshot): FeaturedInnerPlanet | null {
  const rawTs = typeof snapshot.ts === 'string' && snapshot.ts.trim() ? snapshot.ts : null;
  const base = rawTs ? new Date(rawTs) : new Date();
  const day = Number.isFinite(base.getTime()) ? getDayOfYear(base) : getDayOfYear(new Date());
  const startIdx = ((day % FEATURED_INNER_PLANETS.length) + FEATURED_INNER_PLANETS.length) % FEATURED_INNER_PLANETS.length;

  for (let i = 0; i < FEATURED_INNER_PLANETS.length; i++) {
    const planet = FEATURED_INNER_PLANETS[(startIdx + i) % FEATURED_INNER_PLANETS.length]!;
    if (planetLon(snapshot, planet) != null) return planet;
  }
  return null;
}

function lookupPlacementInsight(planet: string, signSlug: GuestSignSlug) {
  const signUpper = signSlug.toUpperCase();
  const placement = getAspectInsight(`PLCMT_${planet.toUpperCase()}_${signUpper}`);
  if (placement) return placement;
  return getAspectInsight(`SIGN_${signUpper}`);
}

function capitalizeLead(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Strip natal second-person framing and banned constructions for collective sky voice.
 */
export function reframeForSky(text: string): string {
  let t = String(text || '').trim();
  if (!t) return '';

  t = t.replace(/\u2014|\u2013/g, ',');
  t = t.replace(/\s+-\s+/g, ', ');

  t = t.replace(/\bartifact\b/gi, 'composition');

  // Drop natal/sky locus tags — planet+sign motion already sets the frame.
  // Handles: "…through Leo in your chart." and "…Leo, its home sign, in your chart."
  t = t.replace(/,?\s*\bin your chart\b/gi, '');
  t = t.replace(/,?\s*\bin the current sky\b/gi, '');

  t = t.replace(/\byour music\b/gi, "today's sound");
  t = t.replace(/\byour soundtrack\b/gi, "today's sound");

  // "Your Mercury in Gemini" → "Mercury in Gemini"
  t = t.replace(/\bYour\s+([A-Z][a-z]+)\s+in\s+([A-Z][a-z]+)/g, '$1 in $2');

  // Sentence-initial possessive "Your identity…" → "The identity…"
  t = t.replace(/(^|[.!?]\s+)Your\s+/g, '$1The ');

  // Remaining possessive "your " → "the "
  t = t.replace(/\byour\s+/gi, 'the ');

  // Drop "Listen for..." sentences (content standard)
  let sentences = t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^Listen for\b/i.test(s));

  // Banned transition openers / tokens
  sentences = sentences
    .map((s) =>
      s
        .replace(/^(However|Indeed|Moreover|Furthermore|Nevertheless),\s+/i, '')
        .replace(/\bhowever\b/gi, '')
        .replace(/\bindeed\b/gi, '')
        .replace(/\bmoreover\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+,/g, ',')
        .trim()
    )
    .filter(Boolean)
    .map(capitalizeLead);

  return sentences.join(' ').replace(/\s{2,}/g, ' ').trim();
}

function sectionFromGuestText(id: string, title: string, text: string): ProjectedExplanationSection {
  return {
    id,
    title,
    text,
    meta: {
      tagged: taggedSectionBodyFromText(text, 'claim_body'),
      claimIdsReferenced: [],
      phaseD: true,
    },
  };
}

/**
 * Home sky report: Today's Sound (Moon + featured inner), Sun anchor, featured transit, Moon weather.
 */
export function assembleHomeSkySections(snapshot: EphemerisSnapshot): ProjectedExplanationSection[] {
  const sunLon = planetLon(snapshot, 'SUN');
  const moonLon = planetLon(snapshot, 'MOON');
  if (sunLon == null || moonLon == null) return [];

  const sunSign = signSlugFromLon(sunLon);
  const moonSign = signSlugFromLon(moonLon);
  const featuredPlanet = resolveFeaturedPlanet(snapshot);
  if (!featuredPlanet) return [];

  const featuredLon = planetLon(snapshot, featuredPlanet);
  if (featuredLon == null) return [];
  const featuredSign = signSlugFromLon(featuredLon);

  const moonInsight = lookupPlacementInsight('MOON', moonSign);
  const featuredInsight = lookupPlacementInsight(featuredPlanet, featuredSign);
  const sunInsight = lookupPlacementInsight('SUN', sunSign);

  const moonSonic = reframeForSky(moonInsight?.sonic ?? '');
  const featuredSonic = reframeForSky(featuredInsight?.sonic ?? '');
  const soundParts = [moonSonic, featuredSonic].filter(Boolean);
  const todaysSound = capToMaxSentences(soundParts.join(' '), 5);

  const sunFeed = capToMaxSentences(reframeForSky(sunInsight?.feed ?? ''), 3);
  const featuredFeed = capToMaxSentences(reframeForSky(featuredInsight?.feed ?? ''), 3);
  const moonFeed = capToMaxSentences(reframeForSky(moonInsight?.feed ?? ''), 3);

  const featuredName = formatPlanetName(featuredPlanet);
  const sections: ProjectedExplanationSection[] = [];

  if (todaysSound) {
    sections.push(sectionFromGuestText('todays_sound', "Today's Sound", todaysSound));
  }
  if (sunFeed) {
    sections.push(
      sectionFromGuestText('sky_anchor', `Sun in ${formatSignName(sunSign)}`, sunFeed)
    );
  }
  if (featuredFeed) {
    sections.push(
      sectionFromGuestText(
        'featured_transit',
        `${featuredName} in ${formatSignName(featuredSign)}`,
        featuredFeed
      )
    );
  }
  if (moonFeed) {
    sections.push(
      sectionFromGuestText(
        'emotional_weather',
        `Moon in ${formatSignName(moonSign)}`,
        moonFeed
      )
    );
  }

  return sections;
}
