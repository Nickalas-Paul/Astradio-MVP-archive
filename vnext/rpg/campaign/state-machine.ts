// vnext/rpg/campaign/state-machine.ts
// Pure, deterministic campaign state representation and evolution.

import type { RPGEffectsBundle, RPGDomainScore } from '../contracts';
import { canonicalize } from '../hash/json-hash';
import type { ArchetypeId, CharacterHP, ResponsePosture, StatBlock, SaturnChapterState, ActiveChapter, CampaignEra, ActiveBuff, DamageShield } from '../types';
import { createFullHp } from '../../game/hp-system';
import { isGameCombatEnabled } from '../../game/feature-gate';

export interface RPGCampaignState {
  tone_track: Record<string, number>;
  domain_track: Record<string, number>;
  chapter: number;
  flags: string[];
  history?: string[];
  members?: Record<string, RPGCampaignMemberState>;
  /** Phase 3 combat HP (present when GAME_COMBAT_ENABLED). */
  hp?: CharacterHP;
  streak?: number;
  lastPlayedDate?: string | null;
  /** Mars-driven dungeon chapter (~6–8 weeks). */
  activeChapter?: ActiveChapter | null;
  /** Saturn-driven background era (narrative tone). */
  campaignEra?: CampaignEra | null;
  /** Total Mars chapter transitions (relic unlock / bag growth). */
  chapterTransitionCount?: number;
  /** @deprecated Prefer activeChapter; dual-read during migration. */
  saturnChapter?: SaturnChapterState | null;
  activeBuffs?: ActiveBuff[];
  damageShield?: DamageShield | null;
  revealActive?: boolean;
}

export interface RPGCampaignMemberState {
  tone_track: Record<string, number>;
  domain_track: Record<string, number>;
  flags: string[];
  history?: string[];
}

export interface RpgOutcome {
  turn_id: string;
  choice_id: string;
  outcome_patch_id: string;
  primary_domain?: string;
  tone_tag?: string;
  actor_chart_id?: string;
  archetype_id?: ArchetypeId;
  pressure_polarity?: 'constructive' | 'frictional' | 'volatile' | 'binding';
  intensity_band?: 'low' | 'moderate' | 'high' | 'critical';
  transit_body?: string;
  natal_body?: string;
  natal_house?: number;
  aspect_type?: string;
  /** Response posture chosen at resolve time; feeds bounded future slate shaping. */
  response_posture?: ResponsePosture;
  response_pattern_tag?: string;
}

type PatchDirection =
  | 'assert_define'
  | 'engage_advance'
  | 'observe_hold'
  | 'withdraw_protect'
  | 'support_connect'
  | 'offer_restore'
  | 'reframe_integrate'
  | 'contain_limit'
  | 'legacy_identity'
  | 'legacy_defer'
  | 'legacy_bond';

function parsePatch(patch: string): { direction: PatchDirection; domain: string } {
  if (patch === 'patch_increase_identity_resolve') {
    return { direction: 'legacy_identity', domain: 'self' };
  }
  if (patch === 'patch_defer_decision') {
    return { direction: 'legacy_defer', domain: 'subconscious' };
  }
  if (patch === 'patch_strengthen_bond') {
    return { direction: 'legacy_bond', domain: 'partnership' };
  }
  const match = /^patch_([a-z]+_[a-z]+)_([a-z_]+)$/.exec(patch);
  if (!match) {
    return { direction: 'legacy_defer', domain: 'self' };
  }
  return {
    direction: match[1] as PatchDirection,
    domain: match[2],
  };
}

function directionTone(direction: PatchDirection): string {
  switch (direction) {
    case 'assert_define':
    case 'legacy_identity':
      return 'clarity';
    case 'engage_advance':
      return 'momentum';
    case 'observe_hold':
    case 'legacy_defer':
      return 'ambiguity';
    case 'withdraw_protect':
      return 'containment';
    case 'support_connect':
    case 'legacy_bond':
      return 'cohesion';
    case 'offer_restore':
      return 'repair';
    case 'reframe_integrate':
      return 'integration';
    case 'contain_limit':
      return 'stability';
    default:
      return 'ambiguity';
  }
}

function applyPatchMutation(
  target: { domain_track: Record<string, number> },
  patch: string,
) {
  const { direction, domain } = parsePatch(patch);
  const bump = (key: string, amount = 0.2) => {
    target.domain_track[key] = (target.domain_track[key] ?? 0) + amount;
  };

  bump(`domain:${domain}:pressure`, 0.1);

  switch (direction) {
    case 'assert_define':
    case 'legacy_identity':
      bump(`domain:${domain}:clarity`);
      bump(`domain:${domain}:agency`);
      break;
    case 'engage_advance':
      bump(`domain:${domain}:agency`);
      bump(`domain:${domain}:momentum`);
      break;
    case 'observe_hold':
    case 'legacy_defer':
      break;
    case 'withdraw_protect':
      bump(`domain:${domain}:boundary`);
      break;
    case 'support_connect':
    case 'legacy_bond':
      bump(`domain:${domain}:trust`);
      break;
    case 'offer_restore':
      bump(`domain:${domain}:repair`);
      bump(`domain:${domain}:trust`);
      break;
    case 'reframe_integrate':
      bump(`domain:${domain}:integration`);
      bump(`domain:${domain}:clarity`);
      break;
    case 'contain_limit':
      bump(`domain:${domain}:boundary`);
      bump(`domain:${domain}:clarity`);
      break;
    default:
      break;
  }
}

function applyToneMutation(
  target: { tone_track: Record<string, number> },
  patch: string,
  outcome: RpgOutcome,
) {
  const { direction } = parsePatch(patch);
  const tones = [directionTone(direction)];
  if (
    (outcome.pressure_polarity === 'frictional' || outcome.pressure_polarity === 'volatile') &&
    (outcome.intensity_band === 'high' || outcome.intensity_band === 'critical')
  ) {
    tones.push('strain');
  }
  target.tone_track = Object.fromEntries(tones.slice(0, 2).map((tone) => [tone, 1]));
}

function applyHistoryMutation(
  target: { history?: string[] },
  patch: string,
  outcome: RpgOutcome,
  maxEntries = 10,
  memberScoped = false,
) {
  if (!target.history) return;
  const { direction, domain } = parsePatch(patch);
  const archetypeId = outcome.archetype_id ?? 'identity_test';
  target.history.push(memberScoped ? `hm:${direction}:${domain}` : `h:${archetypeId}:${direction}:${domain}`);
  target.history.push(memberScoped ? `hc:${direction}` : `hc:${direction}:${directionTone(direction)}`);
  if (outcome.natal_body || outcome.natal_house || outcome.aspect_type || outcome.transit_body) {
    const transit = outcome.transit_body ?? 'unknown';
    const natal = outcome.natal_body ?? 'unknown';
    const house = typeof outcome.natal_house === 'number' ? String(outcome.natal_house) : 'unknown';
    const aspect = outcome.aspect_type ?? 'unknown';
    target.history.push(memberScoped ? `hmb:${natal}:${aspect}` : `hs:${transit}:${natal}:${house}:${aspect}`);
  }
  if (outcome.response_posture) {
    target.history.push(memberScoped ? `hmp:${outcome.response_posture}` : `hp:${outcome.response_posture}`);
  }
  while (target.history.length > maxEntries) {
    target.history.shift();
  }
}

function applyFlagMutation(
  target: { flags: string[] },
  patch: string,
  outcome: RpgOutcome,
) {
  const { direction, domain } = parsePatch(patch);
  const uniqueFlags = Array.from(new Set(target.flags));
  uniqueFlags.push(`outcome:${direction}`);
  if (outcome.archetype_id) uniqueFlags.push(`archetype:${outcome.archetype_id}`);
  uniqueFlags.push(`domain:${domain}`);
  uniqueFlags.push(`tone:${directionTone(direction)}`);
  uniqueFlags.push(`climate:${direction}`);
  if (outcome.pressure_polarity) uniqueFlags.push(`polarity:${outcome.pressure_polarity}`);
  if (outcome.intensity_band) uniqueFlags.push(`intensity:${outcome.intensity_band}`);
  if (outcome.transit_body) uniqueFlags.push(`transit_body:${outcome.transit_body}`);
  if (outcome.natal_body) uniqueFlags.push(`natal_body:${outcome.natal_body}`);
  if (typeof outcome.natal_house === 'number') uniqueFlags.push(`natal_house:${outcome.natal_house}`);
  if (outcome.aspect_type) uniqueFlags.push(`aspect_type:${outcome.aspect_type}`);
  target.flags = Array.from(new Set(uniqueFlags)).sort();
}

export function initialCampaignState(bundle: RPGEffectsBundle): RPGCampaignState {
  const tone_track: Record<string, number> = {};
  const domain_track: Record<string, number> = {};

  for (const d of bundle.domainSummary) {
    if (d.score > 0) {
      domain_track[d.domain] = d.normalizedScore || d.score;
    }
  }

  tone_track['neutral'] = 1;

  const flags: string[] = ['seeded_from_bundle'];

  const state: RPGCampaignState = {
    tone_track,
    domain_track,
    chapter: 1,
    flags: flags.sort(),
  };

  if (isGameCombatEnabled()) {
    const sb = bundle.statBlock as StatBlock | undefined;
    const stats: Pick<StatBlock, 'vitality' | 'resilience'> = {
      vitality: sb?.vitality ?? 10,
      resilience: sb?.resilience ?? 10,
    };
    state.hp = createFullHp(stats);
    state.streak = 0;
    state.lastPlayedDate = null;
    // activeChapter / campaignEra seeded at create (needs transit snapshot) or lazy on first resolve
    state.activeChapter = null;
    state.campaignEra = null;
    state.chapterTransitionCount = 0;
    state.activeBuffs = [];
    state.damageShield = null;
    state.revealActive = false;
  }

  return state;
}

export function applyOutcome(state: RPGCampaignState, outcome: RpgOutcome, domains?: RPGDomainScore[]): RPGCampaignState {
  const next: RPGCampaignState = {
    tone_track: { ...state.tone_track },
    domain_track: { ...state.domain_track },
    chapter: state.chapter,
    flags: [...state.flags],
    history: state.history ? [...state.history] : [],
    members: state.members
      ? Object.fromEntries(
          Object.entries(state.members).map(([memberId, memberState]) => [
            memberId,
            {
              tone_track: { ...(memberState?.tone_track || {}) },
              domain_track: { ...(memberState?.domain_track || {}) },
              flags: Array.isArray(memberState?.flags) ? [...memberState.flags] : [],
              history: Array.isArray(memberState?.history) ? [...memberState.history] : [],
            },
          ]),
        )
      : undefined,
    ...(state.hp ? { hp: { ...state.hp } } : {}),
    ...(typeof state.streak === 'number' ? { streak: state.streak } : {}),
    ...(state.lastPlayedDate !== undefined ? { lastPlayedDate: state.lastPlayedDate } : {}),
    ...(state.activeChapter !== undefined
      ? { activeChapter: state.activeChapter ? { ...state.activeChapter } : null }
      : {}),
    ...(state.campaignEra !== undefined
      ? { campaignEra: state.campaignEra ? { ...state.campaignEra } : null }
      : {}),
    ...(typeof state.chapterTransitionCount === 'number'
      ? { chapterTransitionCount: state.chapterTransitionCount }
      : {}),
    ...(state.saturnChapter !== undefined
      ? { saturnChapter: state.saturnChapter ? { ...state.saturnChapter } : null }
      : {}),
    ...(state.activeBuffs ? { activeBuffs: state.activeBuffs.map((b) => ({ ...b })) } : {}),
    ...(state.damageShield !== undefined
      ? { damageShield: state.damageShield ? { ...state.damageShield } : null }
      : {}),
    ...(typeof state.revealActive === 'boolean' ? { revealActive: state.revealActive } : {}),
  };

  const patch = outcome.outcome_patch_id || 'generic';
  applyPatchMutation(next, patch);
  applyToneMutation(next, patch, outcome);
  applyHistoryMutation(next, patch, outcome, 10, false);

  next.chapter = state.chapter + 1;
  applyFlagMutation(next, patch, outcome);

  if (outcome.actor_chart_id) {
    const memberId = outcome.actor_chart_id;
    const nextMembers = next.members || {};
    const memberState: RPGCampaignMemberState = nextMembers[memberId]
      ? {
          tone_track: { ...nextMembers[memberId].tone_track },
          domain_track: { ...nextMembers[memberId].domain_track },
          flags: [...nextMembers[memberId].flags],
          history: nextMembers[memberId].history ? [...nextMembers[memberId].history] : [],
        }
      : {
          tone_track: {},
          domain_track: {},
          flags: [],
          history: [],
        };
    applyPatchMutation(memberState, patch);
    applyToneMutation(memberState, patch, outcome);
    applyHistoryMutation(memberState, patch, outcome, 8, true);
    applyFlagMutation(memberState, patch, outcome);
    next.members = {
      ...nextMembers,
      [memberId]: memberState,
    };
  }

  const canon = canonicalize(next) as RPGCampaignState;
  return canon;
}

