/**
 * Unified relational reading enforcement — single entry point for collapsed feed + expanded artifacts.
 * Deterministic, post-assembly only; no generation or substitution of dropped content.
 */

import type { RelationalCommunityFeedItem } from '../core/social/hooks';
import {
  buildMinimalExpandedSlotsBeforeEnforcement,
  dedupeParagraphsAcrossExpandedSlots,
  extractSectionsFromArtifact,
  mapSectionsToExpandedSlots,
} from './community-feed-reading-layout';
import type { ExpandedSlotId } from './community-feed-reading-layout';
import { applyReadingPresentationPolicies } from './reading-presentation-filter';
import {
  comparableSentenceFingerprint,
  joinParagraphs,
  openingPhraseKeyFiveWords,
  sentencesAreNearDuplicate,
  splitParagraphIntoSentences,
  splitParagraphs,
} from './sentence-enforcement-utils';

const NEAR_DUPLICATE_JACCARD = 0.92;
const MAX_SENTENCES_PER_OPENING_PHRASE = 2;

const NARRATIVE_SLOT_ORDER: Array<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo'> = [
  'summary',
  'support',
  'tension',
  'activation',
  'whatToDo',
];

/** Fixed neutral copy when audio section is not grounded in export metadata. */
export const NEUTRAL_AUDIO_TRANSLATION_NOT_GROUNDED =
  'Audio cues describe the chart-derived listen metaphor for this bookmark; they may not match every detail of playback.';

export type RelationalReadingEnforcementInput =
  | { kind: 'feed_collapsed_batch'; items: RelationalCommunityFeedItem[] }
  | { kind: 'expanded_artifact'; artifact: Record<string, unknown>; weather?: unknown };

export type RelationalReadingSurfacesOutput =
  | {
      kind: 'feed_collapsed_batch';
      items: Array<{
        feed_item_id: string;
        primary_line: string;
        micro_tag: string;
        activation_descriptor: string;
        surfacing_explanation: string | null;
      }>;
    }
  | {
      kind: 'expanded_artifact';
      slots: Record<ExpandedSlotId, string>;
      audio_policy: 'full' | 'neutralized';
    };

function isAudioGroundedInArtifact(artifact: Record<string, unknown>): boolean {
  const a = artifact.audio;
  if (!a || typeof a !== 'object') return false;
  const id = (a as Record<string, unknown>).export_id;
  return typeof id === 'string' && id.trim().length > 0;
}

function sentencePassesReadingPolicies(sentence: string): boolean {
  const cleaned = applyReadingPresentationPolicies(sentence);
  return cleaned.trim().length > 0;
}

/**
 * Strip narrative slots using unified policies; structural/meta enforced inside reading filter.
 */
function applyPoliciesToSlotBody(body: string): string {
  return applyReadingPresentationPolicies(body);
}

function enforceNarrativeOwnershipPrefixAndNearDup(
  slots: Record<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo', string>
): Record<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo', string> {
  const representatives: string[] = [];
  const openingPhraseCounts = new Map<string, number>();

  const rebuilt: Partial<typeof slots> = {};

  for (const slotId of NARRATIVE_SLOT_ORDER) {
    const raw = slots[slotId] || '';
    const paras = splitParagraphs(raw);
    const outParas: string[] = [];

    for (const para of paras) {
      const sentsRaw = splitParagraphIntoSentences(para);
      const kept: string[] = [];

      for (const rawSent of sentsRaw) {
        const trimmed = rawSent.trim();
        if (!trimmed) continue;
        if (!sentencePassesReadingPolicies(trimmed)) continue;

        let duplicateNear = false;
        for (const r of representatives) {
          if (sentencesAreNearDuplicate(trimmed, r, NEAR_DUPLICATE_JACCARD)) {
            duplicateNear = true;
            break;
          }
        }
        if (duplicateNear) continue;

        const openingKey = openingPhraseKeyFiveWords(trimmed);
        if (openingKey.length > 0) {
          const n = openingPhraseCounts.get(openingKey) ?? 0;
          if (n >= MAX_SENTENCES_PER_OPENING_PHRASE) continue;
          openingPhraseCounts.set(openingKey, n + 1);
        }

        representatives.push(trimmed);
        kept.push(trimmed);
      }

      if (kept.length) outParas.push(kept.join(' '));
    }

    rebuilt[slotId] = joinParagraphs(outParas);
  }

  return rebuilt as typeof slots;
}

function assemblePreliminaryExpandedSlots(
  artifact: Record<string, unknown>,
  weather: unknown
): Record<ExpandedSlotId, string> {
  const sections = extractSectionsFromArtifact(artifact);
  const w = weather ?? artifact.weather;

  if (sections.length === 0) {
    return buildMinimalExpandedSlotsBeforeEnforcement(artifact, { weather: w });
  }

  let slots = mapSectionsToExpandedSlots(sections, w);
  slots = dedupeParagraphsAcrossExpandedSlots(slots);
  return slots;
}

function finalizeExpandedArtifactSlots(
  artifact: Record<string, unknown>,
  weather?: unknown
): RelationalReadingSurfacesOutput {
  const w = weather ?? artifact.weather;
  let slots = assemblePreliminaryExpandedSlots(artifact, w);

  const narrativeIn = {
    summary: applyPoliciesToSlotBody(slots.summary || ''),
    support: applyPoliciesToSlotBody(slots.support || ''),
    tension: applyPoliciesToSlotBody(slots.tension || ''),
    activation: applyPoliciesToSlotBody(slots.activation || ''),
    whatToDo: applyPoliciesToSlotBody(slots.whatToDo || ''),
  };

  const narrativeOut = enforceNarrativeOwnershipPrefixAndNearDup(narrativeIn);

  let audioBody = applyPoliciesToSlotBody(slots.audio || '');
  let audio_policy: 'full' | 'neutralized' = 'full';

  if (!isAudioGroundedInArtifact(artifact)) {
    audioBody = NEUTRAL_AUDIO_TRANSLATION_NOT_GROUNDED;
    audio_policy = 'neutralized';
  }

  return {
    kind: 'expanded_artifact',
    slots: {
      summary: narrativeOut.summary,
      support: narrativeOut.support,
      tension: narrativeOut.tension,
      activation: narrativeOut.activation,
      whatToDo: narrativeOut.whatToDo,
      audio: audioBody,
    },
    audio_policy,
  };
}

function tierPhrase(v: number, hi: string, mid: string, lo: string): string {
  const x = Math.max(0, Math.min(1, Number(v) || 0));
  if (x >= 0.58) return hi;
  if (x >= 0.3) return mid;
  return lo;
}

function hashStringToUint(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

function normalizeSurfacingKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Four deterministic templates per tier triple; template index selects wording variety. */
function surfacingLineFromTiersAndTemplate(
  sky: string,
  bond: string,
  blend: string,
  templateIndex: number
): string {
  const t = templateIndex % 4;
  if (t === 0) {
    return `Surfacing now: ${sky} with ${bond}; the feed blends today’s contact with that steady layer—${blend}.`;
  }
  if (t === 1) {
    return `Right now: ${sky} meets ${bond}; today’s sky sits on top of that baseline—${blend}.`;
  }
  if (t === 2) {
    return `Showing here: ${sky} alongside ${bond}; the mix weights live contact against what holds—${blend}.`;
  }
  return `Listed because: ${sky} pairs with ${bond}; the blend reads how both layers register together—${blend}.`;
}

const CAMPAIGN_SURFACING_VARIANTS = [
  'Campaign threads mix story activity with relationship signals; this row reflects how much is registering for you now.',
  'Campaign rows combine story activity with relationship signals; what you see here is what registers most for you now.',
  'This campaign listing weighs story motion alongside relationship signals for the current feed moment.',
  'Campaign feeds blend narrative threads with connection signals; this entry reflects current emphasis.',
] as const;

function computeSurfacingForFeedItem(
  item: RelationalCommunityFeedItem,
  templateBump: number
): string | null {
  if (item.connection_kind === 'campaign_group') {
    const ix =
      (hashStringToUint(`${item.feed_item_id}|${item.binding_id}`) + templateBump) %
      CAMPAIGN_SURFACING_VARIANTS.length;
    return CAMPAIGN_SURFACING_VARIANTS[ix]!;
  }
  const r = item.ranking;
  if (!r) return null;

  const sky = tierPhrase(
    r.weather_activation_intensity,
    'stronger sky contact',
    'noticeable sky contact',
    'light sky contact',
  );
  const bond = tierPhrase(
    r.overall_relational_intensity,
    'a durable bond signal',
    'a steady bond signal',
    'a soft baseline between you',
  );
  const blend = tierPhrase(
    r.activation_effective,
    'both layers stand out together',
    'both layers show up in the mix',
    'one layer is enough to list it now',
  );

  const base =
    hashStringToUint(`${item.binding_id}|${sky}|${bond}|${blend}`) % 4;
  const templateIndex = (base + templateBump) % 4;
  return surfacingLineFromTiersAndTemplate(sky, bond, blend, templateIndex);
}

function finalizeFeedCollapsedBatch(items: RelationalCommunityFeedItem[]): RelationalReadingSurfacesOutput {
  const seenSurfacing = new Set<string>();
  const out: Array<{
    feed_item_id: string;
    primary_line: string;
    micro_tag: string;
    activation_descriptor: string;
    surfacing_explanation: string | null;
  }> = [];

  for (const item of items) {
    const cd = item.collapsed_display;
    const primary =
      cd && typeof cd.primary_line === 'string'
        ? cd.primary_line
        : 'This connection is active in your feed for this moment.';
    const micro = cd && typeof cd.micro_tag === 'string' ? cd.micro_tag.trim() : '';
    const descriptor =
      cd && typeof cd.activation_descriptor === 'string' ? cd.activation_descriptor : 'Active between you';

    let bump = 0;
    let surf: string | null = null;
    let normalized = '';

    for (; bump < 24; bump++) {
      surf = computeSurfacingForFeedItem(item, bump);
      if (surf === null) break;
      normalized = normalizeSurfacingKey(surf);
      if (!seenSurfacing.has(normalized)) {
        seenSurfacing.add(normalized);
        break;
      }
    }

    out.push({
      feed_item_id: item.feed_item_id,
      primary_line: primary,
      micro_tag: micro,
      activation_descriptor: descriptor,
      surfacing_explanation: surf,
    });
  }

  return { kind: 'feed_collapsed_batch', items: out };
}

/**
 * Single enforcement entry for relational reading surfaces (collapsed feed batch + expanded artifacts).
 */
export function finalizeRelationalReadingSurfaces(
  input: RelationalReadingEnforcementInput
): RelationalReadingSurfacesOutput {
  if (input.kind === 'feed_collapsed_batch') {
    return finalizeFeedCollapsedBatch(input.items);
  }
  return finalizeExpandedArtifactSlots(input.artifact, input.weather);
}

export type { ExpandedSlotId } from './community-feed-reading-layout';
