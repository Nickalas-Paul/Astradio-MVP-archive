/**
 * Round 4 — sole authority for literal-backed insight strings (mapper-only; literals only).
 */

import type { CrossAspectHitV1 } from '../../relational/weather/types';
import type { RelationalWeatherStateV1 } from '../../relational/weather/types';
import type { RelationalFieldScoreContract } from '../../compatibility/contracts';
import { CORE_BODIES, type BodyKey } from '../../canonical-bodies';

import aspectBehaviorDoc from '../literals/aspect-behavior-v1.json';
import bodyPairDoc from '../literals/body-pair-meaning-v1.json';
import activationDescriptorDoc from '../literals/activation-descriptor-v1.json';
import explanationShellsDoc from '../literals/feed-explanation-shells-v1.json';
import feedFallbacksDoc from '../literals/feed-fallbacks-v1.json';
import surfacingLitDoc from '../literals/surfacing-literals-v1.json';
import campaignSurfacingDoc from '../literals/campaign-surfacing-lines-v1.json';
import compatSlotsDoc from '../literals/compatibility-slots-v1.json';
import templateBucketsDoc from '../literals/template-keyword-buckets-v1.json';

export type InsightUnitV1 = {
  readonly anchor: string;
  readonly meaning: string;
  readonly behavior: string;
  readonly relational_effect: string;
  readonly activation_modifier: string;
};

type BodyPairRow = {
  readonly body_pair_key: string;
  readonly meaning_clause: string;
  readonly feed_predicate?: string;
  readonly feed_predicate_tail?: string;
};

const CORE_SET = new Set<string>(CORE_BODIES.map((b: BodyKey) => b.toLowerCase()));

const BODY_ROWS: BodyPairRow[] = (bodyPairDoc as { pairs: BodyPairRow[] }).pairs;
const BODY_MAP = new Map<string, BodyPairRow>();
for (const r of BODY_ROWS) BODY_MAP.set(r.body_pair_key, r);

const FALLBACK_ROW = BODY_MAP.get('*|*');

export type AspectT = CrossAspectHitV1['type'];
type DynT = CrossAspectHitV1['dynamics'];

const ASPECT_LABEL: Record<AspectT, string> = {
  conjunction: 'conjunct',
  opposition: 'opposite',
  square: 'square',
  trine: 'trine',
  sextile: 'sextile',
};

/** @internal */
export function normalizeBody(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase();
}

export function fmtBody(name: string): string {
  const n = normalizeBody(name);
  if (!n) return '';
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function bodyPairKey(transitBody: string, natalBody: string): string | null {
  const a = normalizeBody(transitBody);
  const b = normalizeBody(natalBody);
  if (!a || !b) return null;
  if (!CORE_SET.has(a) || !CORE_SET.has(b)) return null;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function aspectPhrase(tb: string, nb: string, type: AspectT): string {
  const aspectWord = ASPECT_LABEL[type] ?? 'aspect';
  return `${fmtBody(tb)} ${aspectWord} ${fmtBody(nb)}`;
}

const BANNED = /\b(energy|dynamic|alignment|vibration|synergy)\b/i;

function wordCount(text: string): number {
  return text
    .split(/\s+/u)
    .map((s) => s.replace(/^[^\w]+|[^\w]+$/g, ''))
    .filter(Boolean).length;
}

function coordinatingAndCount(text: string): number {
  const m = text.match(/\band\b/gi);
  return m ? m.length : 0;
}

function passesFeedGuards(line: string): boolean {
  if (BANNED.test(line)) return false;
  const w = wordCount(line);
  if (w < 12 || w > 22) return false;
  if (coordinatingAndCount(line) > 1) return false;
  return true;
}

function aspectBehaviorTemplate(aspectType: AspectT, dynamics: DynT): string {
  const byType = aspectBehaviorDoc.primary_line_templates[aspectType] as Record<string, string> | undefined;
  const tpl = byType?.[dynamics] ?? byType?.amplifying;
  if (!tpl) return '';
  return tpl;
}

export function buildCollapsedPrimaryLineFromHit(hit: CrossAspectHitV1): string {
  const phrase = aspectPhrase(hit.transitBody, hit.natalBody, hit.type);
  if (hit.type === 'opposition') {
    const key = bodyPairKey(hit.transitBody, hit.natalBody);
    const row = key ? BODY_MAP.get(key) ?? FALLBACK_ROW : FALLBACK_ROW;
    const tail = row?.feed_predicate_tail?.trim() ?? '';
    if (tail) {
      const line = `${phrase} ${tail}.`;
      if (passesFeedGuards(line) && coordinatingAndCount(line) <= 1) return line;
    }
  }
  const tpl = aspectBehaviorTemplate(hit.type, hit.dynamics).trim();
  if (!tpl.includes('{aspect}')) return tpl || phrase + '.';
  const line = tpl.replace(/\{aspect\}/g, phrase);
  if (passesFeedGuards(line)) return line;
  return phrase + '.';
}

export function descriptorFromActivationMapped(
  a: RelationalWeatherStateV1['activation'] | null | undefined
): string {
  if (!a) return feedFallbacksDoc.feed_descriptor_fallback;
  const roster: ReadonlyArray<{ k: keyof RelationalWeatherStateV1['activation']; v: number }> = [
    { k: 'emotional_activation', v: Number(a.emotional_activation) },
    { k: 'friction', v: Number(a.friction) },
    { k: 'harmony', v: Number(a.harmony) },
    { k: 'intensity', v: Number(a.intensity) },
    { k: 'communication_emphasis', v: Number(a.communication_emphasis) },
    { k: 'volatility', v: Number(a.volatility) },
    { k: 'growth_pressure', v: Number(a.growth_pressure) },
  ];
  let top = roster[0]!;
  for (const e of roster) {
    if (e.v > top.v || (e.v === top.v && e.k.localeCompare(top.k as string) < 0)) top = e;
  }
  const d = activationDescriptorDoc.descriptors as Record<string, string>;
  const v = Number(top?.v ?? 0);
  if (v < 0.2) return d.stable_subtle_between!;
  switch (top.k) {
    case 'emotional_activation':
      return v >= 0.45 ? d.high_emotional! : d.steady_contact!;
    case 'friction':
      return v >= 0.45 ? d.rising_friction! : d.steady_contact!;
    case 'harmony':
      return v >= 0.45 ? d.steady_harmony! : d.steady_contact!;
    case 'intensity':
      return v >= 0.45 ? d.elevated_contact! : d.steady_contact!;
    case 'communication_emphasis':
      return v >= 0.4 ? d.wording_focus! : d.steady_contact!;
    case 'volatility':
      return v >= 0.35 ? d.tone_swings! : d.steady_contact!;
    case 'growth_pressure':
      return v >= 0.35 ? d.growth_push! : d.steady_contact!;
    default:
      return d.steady_contact!;
  }
}

export function mapInsightUnitFromFeed(hit: CrossAspectHitV1): InsightUnitV1 {
  const anchor = aspectPhrase(hit.transitBody, hit.natalBody, hit.type);
  const key = bodyPairKey(hit.transitBody, hit.natalBody);
  const row = key ? BODY_MAP.get(key) ?? FALLBACK_ROW : FALLBACK_ROW;
  const meaning = row?.meaning_clause?.trim() ?? '';
  const tpl = aspectBehaviorTemplate(hit.type, hit.dynamics).replace(/\{aspect\}/g, anchor).trim();
  return {
    anchor,
    meaning,
    behavior: tpl,
    relational_effect: '',
    activation_modifier: '',
  };
}

/** Index-bound facet copy derived only from literal tables + scoring contract inputs. */
export function compatibilityFacetExplanation(
  which: 'cohesion' | 'tension' | 'transformation' | 'stability',
  scoring: RelationalFieldScoreContract
): string {
  const f = compatSlotsDoc.facets as Record<
    string,
    Record<'high' | 'mid' | 'low', string>
  >;
  const row = f[which];
  if (!row) return '';
  const v =
    which === 'cohesion'
      ? scoring.derived_indices.cohesion_index
      : which === 'tension'
        ? scoring.derived_indices.tension_index
        : which === 'transformation'
          ? scoring.derived_indices.transformation_index
          : scoring.derived_indices.stability_index;
  const tier = v >= 0.62 ? 'high' : v >= 0.36 ? 'mid' : 'low';
  return row[tier];
}

export function mapInsightUnitV1(
  input:
    | { kind: 'feed_cross_aspect'; hit: CrossAspectHitV1 }
    | { kind: 'compat_scores'; scoring: RelationalFieldScoreContract }
    | { kind: 'noop' }
): InsightUnitV1 {
  if (input.kind === 'feed_cross_aspect') return mapInsightUnitFromFeed(input.hit);
  if (input.kind === 'noop') {
    return { anchor: '', meaning: '', behavior: '', relational_effect: '', activation_modifier: '' };
  }
  const s = input.scoring;
  const d = s.derived_indices;
  const c = s.components;
  const why =
    d.cohesion_index >= 0.62
      ? compatSlotsDoc.why_works.cohesion_high_band
      : c.pairwise_complementarity_mean >= 0.48
        ? compatSlotsDoc.why_works.complement_mid_band
        : compatSlotsDoc.why_works.default;
  const strain =
    d.tension_index >= 0.55
      ? compatSlotsDoc.where_strains.tension_high_band
      : c.pairwise_friction_mean >= 0.52
        ? compatSlotsDoc.where_strains.friction_peak_band
        : compatSlotsDoc.where_strains.default;
  return {
    anchor: '',
    meaning: why,
    behavior: strain,
    relational_effect: '',
    activation_modifier: '',
  };
}

/** Shell index deterministic from geometry (hash-free). */
export function feedExplanationShellIndexFromAspectType(aspectType: AspectT | null): number {
  if (aspectType === 'conjunction') return 1;
  if (aspectType === 'opposition' || aspectType === 'square') return 0;
  if (aspectType === 'trine' || aspectType === 'sextile') return 2;
  return 0;
}

export function aspectTypeFromMicroTag(micro_tag: string | undefined | null): AspectT | null {
  const t = String(micro_tag || '');
  if (t.includes('☌')) return 'conjunction';
  if (t.includes('☍')) return 'opposition';
  if (t.includes('□')) return 'square';
  if (t.includes('△')) return 'trine';
  if (t.includes('⚹')) return 'sextile';
  return null;
}

function tierSkyBond(v: number): 'high' | 'mid' | 'low' {
  const x = Math.max(0, Math.min(1, Number(v) || 0));
  const hi = surfacingLitDoc.tier_thresholds.high;
  const mid = surfacingLitDoc.tier_thresholds.mid;
  if (x >= hi) return 'high';
  if (x >= mid) return 'mid';
  return 'low';
}

function tokenizeImportant(text: string, minLen: number): Set<string> {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= minLen);
  return new Set(raw);
}

function clauseTouchesPrimaryTokens(clause: string, primaryTok: Set<string>, minLen: number): boolean {
  for (const w of tokenizeImportant(clause, minLen)) {
    if (primaryTok.has(w)) return true;
  }
  return false;
}

export function campaignSurfacingSentence(): string {
  return campaignSurfacingDoc.primary_line;
}

/** One-sentence explanation; shells + literals only. */
export function buildFeedExplanationSentence(input: {
  readonly ranking: {
    readonly weather_activation_intensity: number;
    readonly activation_effective: number;
    readonly overall_relational_intensity: number;
  };
  readonly micro_tag: string;
  readonly primary_line: string;
  /** Deterministic sibling offset when batch deduping duplicates (never random). */
  readonly shell_rotate?: number;
}): string {
  const aspectType = aspectTypeFromMicroTag(input.micro_tag);
  let shellIx = feedExplanationShellIndexFromAspectType(aspectType);
  const rot = Math.max(0, Math.floor(Number(input.shell_rotate) || 0)) % 3;
  shellIx = (shellIx + rot) % 3;

  let skyTier = tierSkyBond(input.ranking.weather_activation_intensity);
  let bondTier = tierSkyBond(input.ranking.overall_relational_intensity);
  let blendTier = tierSkyBond(input.ranking.activation_effective);

  const skyLit = surfacingLitDoc.sky_activation_clause as Record<string, string>;
  const bondLit = surfacingLitDoc.relational_baseline_clause as Record<string, string>;

  let X = skyLit[skyTier] ?? explanationShellsDoc.default_activation_clause;
  let Y = bondLit[bondTier] ?? explanationShellsDoc.default_baseline_clause;

  const genericTriple = skyTier === 'low' && bondTier === 'low' && blendTier === 'low';
  if (genericTriple) {
    X = explanationShellsDoc.default_activation_clause;
    Y = explanationShellsDoc.default_baseline_clause;
  }

  const primaryTok = tokenizeImportant(input.primary_line, 6);
  const conflicts = (clause: string): boolean => clauseTouchesPrimaryTokens(clause, primaryTok, 6);
  if (conflicts(X) || conflicts(Y)) {
    X = explanationShellsDoc.default_activation_clause;
    Y = explanationShellsDoc.default_baseline_clause;
  }

  const shells = explanationShellsDoc.shells as string[];
  const shell = shells[shellIx] ?? shells[0]!;
  return shell.replace(/\{X\}/g, X).replace(/\{Y\}/g, Y);
}

export function feedFallbackNoWeatherPrimary(): string {
  return feedFallbacksDoc.no_weather_primary;
}

export function feedFallbackNoAspectPrimary(): string {
  return feedFallbacksDoc.no_aspect_primary;
}

export function feedDescriptorCollapsedFallback(): string {
  return feedFallbacksDoc.feed_descriptor_fallback;
}

const SIG_WORDS = new Set(
  (templateBucketsDoc.section_signatures as string[]).map((s) => s.toLowerCase())
);
const SIG_WORDS2 = new Set(
  (templateBucketsDoc.section_significance as string[]).map((s) => s.toLowerCase())
);

function tokensMeaningful(clause: string, min: number): string[] {
  return clause
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= min);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Returns null if prepend should be omitted (collision). */
export function prepareTemplatePrepend(
  section: 'SECTION_SIGNATURES' | 'SECTION_SIGNIFICANCE',
  insightMeaning: string,
  insightBehavior: string,
  templateBody: string
): string | null {
  const clause = section === 'SECTION_SIGNATURES' ? insightMeaning.trim() : insightBehavior.trim();
  if (!clause) return null;
  const bucket = section === 'SECTION_SIGNATURES' ? SIG_WORDS : SIG_WORDS2;
  if (tokensMeaningful(clause, 4).some((t) => bucket.has(t))) return null;
  if (jaccard(tokensMeaningful(clause, 4), tokensMeaningful(templateBody, 4)) >= 0.45) return null;
  return clause;
}
