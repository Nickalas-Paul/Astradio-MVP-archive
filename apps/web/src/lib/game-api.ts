/**
 * Typed fetch wrappers for Phase 5 /api/game/* and campaign resolve/compose.
 */

export type StatBlock = {
  vitality: number;
  resilience: number;
  cunning: number;
  charm: number;
  intuition: number;
  willpower: number;
};

export type EffectiveStatBlock = StatBlock & {
  bonuses: Partial<Record<string, number>>;
  buffs: Partial<Record<string, number>>;
  woundedPenalty: boolean;
};

export type CharacterHP = {
  current: number;
  max: number;
  wounded: boolean;
  woundedUntil: string | null;
  woundedDaysRemaining: number;
};

export type GameStateResponse = {
  campaignId: string;
  hp: CharacterHP;
  streak: number;
  lastPlayedDate: string | null;
  chapter: number;
  saturnChapter: {
    currentHouse: number;
    domain: string;
    label: string;
    startingHouse: number;
    enteredDate: string;
    transitionCount: number;
  } | null;
  damageShield: { reduction: number; expiresDate: string } | null;
  revealActive: boolean;
  slotsUnlocked: string[];
  maxBagSize: number;
  inventorySummary: {
    itemCount: number;
    bagCapacity: number;
    equippedCount: number;
  };
  milestoneFlags: string[];
};

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
    baseDamage: number;
    saturnHouse: number;
    lootTableKey: string;
    introNarration: string;
    introSource: 'gemini' | 'fallback';
  };
  choices: EncounterChoice[];
  playerState: {
    hp: CharacterHP;
    effectiveStats: EffectiveStatBlock;
    equippedSummary: string[];
    wounded: boolean;
    streak: number;
    revealHint: string | null;
  };
  resolved: boolean;
  resolution: Record<string, unknown> | null;
};

export type InventoryBagItem = {
  instanceId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  statModifiers: Record<string, number>;
  quantity: number;
  acquiredAt: string;
  acquiredFrom: string;
  consumableEffect: {
    type: string;
    stat?: string;
    magnitude: number;
    duration?: number;
  } | null;
  equipped: boolean;
  equippedSlot: string | null;
};

export type EquippedSummary = {
  instanceId: string;
  slug: string;
  name: string;
  category: string;
  rarity: string;
  statModifiers: Record<string, number>;
} | null;

export type InventoryResponse = {
  campaignId: string;
  bag: InventoryBagItem[];
  equipped: {
    weapon: EquippedSummary;
    armor: EquippedSummary;
    accessory: EquippedSummary;
    consumable_1: EquippedSummary;
    consumable_2: EquippedSummary;
    relic: EquippedSummary;
  };
  slotsUnlocked: string[];
  maxBagSize: number;
  bagUsed: number;
  statBonusesFromGear: Record<string, number>;
};

export type CharacterResponse = {
  characterId: string;
  classSlug: string;
  className: string;
  subclassSlug: string;
  subclassName: string;
  risingSlug: string;
  risingName: string;
  primaryElement: string;
  dominantPlanets: string[];
  baseStats: StatBlock;
  effectiveStats: EffectiveStatBlock;
  equippedItems: Array<{
    slot: string;
    instanceId: string;
    slug: string;
    name: string;
    category: string;
    rarity: string;
    statModifiers: Record<string, number>;
  }>;
  activeBuffs: Array<{
    stat: string;
    magnitude: number;
    expiresDate: string;
    source: string;
  }>;
  temperament: Record<string, number>;
  statTrace: unknown;
};

export type ConsumableUseResult = {
  used: true;
  effect: {
    type: string;
    stat: string | null;
    magnitude: number;
    duration: number | null;
  };
  hpBefore: number;
  hpAfter: number;
  woundedCleared: boolean;
  itemConsumed: boolean;
  updatedState: {
    hp: CharacterHP;
    activeBuffs: unknown[];
    damageShield: unknown;
    revealActive: boolean;
  };
};

export type DiscardResponse = {
  discarded: true;
  slug: string;
  name: string;
  bagUsed: number;
  maxBagSize: number;
};

export type LootTableResponse = {
  campaignId: string;
  saturnHouse: number;
  domain: string;
  label: string;
  items: Array<{
    slug: string;
    name: string;
    description: string;
    category: string;
    rarity: string;
    statModifiers: Record<string, number>;
    elementAffinity: string | null;
    classAffinityBonus: boolean;
    dropWeight: string;
  }>;
  relicReward: {
    slug: string;
    name: string;
    description: string;
    statModifiers: Record<string, number>;
  } | null;
};

export type CombatResolutionPayload = {
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
      slug: string;
      name: string;
      description: string;
      category: string;
      rarity: string;
      statModifiers: Record<string, number>;
    } | null;
  };
  itemLost: { slug: string; name: string; instanceId: string | null } | null;
  milestones?: Array<{
    type: string;
    detail: string;
    slotsUnlocked?: string[];
    bagSizeIncrease?: number;
    relicGranted?: {
      slug: string;
      name: string;
      description: string;
      rarity: string;
      statModifiers: Record<string, number>;
    } | null;
  }>;
  consumableUse?: unknown;
  revealActive?: boolean;
};

export type ResolveResponse = {
  campaignId: string;
  calendarDate: string;
  engineVersion: string;
  resolution?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  stateHash?: string;
  combatResolution?: CombatResolutionPayload;
  narration?: { outcomeText: string; source: string };
  error?: string;
  code?: string;
  message?: string;
};

export class GameApiError extends Error {
  status: number;
  code?: string;
  body: unknown;

  constructor(status: number, message: string, body?: unknown, code?: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}));
}

async function gameFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const obj = data as { error?: string; message?: string; code?: string };
    throw new GameApiError(
      res.status,
      obj.message || obj.error || `Request failed (${res.status})`,
      data,
      obj.code
    );
  }
  return data as T;
}

export async function fetchGameState(campaignId: string): Promise<GameStateResponse> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/state`);
}

export async function fetchGameEncounter(
  campaignId: string,
  opts?: { date?: string; engineVersion?: string }
): Promise<EncounterResponse> {
  const url = new URL(
    `/api/game/${encodeURIComponent(campaignId)}/encounter`,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  );
  if (opts?.date) url.searchParams.set('date', opts.date);
  if (opts?.engineVersion) url.searchParams.set('engineVersion', opts.engineVersion);
  return gameFetch(url.pathname + url.search);
}

export async function fetchGameInventory(campaignId: string): Promise<InventoryResponse> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/inventory`);
}

export async function fetchGameCharacter(campaignId: string): Promise<CharacterResponse> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/character`);
}

export async function fetchLootTable(campaignId: string): Promise<LootTableResponse> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/loot-table`);
}

export async function equipItem(campaignId: string, instanceId: string): Promise<InventoryResponse> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/inventory/equip`, {
    method: 'POST',
    body: JSON.stringify({ instanceId }),
  });
}

export async function unequipSlot(campaignId: string, slot: string): Promise<InventoryResponse> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/inventory/unequip`, {
    method: 'POST',
    body: JSON.stringify({ slot }),
  });
}

export async function useConsumable(
  campaignId: string,
  instanceId: string
): Promise<ConsumableUseResult> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/inventory/use`, {
    method: 'POST',
    body: JSON.stringify({ instanceId }),
  });
}

export async function discardItem(campaignId: string, instanceId: string): Promise<DiscardResponse> {
  return gameFetch(`/api/game/${encodeURIComponent(campaignId)}/inventory/discard`, {
    method: 'POST',
    body: JSON.stringify({ instanceId }),
  });
}

export type CampaignDailyResponse = {
  campaignId: string;
  calendarDate: string;
  engineVersion: string;
  daily: {
    daily?: {
      challenge_fingerprint?: string;
      state_hash_before?: string;
      challenge?: unknown;
    };
    resolution?: unknown;
    challenge_fingerprint?: string;
    state_hash_before?: string;
  };
};

export type DailyResolveMeta = {
  calendarDate: string;
  engineVersion: string;
  challengeFingerprint: string;
  stateHashBefore: string;
};

export async function composeCampaignDaily(
  campaignId: string,
  body: { date: string; time: string; location?: unknown }
): Promise<CampaignDailyResponse> {
  return gameFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/daily`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Extract resolve tokens from campaign daily compose/cache response. */
export function extractResolveMeta(daily: CampaignDailyResponse): DailyResolveMeta | null {
  const inner =
    daily.daily?.daily && typeof daily.daily.daily === 'object'
      ? daily.daily.daily
      : daily.daily;
  const fingerprint = String(inner?.challenge_fingerprint || '').trim();
  const stateHashBefore = String(inner?.state_hash_before || '').trim();
  if (!fingerprint || !stateHashBefore || !daily.calendarDate || !daily.engineVersion) {
    return null;
  }
  return {
    calendarDate: daily.calendarDate,
    engineVersion: daily.engineVersion,
    challengeFingerprint: fingerprint,
    stateHashBefore,
  };
}

/** Parse combat payload from a stored daily resolution (already resolved today). */
export function combatFromStoredResolution(
  resolution: Record<string, unknown> | null | undefined
): { combat: CombatResolutionPayload; narration: string } | null {
  if (!resolution || typeof resolution !== 'object') return null;
  const combat = resolution.combat_resolution as CombatResolutionPayload | undefined;
  if (!combat || !combat.dieRoll) return null;
  const narration =
    typeof resolution.outcome_narration === 'string'
      ? resolution.outcome_narration
      : 'The encounter is complete.';
  return { combat, narration };
}

export type ResolveBody = {
  calendarDate: string;
  engineVersion: string;
  choiceId: string;
  challengeFingerprint: string;
  stateHashBefore: string;
  consumableUseInstanceId?: string;
};

export async function resolveEncounter(
  campaignId: string,
  body: ResolveBody
): Promise<ResolveResponse> {
  return gameFetch(`/api/campaigns/${encodeURIComponent(campaignId)}/daily/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listCampaigns(): Promise<{
  campaigns: Array<{ campaignId: string; mode?: string; updatedAt?: string; stateJson?: unknown }>;
}> {
  return gameFetch('/api/campaigns');
}

export async function createSoloCampaign(): Promise<{ campaignId: string }> {
  return gameFetch('/api/campaigns/create', {
    method: 'POST',
    body: JSON.stringify({ mode: 'solo' }),
  });
}

export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowTimeLocal(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
