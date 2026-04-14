/**
 * Step 10 — projection validation (density, section counts, feed caps).
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { ExpansionTier, ProjectionSurface, ProjectionValidation } from '../projection-types';
import { SURFACE_SCHEMAS } from '../surface-schemas';
import { validateDensity, densityForSurfaceBaseline, countSentences } from '../density-validate';
import { countAudioListenFamilyMatches } from './audio-lexicon';

export function densityForSectionId(sectionId: string, defaultD: 'short' | 'medium' | 'long'): 'short' | 'medium' | 'long' {
  if (sectionId === 'synthesis_a' || sectionId === 'synthesis_b') return 'short';
  if (
    /^(audio_|connection_|ensemble_|feed_)/.test(sectionId) ||
    sectionId === 'audio_thread' ||
    sectionId.startsWith('depth_panel_')
  ) {
    return 'short';
  }
  return defaultD;
}

function countClauseUnitsInSentence(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  if (/;\s/.test(t)) return t.split(/;\s+/).map((x) => x.trim()).filter(Boolean).length;
  const fan = (t.match(/,\s+(?:and|but|so|or|yet)\s+/gi) ?? []).length;
  return Math.max(1, 1 + fan);
}

function iterSectionSentences(sec: import('../projection-types').ProjectedExplanationSection): string[] {
  const out: string[] = [];
  const pushBody = (body: string) => {
    for (const para of body.split(/\n\n+/).map((x) => x.trim()).filter(Boolean)) {
      for (const s of para.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)) {
        out.push(s);
      }
    }
  };
  pushBody(sec.text);
  for (const b of sec.bullets ?? []) pushBody(b);
  return out;
}

function sectionSentenceTotal(sec: import('../projection-types').ProjectedExplanationSection): number {
  let n = countSentences(sec.text);
  for (const b of sec.bullets ?? []) n += countSentences(b);
  return n;
}

function totalReportSentences(sections: import('../projection-types').ProjectedExplanationSection[]): number {
  let n = 0;
  for (const s of sections) {
    n += countSentences(s.text);
    for (const b of s.bullets ?? []) n += countSentences(b);
  }
  return n;
}

/** Section sentence caps (stable projection `id`s only; no schema key aliasing). */
function sectionSentenceCap(sectionId: string): number | null {
  if (sectionId === 'synthesis_a' || sectionId === 'synthesis_b') return 5;
  if (sectionId.startsWith('depth_panel_')) return 2;
  if (sectionId === 'pressure_response') return 5;
  if (sectionId === 'feed_signal' || sectionId === 'feed_context') return 2;
  return null;
}

function sectionClauseCap(sectionId: string): number | null {
  if (sectionId === 'synthesis_a' || sectionId === 'synthesis_b') return 2;
  if (sectionId.startsWith('depth_panel_')) return 2;
  if (sectionId === 'pressure_response') return 3;
  return null;
}

function maxSectionsForSurface(surface: ProjectionSurface): number | null {
  switch (surface) {
    case 'profile':
      return 14;
    case 'daily':
      return 12;
    case 'campaign':
      return 10;
    case 'sandbox':
      return 8;
    case 'compat_pair':
    case 'group':
      return 14;
    case 'feed':
      return 2;
    case 'overlay_pair':
      return 12;
    default:
      return null;
  }
}

/** Total-sentence budget: feed is hard; other surfaces warn via `BUDGET_WARN:` without failing `ok`. */
function surfaceSentenceBudget(surface: ProjectionSurface): { max: number; hard: boolean } | null {
  switch (surface) {
    case 'profile':
      return { max: 95, hard: false };
    case 'daily':
      return { max: 85, hard: false };
    case 'campaign':
      return { max: 75, hard: false };
    case 'sandbox':
      return { max: 55, hard: false };
    case 'compat_pair':
    case 'group':
      return { max: 95, hard: false };
    case 'feed':
      return { max: 8, hard: true };
    case 'overlay_pair':
      return { max: 85, hard: false };
    default:
      return null;
  }
}

export function validateReportSections(
  sections: import('../projection-types').ProjectedExplanationSection[],
  surface: ProjectionSurface,
  tier: ExpansionTier,
  core: SemanticCore,
  tierForDensity: ExpansionTier
): { ok: boolean; violations: string[] } {
  const schema = SURFACE_SCHEMAS[surface];
  const hard: string[] = [];
  const soft: string[] = [];

  if (sections.length < schema.baselineMinSections) {
    hard.push(`sections:${sections.length}<${schema.baselineMinSections}`);
  }
  if (surface === 'feed' && schema.maxSectionsFeed && sections.length > schema.maxSectionsFeed) {
    hard.push(`feed_sections_overflow`);
  }

  const maxSec = maxSectionsForSurface(surface);
  if (maxSec != null && sections.length > maxSec) {
    hard.push(`surface_sections_overflow:${sections.length}>${maxSec}`);
  }

  const r3Text = sections
    .filter((s) => s.id !== 'audio_staging')
    .map((s) => [s.text, ...(s.bullets ?? [])].join('\n'))
    .join('\n');
  for (const kind of ['tempo', 'density', 'tension', 'arc'] as const) {
    const c = countAudioListenFamilyMatches(kind, r3Text);
    if (c > 1) hard.push(`r3_audio_family_${kind}:${c}>1`);
  }

  const defaultD = densityForSurfaceBaseline(schema.baselineDensityDefault, tierForDensity);
  for (const sec of sections) {
    const d =
      sec.meta?.enrichDensity !== undefined ? sec.meta.enrichDensity : densityForSectionId(sec.id, defaultD);
    const claims =
      sec.meta?.claimIdsReferenced && sec.meta.claimIdsReferenced.length > 0
        ? [...sec.meta.claimIdsReferenced]
        : [];
    const minClaimsOverride = claims.length === 0 ? 0 : undefined;
    const v = validateDensity(sec.text, d, claims, { minClaimsOverride });
    if (!v.ok) hard.push(`${sec.id}:${v.reasons.join(';')}`);

    const sentCap = sectionSentenceCap(sec.id);
    if (sentCap != null) {
      const st = sectionSentenceTotal(sec);
      if (st > sentCap) hard.push(`${sec.id}:sentence_ceiling:${st}>${sentCap}`);
    }

    if (sec.id === 'audio_staging') {
      const stAudio = sectionSentenceTotal(sec);
      if (stAudio > 4) {
        soft.push(`BUDGET_WARN:audio_staging_sentence_total:${stAudio}>4`);
      }
      const blob = [sec.text, ...(sec.bullets ?? [])].join('\n');
      const semi = (blob.match(/;\s+/g) ?? []).length;
      if (semi < 4) {
        hard.push(`audio_staging:fused_listen_semicolons:${semi}<4`);
      }
      const bs = sec.bullets ?? [];
      for (let bi = 0; bi < bs.length; bi++) {
        const bc = countSentences(bs[bi]!);
        if (bc > 1) hard.push(`audio_staging:bullet_${bi}_sentences:${bc}>1`);
      }
    }

    const clauseCap = sectionClauseCap(sec.id);
    if (clauseCap != null) {
      for (const sent of iterSectionSentences(sec)) {
        if (sec.id === 'audio_staging') continue;
        const cu = countClauseUnitsInSentence(sent);
        if (cu > clauseCap) {
          hard.push(`${sec.id}:clause_ceiling:${cu}>${clauseCap}`);
        }
      }
    }
  }

  const budget = surfaceSentenceBudget(surface);
  if (budget != null) {
    const tot = totalReportSentences(sections);
    if (tot > budget.max) {
      const msg = `surface_sentence_total:${tot}>${budget.max}`;
      if (budget.hard) hard.push(msg);
      else soft.push(`BUDGET_WARN:${msg}`);
    }
  }

  return { ok: hard.length === 0, violations: [...hard, ...soft] };
}

/**
 * Test-harness / client-context hints only — never treated as structural violations and do not affect `ok`.
 * Use when classifying HTTP 401/429 around projection fetch without failing deterministic projection checks.
 */
export const AUTH_CONTEXT_REQUIRED = 'AUTH_CONTEXT_REQUIRED';
export const RATE_LIMIT_CONTEXT = 'RATE_LIMIT_CONTEXT';

export function appendHttpContextHints(violations: string[], httpStatus?: number): string[] {
  const out = [...violations];
  if (httpStatus === 401) out.push(AUTH_CONTEXT_REQUIRED);
  if (httpStatus === 429) out.push(RATE_LIMIT_CONTEXT);
  return out;
}

export function buildFinalProjectionValidation(
  tierRequested: ExpansionTier,
  tierEffective: ExpansionTier,
  validateResult: { ok: boolean; violations: string[] },
  priorAttemptViolations?: string[]
): ProjectionValidation {
  const downgraded =
    tierRequested !== 'baseline' &&
    tierEffective === 'baseline' &&
    priorAttemptViolations != null &&
    priorAttemptViolations.length > 0;
  const out: ProjectionValidation = {
    ok: validateResult.ok,
    tierRequested,
    tierEffective,
    violations: validateResult.violations,
  };
  if (downgraded) {
    out.downgradedFrom = tierRequested;
    out.prior_attempt_violations = [...priorAttemptViolations!];
  }
  return out;
}
