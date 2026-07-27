import { api, type ApiError } from './api';

export type StatBlock = {
  vitality: number;
  resilience: number;
  cunning: number;
  charm: number;
  intuition: number;
  willpower: number;
};

export type CharacterHP = {
  current: number;
  max: number;
  wounded: boolean;
  woundedUntil: string | null;
  woundedDaysRemaining: number;
};

export type ActiveChapterState = {
  currentHouse: number;
  domain: string;
  label: string;
  startingHouse?: number;
  enteredDate?: string;
  transitBody?: 'mars';
};

export type CampaignEraState = {
  currentHouse: number;
  domain: string;
  label: string;
  enteredDate?: string;
  transitBody?: 'saturn';
};

export type GameStateResponse = {
  campaignId: string;
  hp: CharacterHP;
  streak: number;
  chapter: number;
  activeChapter?: ActiveChapterState | null;
  campaignEra?: CampaignEraState | null;
  /** @deprecated Prefer activeChapter; dual-read during migration. */
  saturnChapter: {
    currentHouse: number;
    domain: string;
    label: string;
  } | null;
};

/** Prefer Mars activeChapter; fall back to legacy saturnChapter for labels. */
export function resolveChapterLabel(state: {
  activeChapter?: { label?: string } | null;
  saturnChapter?: { label?: string } | null;
} | null | undefined): string | null {
  return state?.activeChapter?.label || state?.saturnChapter?.label || null;
}

export type EncounterChoice = {
  id: string;
  label: string;
  symbolicGesture: string;
  riskProfile: string;
  primaryStat: string;
  currentModifier: number;
};

export type EncounterResponse = {
  campaignId: string;
  calendarDate: string;
  encounter: {
    theme: string;
    setting: string;
    obstacle: string;
    dc: number;
    saturnHouse: number;
    introNarration: string;
  };
  choices: EncounterChoice[];
  playerState: {
    hp: CharacterHP;
    effectiveStats: StatBlock;
    streak: number;
    revealHint: string | null;
  };
  resolved: boolean;
  resolution: Record<string, unknown> | null;
};

export type InventoryItem = {
  instanceId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  statModifiers: Record<string, number>;
  quantity: number;
  consumableEffect: {
    type: string;
    stat?: string;
    magnitude: number;
    duration?: number;
  } | null;
  equipped: boolean;
  equippedSlot: string | null;
};

export type EquippedItem = {
  instanceId: string;
  slug: string;
  name: string;
  category: string;
  rarity: string;
  statModifiers: Record<string, number>;
} | null;

export type InventoryResponse = {
  campaignId: string;
  bag: InventoryItem[];
  equipped: Record<string, EquippedItem>;
  slotsUnlocked: string[];
  maxBagSize: number;
  bagUsed: number;
  statBonusesFromGear: Record<string, number>;
};

export type CharacterResponse = {
  characterId: string;
  classSlug: string;
  subclassSlug: string;
  risingSlug: string;
  baseStats: StatBlock;
  effectiveStats: StatBlock & {
    bonuses: Partial<Record<string, number>>;
    woundedPenalty: boolean;
  };
  temperament: Record<string, number>;
  statTrace: unknown;
};

export type LootTableResponse = {
  campaignId: string;
  label: string;
  items: Array<{
    slug: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    statModifiers: Record<string, number>;
  }>;
  relicReward: {
    name: string;
    description: string;
    statModifiers: Record<string, number>;
  } | null;
};

export type CombatResolution = {
  dieRoll: { raw: number; modifier: number; total: number };
  outcome: string;
  damageDealt: number;
  hpBefore: number;
  hpAfter: number;
  healAmount: number;
  woundedTriggered: boolean;
  streakSaved: boolean;
  loot: {
    dropped: boolean;
    item: {
      name: string;
      description: string;
      category: string;
      rarity: string;
      statModifiers: Record<string, number>;
    } | null;
  };
  milestones?: Array<{ type: string; detail: string }>;
};

export type DailyResolveMeta = {
  calendarDate: string;
  engineVersion: string;
  challengeFingerprint: string;
  stateHashBefore: string;
};

export type CampaignListItem = {
  campaignId: string;
  mode?: string;
  stateJson?: {
    hp?: { current?: number; max?: number };
    streak?: number;
    chapter?: number;
    activeChapter?: { label?: string; currentHouse?: number };
    campaignEra?: { label?: string };
    saturnChapter?: { label?: string; currentHouse?: number };
  };
};

export function isApiError(error: unknown, status?: number): error is ApiError {
  if (!error || typeof error !== 'object' || !('status' in error)) return false;
  return status === undefined || Number((error as ApiError).status) === status;
}

export function gameErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as ApiError;
    if (typeof err.message === 'string' && err.message) return err.message;
    if (typeof err.error === 'string' && err.error) return err.error;
  }
  return error instanceof Error ? error.message : fallback;
}

function todayIsoLocal(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nowTimeLocal(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const listCampaigns = () => api<{ campaigns: CampaignListItem[] }>('/api/campaigns');

export const createSoloCampaign = () =>
  api<{ campaignId: string }>('/api/campaigns/create', {
    method: 'POST',
    body: JSON.stringify({ mode: 'solo' }),
  });

export const fetchGameState = (campaignId: string) =>
  api<GameStateResponse>(`/api/game/${encodeURIComponent(campaignId)}/state`);

export const fetchGameEncounter = (campaignId: string) =>
  api<EncounterResponse>(
    `/api/game/${encodeURIComponent(campaignId)}/encounter?date=${encodeURIComponent(todayIsoLocal())}`,
  );

export const fetchGameInventory = (campaignId: string) =>
  api<InventoryResponse>(`/api/game/${encodeURIComponent(campaignId)}/inventory`);

export const fetchGameCharacter = (campaignId: string) =>
  api<CharacterResponse>(`/api/game/${encodeURIComponent(campaignId)}/character`);

export const fetchLootTable = (campaignId: string) =>
  api<LootTableResponse>(`/api/game/${encodeURIComponent(campaignId)}/loot-table`);

type CampaignDailyResponse = {
  campaignId: string;
  calendarDate: string;
  engineVersion: string;
  daily: {
    daily?: {
      challenge_fingerprint?: string;
      state_hash_before?: string;
    };
    challenge_fingerprint?: string;
    state_hash_before?: string;
  };
};

export async function composeCampaignDaily(campaignId: string): Promise<DailyResolveMeta> {
  const result = await api<CampaignDailyResponse>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/daily`,
    {
      method: 'POST',
      body: JSON.stringify({ date: todayIsoLocal(), time: nowTimeLocal() }),
    },
  );
  const inner =
    result.daily?.daily && typeof result.daily.daily === 'object'
      ? result.daily.daily
      : result.daily;
  const challengeFingerprint = String(inner?.challenge_fingerprint || '');
  const stateHashBefore = String(inner?.state_hash_before || '');
  if (!challengeFingerprint || !stateHashBefore) {
    throw new Error('The encounter is missing resolve data. Pull to refresh and try again.');
  }
  return {
    calendarDate: result.calendarDate,
    engineVersion: result.engineVersion,
    challengeFingerprint,
    stateHashBefore,
  };
}

export const resolveEncounter = (
  campaignId: string,
  body: DailyResolveMeta & { choiceId: string },
) =>
  api<{
    combatResolution?: CombatResolution;
    narration?: { outcomeText: string };
    resolution?: Record<string, unknown>;
  }>(`/api/campaigns/${encodeURIComponent(campaignId)}/daily/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const equipItem = (campaignId: string, instanceId: string) =>
  api<InventoryResponse>(`/api/game/${encodeURIComponent(campaignId)}/inventory/equip`, {
    method: 'POST',
    body: JSON.stringify({ instanceId }),
  });

export const unequipItem = (campaignId: string, slot: string) =>
  api<InventoryResponse>(`/api/game/${encodeURIComponent(campaignId)}/inventory/unequip`, {
    method: 'POST',
    body: JSON.stringify({ slot }),
  });

export const useConsumable = (campaignId: string, instanceId: string) =>
  api<{ updatedState?: { hp?: CharacterHP } }>(
    `/api/game/${encodeURIComponent(campaignId)}/inventory/use`,
    { method: 'POST', body: JSON.stringify({ instanceId }) },
  );

export const discardItem = (campaignId: string, instanceId: string) =>
  api(`/api/game/${encodeURIComponent(campaignId)}/inventory/discard`, {
    method: 'POST',
    body: JSON.stringify({ instanceId }),
  });
