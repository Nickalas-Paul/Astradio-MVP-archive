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
import {
  buildFeedExplanationSentence,
  campaignSurfacingSentence,
  feedDescriptorCollapsedFallback,
  feedFallbackNoAspectPrimary,
} from '@projection/insight/map-insight-unit-v1';

const NEAR_DUPLICATE_JACCARD = 0.92;
const MAX_SENTENCES_PER_OPENING_PHRASE = 2;

const NARRATIVE_SLOT_ORDER: Array<'summary' | 'support' | 'tension' | 'activation' | 'whatToDo'> = [
  'summary',
  'support',
  'tension',
  'activation',
  'whatToDo',
];

const AUDIO_STATUS_COPY = {
  unavailable: 'Playback unavailable for this reading. Audio export was not attached to this artifact.',
  failed: 'Playback unavailable for this reading due to an audio export failure.',
  pending: 'Audio export is still processing for this reading.',
} as const;

export type RelationalReadingEnforcementInput =
  | { kind: 'feed_collapsed_batch'; items: RelationalCommunityFeedItem[] }
  | {
      kind: 'expanded_artifact';
      artifact: Record<string, unknown>;
      weather?: unknown;
      context?: { feed_item_id?: string; binding_id?: string };
    };

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
      audio_policy: 'full' | 'unavailable' | 'failed' | 'pending';
    };

function sentencePassesReadingPolicies(sentence: string, mode: 'narrative' | 'activation'): boolean {
  const cleaned = applyReadingPresentationPolicies(sentence, { mode });
  return cleaned.trim().length > 0;
}

/**
 * Strip narrative slots using unified policies; structural/meta enforced inside reading filter.
 */
function applyPoliciesToSlotBody(body: string, mode: 'narrative' | 'activation' | 'audio'): string {
  return applyReadingPresentationPolicies(body, { mode });
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
    const isActivationSlot = slotId === 'activation';

    for (const para of paras) {
      const sentsRaw = splitParagraphIntoSentences(para);
      const kept: string[] = [];

      for (const rawSent of sentsRaw) {
        const trimmed = rawSent.trim();
        if (!trimmed) continue;
        const mode: 'narrative' | 'activation' = slotId === 'activation' ? 'activation' : 'narrative';
        if (!sentencePassesReadingPolicies(trimmed, mode)) continue;

        if (!isActivationSlot) {
          let duplicateNear = false;
          for (const r of representatives) {
            if (sentencesAreNearDuplicate(trimmed, r, NEAR_DUPLICATE_JACCARD)) {
              duplicateNear = true;
              break;
            }
          }
          if (duplicateNear) continue;
        }

        const openingKey = openingPhraseKeyFiveWords(trimmed);
        if (!isActivationSlot && openingKey.length > 0) {
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
): { slots: Record<ExpandedSlotId, string>; sectionIds: string[]; usedFallback: boolean } {
  const sections = extractSectionsFromArtifact(artifact);
  const w = weather ?? artifact.weather;
  const sectionIds = sections
    .map((s) => String((s as { sectionId?: unknown; id?: unknown }).sectionId ?? (s as { id?: unknown }).id ?? '').trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return {
      slots: buildMinimalExpandedSlotsBeforeEnforcement(artifact, { weather: w }),
      sectionIds: [],
      usedFallback: true,
    };
  }

  let slots = mapSectionsToExpandedSlots(sections, w);
  slots = dedupeParagraphsAcrossExpandedSlots(slots);
  return { slots, sectionIds, usedFallback: false };
}

function readAudioState(artifact: Record<string, unknown>): {
  state: 'full' | 'unavailable' | 'failed' | 'pending';
  message: string;
} {
  const a = artifact.audio;
  if (!a || typeof a !== 'object') {
    return { state: 'unavailable', message: AUDIO_STATUS_COPY.unavailable };
  }
  const rec = a as Record<string, unknown>;
  const exportId = typeof rec.export_id === 'string' ? rec.export_id.trim() : '';
  const exportError = typeof rec.export_error === 'string' ? rec.export_error.trim() : '';
  const attempted = rec.export_attempted === true;
  if (exportId) return { state: 'full', message: '' };
  if (exportError) return { state: 'failed', message: `${AUDIO_STATUS_COPY.failed} ${exportError}`.trim() };
  if (attempted) return { state: 'pending', message: AUDIO_STATUS_COPY.pending };
  return { state: 'unavailable', message: AUDIO_STATUS_COPY.unavailable };
}

function finalizeExpandedArtifactSlots(
  artifact: Record<string, unknown>,
  weather?: unknown,
  context?: { feed_item_id?: string; binding_id?: string }
): RelationalReadingSurfacesOutput {
  const w = weather ?? artifact.weather;
  const assembled = assemblePreliminaryExpandedSlots(artifact, w);
  const slots = assembled.slots;

  const narrativeIn = {
    summary: applyPoliciesToSlotBody(slots.summary || '', 'narrative'),
    support: applyPoliciesToSlotBody(slots.support || '', 'narrative'),
    tension: applyPoliciesToSlotBody(slots.tension || '', 'narrative'),
    activation: applyPoliciesToSlotBody(slots.activation || '', 'activation'),
    whatToDo: applyPoliciesToSlotBody(slots.whatToDo || '', 'narrative'),
  };

  const narrativeOut = enforceNarrativeOwnershipPrefixAndNearDup(narrativeIn);

  const audioState = readAudioState(artifact);
  const audioBodyRaw = applyPoliciesToSlotBody(slots.audio || '', 'audio');
  const audioBody = audioState.state === 'full' ? audioBodyRaw : audioState.message;
  const audio_policy = audioState.state;

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    const mk = (s: string): string => comparableSentenceFingerprint(s).slice(0, 80);
    // eslint-disable-next-line no-console
    console.debug('[relational-reading-enforcement] expanded-diagnostic', {
      feed_item_id: context?.feed_item_id ?? null,
      binding_id: context?.binding_id ?? null,
      structured_section_ids: assembled.sectionIds,
      fallback_used: assembled.usedFallback,
      pre_slots: {
        summary: mk(slots.summary || ''),
        support: mk(slots.support || ''),
        tension: mk(slots.tension || ''),
        activation: mk(slots.activation || ''),
        whatToDo: mk(slots.whatToDo || ''),
        audio: mk(slots.audio || ''),
      },
      post_slots: {
        summary: mk(narrativeOut.summary || ''),
        support: mk(narrativeOut.support || ''),
        tension: mk(narrativeOut.tension || ''),
        activation: mk(narrativeOut.activation || ''),
        whatToDo: mk(narrativeOut.whatToDo || ''),
        audio: mk(audioBody || ''),
      },
      audio_state: audioState.state,
    });
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

function normalizeSurfacingKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

function computeSurfacingForFeedItem(
  item: RelationalCommunityFeedItem,
  display: { readonly primary_line: string; readonly micro_tag: string },
  shellRotate: number
): string | null {
  if (item.connection_kind === 'campaign_group') return campaignSurfacingSentence();
  const r = item.ranking;
  if (!r) return null;
  return buildFeedExplanationSentence({
    ranking: r,
    micro_tag: display.micro_tag,
    primary_line: display.primary_line,
    shell_rotate: shellRotate,
  });
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
        : feedFallbackNoAspectPrimary();
    const micro = cd && typeof cd.micro_tag === 'string' ? cd.micro_tag.trim() : '';
    const descriptor =
      cd && typeof cd.activation_descriptor === 'string' ? cd.activation_descriptor : feedDescriptorCollapsedFallback();

    let surf: string | null = null;
    let normalized = '';
    let rot = 0;
    const displayLines = { primary_line: primary, micro_tag: micro };
    for (; rot < 3; rot++) {
      surf = computeSurfacingForFeedItem(item, displayLines, rot);
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
  return finalizeExpandedArtifactSlots(input.artifact, input.weather, input.context);
}

export type { ExpandedSlotId } from './community-feed-reading-layout';
