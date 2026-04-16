/**
 * Bounded continuity inputs for Campaign response slate shaping.
 * Reads existing `CampaignState` only; does not mutate or recompute pressure truth.
 */
import type { CampaignState, OutcomeDirection } from '../rpg/types';

const OUTCOME_DIRECTIONS = new Set<string>([
  'assert_define',
  'engage_advance',
  'observe_hold',
  'withdraw_protect',
  'support_connect',
  'offer_restore',
  'reframe_integrate',
  'contain_limit',
]);

const HISTORY_LINE = /^h:[^:]+:([a-z_]+_[a-z_]+):([a-z_]+)$/;

function parseHistoryDirections(history: readonly string[] | undefined, max: number): OutcomeDirection[] {
  if (!history?.length) return [];
  const out: OutcomeDirection[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < max; i -= 1) {
    const m = HISTORY_LINE.exec(history[i]!);
    const dir = m?.[1];
    if (dir && OUTCOME_DIRECTIONS.has(dir)) {
      out.push(dir as OutcomeDirection);
    }
  }
  return out;
}

function toneKeysSorted(toneTrack: Record<string, number> | undefined): string[] {
  if (!toneTrack || typeof toneTrack !== 'object') return [];
  return Object.entries(toneTrack)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b));
}

function domainPressureBias(domainTrack: Record<string, number> | undefined, primaryDomain: string): number {
  if (!domainTrack || typeof domainTrack !== 'object') return 0;
  const keys = [
    `domain:${primaryDomain}:pressure`,
    `domain:${primaryDomain}:clarity`,
    `domain:${primaryDomain}:agency`,
    `domain:${primaryDomain}:momentum`,
    `domain:${primaryDomain}:boundary`,
    `domain:${primaryDomain}:trust`,
    `domain:${primaryDomain}:repair`,
    `domain:${primaryDomain}:integration`,
  ];
  let sum = 0;
  for (const k of keys) {
    const v = domainTrack[k];
    if (typeof v === 'number' && Number.isFinite(v)) sum += v;
  }
  /** Cap so old runs cannot dominate future slates without bound. */
  return Math.min(sum, 6);
}

export type CampaignSlateContinuity = {
  readonly recentOutcomeDirections: readonly OutcomeDirection[];
  readonly toneKeysSorted: readonly string[];
  readonly domainPressureBias: number;
  readonly sessionKey: string;
};

export function buildCampaignSlateContinuity(params: {
  state: CampaignState;
  primaryDomain: string;
  sessionKey: string;
}): CampaignSlateContinuity {
  const history = Array.isArray(params.state.history) ? params.state.history : [];
  return {
    recentOutcomeDirections: parseHistoryDirections(history, 4),
    toneKeysSorted: toneKeysSorted(params.state.tone_track),
    domainPressureBias: domainPressureBias(params.state.domain_track, params.primaryDomain),
    sessionKey: params.sessionKey,
  };
}
