/**
 * Level 3 — Campaign moment validation (structural only; no generation changes).
 * Validates single-string `pressure_response` paragraphs using segmentation + pattern checks.
 */

import type { CampaignExpressionDigest, ExpansionTier } from '../projection/projection-types';
import { campaignContinuityFromDigest } from '../projection/campaign-lens-contract';

/** Must stay byte-identical to the fallback literal in `claim-synthesize.ts` `buildCampaignMomentThreeSentences`. */
export const CAMPAIGN_MOMENT_FALLBACK_PARAGRAPH =
  'A standard operating pass is already open: exchanges and checks are already cycling. Cadence stays metered while a single vector carries the load. Cardinality reads solo: one chart carries the pass end to end. Saturn meets Sun through a square, with house 1 carrying the contact. Interaction stays mechanical while exposure holds steady: the contact reads without widening the frame. The constraint line is non-negotiable: respect the limit now or the bind hardens on the next pass. Frictional polarity locks adjustment before force: name friction at the line or the bind tightens. You hold the line for this pass.';

/** Parity with `CAMPAIGN_MOMENT_FORBIDDEN` + modals in `campaignMomentForbiddenHit`. */
export const CAMPAIGN_MOMENT_FORBIDDEN_SUBSTRINGS: readonly string[] = [
  'Scenario pressure',
  'Response shape',
  'your chart',
  'natal promise',
  'self-care',
  'remember to',
  'journey',
  'TENSION_BAND_',
  'MOTION_LABEL_',
  'identity field',
  'relational space',
  'dynamic of responsibility',
  'consider ',
  'it helps to',
  'try to ',
  'you might want',
];

const LOCK_VERBS = [
  'commit',
  'seal',
  'bind',
  'lock',
  'hold',
  'cap',
  'clip',
  'brace',
  'name',
  'mark',
  'set',
  'fix',
  'tighten',
  'narrow',
  'trim',
  'bound',
] as const;

/** Minimal activity / ongoing markers (Entry Scene positive indicator). */
const ENTRY_ACTIVITY_MARKERS = /\b(already|pass|underway|live|cycling|metered|operating|shift|window|floor|queue|beat)\b/i;

/** Second Contact sentence: exposure vocabulary. */
const CONTACT_EXPOSURE_MARKERS = /\b(exposure|visible|contained|escalat)/i;

/** Pressure Lock family/polarity lines: boundary lexicon. */
const LOCK_BOUNDARY_LEXICON = /(non-negotiable|hard line|\bcap\b|\bbind\b|\blimit\b|\bedge\b|\bfloor\b|breach|ceiling|band)/i;

const GEOMETRY_CONTACT_MARKERS = [
  'carrying the contact',
  'holds the contact',
  'focused through house',
  'showing the contact',
] as const;

const LOCK_LINE_RE = new RegExp(
  `^You (${LOCK_VERBS.join('|')}) the line for this pass\\.$`,
  'i'
);

function normalizeSlugKey(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/_+/g, '_');
  return t.replace(/^_+|_+$/g, '') || 'neutral';
}

/** Keys with non-empty rows in `CONTINUITY_APPENDIX` (must match `claim-synthesize.ts`). */
const CONTINUITY_DIRECTION_KEYS = new Set<string>([
  'assert_define',
  'engage_advance',
  'observe_hold',
  'withdraw_protect',
  'support_connect',
  'offer_restore',
  'reframe_integrate',
  'contain_limit',
]);

/**
 * Mirrors `buildContinuityAppendix` emptiness (no `pickVariant` — only whether a non-empty appendix is produced).
 */
export function computeExpectedNAppendix(digest: CampaignExpressionDigest, tier: ExpansionTier): 0 | 1 {
  const c = campaignContinuityFromDigest(digest);
  const dirKey = c.last_outcome_direction ? normalizeSlugKey(c.last_outcome_direction) : 'none';
  if (dirKey === 'none' || !CONTINUITY_DIRECTION_KEYS.has(dirKey)) return 0;
  return 1;
}

export function computeNContact(digest: CampaignExpressionDigest): 2 | 3 {
  if (digest.campaign_mode === 'group' && digest.group_member_count > 0) return 3;
  return 2;
}

/** Tokenize on period + following whitespace (structural rule). */
export function tokenizeMomentSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const parts = t.split(/(?<=\.)\s+/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

export type MomentSegmentation =
  | {
      kind: 'fallback';
      sentences: string[];
    }
  | {
      kind: 'normal';
      sentences: string[];
      nContact: 2 | 3;
      nAppendix: 0 | 1;
      entry: readonly [string, string, string];
      contact: string[];
      lockCore: readonly [string, string, string];
      continuity?: string;
    };

export function segmentCampaignMomentParagraph(
  text: string,
  digest: CampaignExpressionDigest,
  tier: ExpansionTier
): { segmentation: MomentSegmentation | null; errors: string[] } {
  const errors: string[] = [];
  const sentences = tokenizeMomentSentences(text);

  if (text === CAMPAIGN_MOMENT_FALLBACK_PARAGRAPH) {
    if (sentences.length !== 8) {
      errors.push(`fallback: expected 8 sentences, got ${sentences.length}`);
    }
    return { segmentation: { kind: 'fallback', sentences }, errors };
  }

  const nContact = computeNContact(digest);
  const nAppendix = computeExpectedNAppendix(digest, tier);
  const expected = 6 + nContact + nAppendix;

  if (sentences.length !== expected) {
    errors.push(
      `normal: expected ${expected} sentences (6+nContact+nAppendix with nContact=${nContact}, nAppendix=${nAppendix}), got ${sentences.length}`
    );
    return { segmentation: null, errors };
  }

  const entry = [sentences[0]!, sentences[1]!, sentences[2]!] as const;
  const contact = sentences.slice(3, 3 + nContact);
  const lockCore = [sentences[3 + nContact]!, sentences[4 + nContact]!, sentences[5 + nContact]!] as const;
  const continuity = nAppendix === 1 ? sentences[3 + nContact + 3] : undefined;

  return {
    segmentation: {
      kind: 'normal',
      sentences,
      nContact,
      nAppendix,
      entry,
      contact,
      lockCore,
      continuity,
    },
    errors: [],
  };
}

function campaignMomentForbiddenHit(text: string): boolean {
  const lower = text.toLowerCase();
  for (const f of CAMPAIGN_MOMENT_FORBIDDEN_SUBSTRINGS) {
    if (lower.includes(f.toLowerCase())) return true;
  }
  if (/\b(?:may|might|could)\b/i.test(text)) return true;
  if (/\bcan\b/i.test(lower)) return true;
  return false;
}

function bodyLabelForMatch(slug: string): string {
  const k = slug.trim().toLowerCase();
  const map: Record<string, string> = {
    sun: 'Sun',
    moon: 'Moon',
    mercury: 'Mercury',
    venus: 'Venus',
    mars: 'Mars',
    jupiter: 'Jupiter',
    saturn: 'Saturn',
    uranus: 'Uranus',
    neptune: 'Neptune',
    pluto: 'Pluto',
  };
  return map[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

function aspectPhraseForMatch(raw: string): string {
  const k = raw.trim().toLowerCase();
  const m: Record<string, string> = {
    conjunction: 'conjunction',
    opposition: 'opposition',
    square: 'square',
    trine: 'trine',
    sextile: 'sextile',
  };
  return m[k] ?? raw;
}

export function validateEntryScene(
  entry: readonly [string, string, string],
  options: { isFallback: boolean }
): string[] {
  const err: string[] = [];
  for (let i = 0; i < 3; i++) {
    const s = entry[i]!;
    if (!s.endsWith('.')) err.push(`entry[${i}]: must end with a period`);
  }
  const joined = entry.join(' ');

  if (!options.isFallback) {
    if (!ENTRY_ACTIVITY_MARKERS.test(joined)) {
      err.push('entry: missing required activity/ongoing structural marker');
    }
    for (const g of GEOMETRY_CONTACT_MARKERS) {
      if (joined.includes(g)) {
        err.push(`entry: forbidden Contact geometry marker "${g}"`);
      }
    }
    if (/Chapter cadence/i.test(joined)) {
      err.push('entry: forbidden continuity appendix marker (Chapter cadence)');
    }
    if (LOCK_LINE_RE.test(entry[0]!) || LOCK_LINE_RE.test(entry[1]!) || LOCK_LINE_RE.test(entry[2]!)) {
      err.push('entry: forbidden Pressure Lock verb line');
    }
  }
  return err;
}

export function validateContactPoint(
  contact: string[],
  digest: CampaignExpressionDigest,
  nContact: 2 | 3,
  entryThirdSentence: string,
  options: { isFallback: boolean }
): string[] {
  const err: string[] = [];
  if (contact.length !== nContact) {
    err.push(`contact: expected ${nContact} sentences, got ${contact.length}`);
    return err;
  }

  const geo = contact[0] ?? '';
  const inter = contact[1] ?? '';

  if (!geo.endsWith('.') || !inter.endsWith('.')) {
    err.push('contact: geometry and interaction sentences must end with a period');
  }

  if (!options.isFallback) {
    err.push(...validateGeometryAgainstDigest(geo, digest));

    if (!CONTACT_EXPOSURE_MARKERS.test(inter)) {
      err.push('contact interaction: missing exposure/visibility structural marker');
    }

    const expectGroup = nContact === 3;
    const groupMode = digest.campaign_mode === 'group' && digest.group_member_count > 0;
    if (expectGroup !== groupMode) {
      err.push(`contact: nContact=${nContact} inconsistent with digest group fields`);
    }
    if (nContact === 3) {
      const g = contact[2] ?? '';
      if (g === entryThirdSentence.trim()) {
        err.push('contact group: must not duplicate Entry Scene cardinality sentence');
      }
      if (/^Cardinality reads/.test(g) && /^Cardinality reads/.test(entryThirdSentence.trim())) {
        err.push('contact group: cardinality line duplicated from Entry');
      }
    }
  }

  return err;
}

export function validatePressureLock(
  lockCore: readonly [string, string, string],
  continuity: string | undefined,
  nAppendix: 0 | 1,
  options: { isFallback: boolean }
): string[] {
  const err: string[] = [];
  const [a, b, c] = lockCore;

  if (!a.endsWith('.') || !b.endsWith('.') || !c.endsWith('.')) {
    err.push('pressure_lock: core sentences must end with a period');
  }

  if (!LOCK_BOUNDARY_LEXICON.test(a)) err.push('pressure_lock: family line missing boundary lexicon');
  if (!LOCK_BOUNDARY_LEXICON.test(b)) err.push('pressure_lock: polarity line missing boundary lexicon');

  if (!LOCK_LINE_RE.test(c.trim())) {
    err.push(`pressure_lock: third line must match /^You (${LOCK_VERBS.join('|')}) the line for this pass\\.$/`);
  }

  if (nAppendix === 1) {
    if (!continuity || !continuity.trim()) {
      err.push('pressure_lock: expected continuity appendix sentence');
    } else {
      if (!continuity.endsWith('.')) err.push('pressure_lock: continuity must end with a period');
      if (/Chapter cadence/i.test(a) || /Chapter cadence/i.test(b) || /Chapter cadence/i.test(c)) {
        err.push('pressure_lock: Chapter cadence must not appear in lock core');
      }
    }
  } else if (continuity !== undefined && continuity.length > 0) {
    err.push('pressure_lock: continuity must be absent when nAppendix=0');
  }

  const lockText = `${a} ${b} ${c}${continuity ? ` ${continuity}` : ''}`;
  if (!options.isFallback && campaignMomentForbiddenHit(lockText)) {
    err.push('pressure_lock: forbidden advisory/modal pattern in lock slice');
  }

  return err;
}

export function validateMomentIntegrity(
  fullText: string,
  seg: MomentSegmentation,
  options: { isFallback: boolean }
): string[] {
  const err: string[] = [];
  if (seg.kind === 'fallback') {
    const geoHits = GEOMETRY_CONTACT_MARKERS.filter((m) => fullText.includes(m)).length;
    if (geoHits > 1) {
      err.push('moment_integrity: multiple geometry tail markers (unexpected duplication)');
    }
    let lockVerbLines = 0;
    for (const s of seg.sentences) {
      if (LOCK_LINE_RE.test(s.trim())) lockVerbLines++;
    }
    if (lockVerbLines !== 1) {
      err.push(`moment_integrity: expected exactly one lock verb line, got ${lockVerbLines}`);
    }
    return err;
  }

  const { entry, contact, lockCore, continuity } = seg;
  const lockJoin = [...lockCore, ...(continuity ? [continuity] : [])].join(' ');

  for (const g of GEOMETRY_CONTACT_MARKERS) {
    if (entry.join(' ').includes(g)) err.push(`moment_integrity: geometry marker in Entry: ${g}`);
    if (lockJoin.includes(g)) err.push(`moment_integrity: geometry marker in Lock: ${g}`);
  }

  let lockVerbInEntry = 0;
  for (const s of entry) {
    if (LOCK_LINE_RE.test(s.trim())) lockVerbInEntry++;
  }
  if (lockVerbInEntry > 0) err.push('moment_integrity: lock verb line leaked into Entry');

  let geoMarkersInContact = 0;
  for (const s of contact) {
    for (const g of GEOMETRY_CONTACT_MARKERS) {
      if (s.includes(g)) geoMarkersInContact++;
    }
  }
  if (geoMarkersInContact < 1) {
    err.push('moment_integrity: geometry tail marker missing in Contact');
  }

  if (!options.isFallback) {
    const geoLine = contact[0] ?? '';
    if (geoLine.length > 0 && entry.some((s) => s.includes(geoLine))) {
      err.push('moment_integrity: full geometry sentence duplicated in Entry');
    }
    if (geoLine.length > 0 && lockCore.some((s) => s.includes(geoLine))) {
      err.push('moment_integrity: geometry sentence duplicated in Lock');
    }
  }

  return err;
}

export function validateSystemSafetyForbiddenLanguage(fullText: string): string[] {
  const err: string[] = [];
  if (campaignMomentForbiddenHit(fullText)) {
    err.push('system_safety: forbidden language parity (moment filter) failed on full text');
  }
  return err;
}

export function validateGeometryAgainstDigest(geo: string, digest: CampaignExpressionDigest): string[] {
  const err: string[] = [];
  const p = digest.pressure;
  const transit = bodyLabelForMatch(p.primary_transit_body);
  const natal = bodyLabelForMatch(p.primary_natal_body);
  const asp = aspectPhraseForMatch(p.primary_aspect_type);
  const house = String(p.primary_natal_house);
  if (!geo.includes(transit)) err.push(`contact geometry: missing transit label "${transit}"`);
  if (!geo.includes(natal)) err.push(`contact geometry: missing natal label "${natal}"`);
  if (!geo.toLowerCase().includes(asp.toLowerCase())) err.push(`contact geometry: missing aspect "${asp}"`);
  if (!geo.includes(`house ${house}`) && !geo.includes(`House ${house}`)) {
    err.push(`contact geometry: missing house ${house}`);
  }
  return err;
}

export type MomentValidationContext = {
  digest: CampaignExpressionDigest;
  tier: ExpansionTier;
};

/** Full Level 3 validation for a single moment paragraph. */
export function validateCampaignMomentLevel3(text: string, ctx: MomentValidationContext): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const { segmentation, errors: segErr } = segmentCampaignMomentParagraph(text, ctx.digest, ctx.tier);
  errors.push(...segErr);

  const isFallback = text === CAMPAIGN_MOMENT_FALLBACK_PARAGRAPH;

  if (!segmentation) {
    return { ok: false, errors };
  }

  if (segmentation.kind === 'fallback') {
    if (segmentation.sentences.length !== 8) {
      errors.push('fallback: sentence count not 8');
    }
    const entry = [segmentation.sentences[0]!, segmentation.sentences[1]!, segmentation.sentences[2]!] as const;
    const contact = segmentation.sentences.slice(3, 5);
    const lockCore = [segmentation.sentences[5]!, segmentation.sentences[6]!, segmentation.sentences[7]!] as const;

    errors.push(...validateEntryScene(entry, { isFallback: true }));
    errors.push(...validateContactPoint(contact, ctx.digest, 2, entry[2]!, { isFallback: true }));
    errors.push(...validatePressureLock(lockCore, undefined, 0, { isFallback: true }));
    errors.push(...validateMomentIntegrity(text, segmentation, { isFallback: true }));
    errors.push(...validateSystemSafetyForbiddenLanguage(text));

    return { ok: errors.length === 0, errors };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const seg = segmentation;
  errors.push(...validateEntryScene(seg.entry, { isFallback: false }));
  errors.push(...validateContactPoint(seg.contact, ctx.digest, seg.nContact, seg.entry[2]!, { isFallback: false }));
  errors.push(...validatePressureLock(seg.lockCore, seg.continuity, seg.nAppendix, { isFallback: false }));
  errors.push(...validateMomentIntegrity(text, seg, { isFallback: false }));
  errors.push(...validateSystemSafetyForbiddenLanguage(text));

  return { ok: errors.length === 0, errors };
}

/** Two projection runs with identical inputs must yield identical moment text. */
export function assertDeterminismEqual(a: string, b: string): string[] {
  if (a !== b) return ['system_safety: determinism mismatch (two identical runs differ)'];
  return [];
}
