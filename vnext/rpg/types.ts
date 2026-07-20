import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { RPGEffectsBundle, RPGDomainScore } from './contracts';
import type { SemanticCore } from '../semantic/semantic-core';
import type { RPGCampaignState as InternalCampaignState } from './campaign/state-machine';

export interface CharacterTemperamentAxes {
  will: number;
  insight: number;
  attunement: number;
  courage: number;
  discipline: number;
  adaptability: number;
  bond: number;
  shadowCapacity: number;
  radiance: number;
}

/** Mechanical combat/loot stat keys (Phase 1). */
export type StatKey =
  | 'vitality'
  | 'resilience'
  | 'cunning'
  | 'charm'
  | 'intuition'
  | 'willpower';

/** Final integer stat block scaled to 1–20. */
export interface StatBlock {
  vitality: number;
  resilience: number;
  cunning: number;
  charm: number;
  intuition: number;
  willpower: number;
}

/** Pre-normalization raw sums from placement + aspect layers. */
export interface StatBlockRaw {
  vitality: number;
  resilience: number;
  cunning: number;
  charm: number;
  intuition: number;
  willpower: number;
}

/** Debug / character-sheet provenance for why each stat landed where it did. */
export interface StatDerivationTrace {
  raw: StatBlockRaw;
  final: StatBlock;
  perPlanet: Record<
    string,
    {
      sign: string;
      house: number;
      dignity: string;
      retrograde: boolean;
      contributions: Partial<Record<StatKey, number>>;
    }
  >;
  aspectBonuses: Array<{
    bodyA: string;
    bodyB: string;
    aspectType: string;
    orb: number;
    statBonuses: Partial<Record<StatKey, number>>;
  }>;
}

export interface CharacterProfile {
  /** Deterministic identifier for this character profile, derived from natal snapshot hash + map version. */
  id: string;
  /** Direct bridge to existing RPG classing so Campaign stays aligned with other RPG surfaces. */
  classSlug: string;
  subclassSlug: string;
  risingModifierSlug: string;
  /** High-level chart identity flavor for Campaign surfaces. */
  primaryElement: 'fire' | 'earth' | 'air' | 'water';
  tonalPolarity: 'bright' | 'balanced' | 'dark';
  motionProfile: string;
  gravityProfile: string;
  luminaryWeight: 'sun' | 'moon' | 'balanced';
  dominantPlanets: string[];
  angularEmphasis: {
    first: boolean;
    fourth: boolean;
    seventh: boolean;
    tenth: boolean;
  };
  /** Normalized temperament axes in \[0,1], derived from natal structure. */
  temperament: CharacterTemperamentAxes;
  /** Top natal domains that seed Campaign focus (from RPGEffectsBundle.domainSummary). */
  signatureDomains: Array<{ domain: string; weight: number }>;
  /** Mechanical 6-stat block (1–20 integers). */
  statBlock: StatBlock;
  /** Full derivation trace for UI / debugging. */
  statTrace: StatDerivationTrace;
}

/** Alias to existing campaign state so Campaign uses a single canonical state representation. */
export type CampaignState = InternalCampaignState;

export type TransitPressureType =
  | 'constraint'
  | 'invitation'
  | 'conflict'
  | 'confusion'
  | 'revelation'
  | 'endurance'
  | 'restructuring'
  | 'release';

export interface TransitPressure {
  id: string;
  transitBody: string;
  natalBody: string;
  natalHouse: number;
  aspectType: string;
  /** Primary abstract domain for this pressure, derived from RPG transit domain mapping. */
  domain: string;
  /** Original phase1 family before challenge-layer compression. */
  pressureFamily: string;
  /** Coarse pressure classification for Campaign framing. */
  type: TransitPressureType;
  /** 0–1 normalized intensity (monotone in underlying domain score). */
  intensity: number;
  intensityBand: 'low' | 'moderate' | 'high' | 'critical';
  /** Symbolic life arena (e.g. identity, work, bond); derived from existing domain + house arena tags. */
  lifeArea: string;
  /** Deterministic hint about likely reactive pattern under this transit. */
  likelyShadowPattern: string;
  /** Deterministic hint about growth path / reframe. */
  growthPath: string;
  /** Group attribution when the pressure came from a specific member. */
  memberChartId?: string;
  /** Back-reference to contributing transit domain scores for debugging and explanation. */
  contributingDomains: RPGDomainScore[];
}

export type ResponsePosture =
  | 'observe'
  | 'assert'
  | 'engage'
  | 'withdraw'
  | 'support'
  | 'offer'
  | 'reframe'
  | 'contain';

export type ResponseModality =
  | 'reflective'
  | 'direct'
  | 'decisive'
  | 'protective'
  | 'relational'
  | 'restorative'
  | 'interpretive'
  | 'bounded';

export type OutcomeDirection =
  | 'assert_define'
  | 'engage_advance'
  | 'observe_hold'
  | 'withdraw_protect'
  | 'support_connect'
  | 'offer_restore'
  | 'reframe_integrate'
  | 'contain_limit';

export type ArchetypeId =
  | 'identity_test'
  | 'identity_definition'
  | 'resource_strain'
  | 'resource_opportunity'
  | 'signal_friction'
  | 'signal_reframe'
  | 'foundation_pressure'
  | 'foundation_repair'
  | 'creative_risk'
  | 'creative_devotion'
  | 'duty_pressure'
  | 'duty_alignment'
  | 'bond_friction'
  | 'bond_repair'
  | 'threshold_reckoning'
  | 'horizon_reorientation';

export type NatalBodyModifier =
  | 'core'
  | 'felt'
  | 'interpretive'
  | 'relational'
  | 'volitional'
  | 'expansive'
  | 'structural'
  | 'disruptive'
  | 'diffuse'
  | 'depth'
  | 'tender';

export interface ChoiceOption {
  id: string;
  /** Short verb phrase for UI; not moralized. */
  label: string;
  /** Symbolic description of what this choice represents. */
  symbolicGesture: string;
  /** Tagging for reflection layer (e.g. 'engage', 'pause', 'seek_counsel'). */
  patternTag: string;
  /** Stable semantic posture used across challenge and consequence layers. */
  posture: ResponsePosture;
  /** Surface description of how this posture approaches the challenge. */
  modality: ResponseModality;
  /** Stable risk/reward summary for player-facing explanation. */
  riskProfile: string;
  /** Deterministic consequence direction before domain-aware patch mapping. */
  outcomeDirection: OutcomeDirection;
}

export interface ChallengeScene {
  id: string;
  archetypeCategory?: string;
  archetypeId?: ArchetypeId;
  theme: string;
  /** Symbolic setting texture, not literal world-building. */
  setting: string;
  /** Core obstacle description framed as tension between pressure and character orientation. */
  obstacle: string;
  /** Transit node that most directly shaped this scene. */
  primaryPressure: TransitPressure;
  /** Additional pressures that colored the scene. */
  supportingPressures: TransitPressure[];
  /** Deterministic list of psychologically plausible responses. */
  choices: ChoiceOption[];
}

export interface ChallengeOutcome {
  /** Echoes the scene id for stable log linkage. */
  sceneId: string;
  /** The underlying choice that was taken. */
  choiceId: string;
  /** Human-readable narrative resolution. */
  narrative: string;
  /** Symbolic interpretation of what this pattern choice expresses under the active transit. */
  symbolicMeaning: string;
  /** Concrete reflection prompt or real-world lens. */
  realWorldReflection: string;
  /** Structural provenance back into the canonical pipeline. */
  provenance: {
    natalSnapshot: Pick<EphemerisSnapshot, 'ts' | 'tz' | 'lat' | 'lon'>;
    transitSnapshot: Pick<EphemerisSnapshot, 'ts' | 'tz' | 'lat' | 'lon'>;
    semantic_source_object_hash?: string;
    primaryDomain: string;
    lifeArea: string;
    pressureType: TransitPressureType;
    /** Which patternTag from the choice was activated (e.g. engage vs defer vs boundarize). */
    responsePatternTag: string;
  };
}

export interface CharacterBuilderInput {
  natalSnapshot: EphemerisSnapshot;
  featureVec: FeatureVec;
  effectsBundle: RPGEffectsBundle;
  semanticCore: SemanticCore;
  dominantPlanetNames: readonly string[];
}

// ---- Phase 2: Inventory / loot ----

export type ItemCategory = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'relic';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type SlotType = 'weapon' | 'armor' | 'accessory' | 'consumable' | 'relic';

export interface ConsumableEffect {
  type: 'heal' | 'buff' | 'shield' | 'reveal';
  stat?: StatKey;
  magnitude: number;
  duration?: number;
}

export interface ItemDefinition {
  slug: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  statModifiers: Partial<Record<StatKey, number>>;
  saturnHouse: number;
  elementAffinity?: 'fire' | 'earth' | 'air' | 'water';
  classAffinity?: string;
  consumableEffect?: ConsumableEffect;
  tags: string[];
}

export interface ItemInstance {
  instanceId: string;
  slug: string;
  acquiredAt: string;
  acquiredFrom: string;
  quantity: number;
}

export interface EquipmentSlots {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
  relic: string | null;
  consumable_1: string | null;
  consumable_2: string | null;
}

/** Slot unlock flags; includes consumable_2 for the second consumable slot. */
export type UnlockedSlot = SlotType | 'consumable_2';

export interface InventoryState {
  items: ItemInstance[];
  equipped: EquipmentSlots;
  maxBagSize: number;
  slotsUnlocked: UnlockedSlot[];
}

export interface LootTableEntry {
  slug: string;
  weight: number;
  minChapter: number;
}

export interface LootTable {
  saturnHouse: number;
  domain: string;
  items: LootTableEntry[];
}

export interface LootRollInput {
  saturnHouse: number;
  challengeFingerprint: string;
  choiceId: string;
  playerCunning: number;
  campaignChapter: number;
  /** When true, choice is treated as bold (assert-family) for +10% drop chance. */
  boldChoice?: boolean;
}

export interface LootRollResult {
  dropped: boolean;
  item: ItemDefinition | null;
  rollTrace: {
    seed: string;
    dropChance: number;
    rarityRoll: number;
    selectedRarity: ItemRarity | null;
    tableFiltered: number;
  };
}

export interface CampaignChapterInfo {
  house: number;
  domain: string;
  lootTableKey: string;
  thematicLabel: string;
}

// ---- Phase 3: Combat / HP ----

export interface CharacterHP {
  current: number;
  max: number;
  wounded: boolean;
  woundedUntil: string | null;
  woundedDaysRemaining: number;
}

export type RollOutcome =
  | 'critical_success'
  | 'success'
  | 'partial'
  | 'failure'
  | 'critical_failure';

export interface DieRoll {
  raw: number;
  modifier: number;
  total: number;
  outcome: RollOutcome;
}

export interface MechanicalEncounter {
  scene: ChallengeScene;
  dc: number;
  baseDamage: number;
  transitBodyCategory: string;
  saturnHouse: number;
  lootTableKey: string;
  choiceStatMap: Record<string, StatKey>;
  intensityBand: string;
}

export interface CombatResolution {
  dieRoll: DieRoll;
  outcome: RollOutcome;
  damageDealt: number;
  hpAfter: number;
  healAmount: number;
  woundedTriggered: boolean;
  streakSaved: boolean;
  lootResult: LootRollResult;
  itemLost: ItemDefinition | null;
  /** Exact equipped instance to remove on critical failure (preferred over slug). */
  itemLostInstanceId: string | null;
  xpGained: number;
}

/** Phase 4 — Saturn chapter tracking on campaign state. */
export interface SaturnChapterState {
  startingHouse: number;
  currentHouse: number;
  domain: string;
  label: string;
  enteredDate: string;
  transitionCount: number;
}

export interface ActiveBuff {
  stat: StatKey;
  magnitude: number;
  expiresDate: string;
  source: string;
}

export interface DamageShield {
  reduction: number;
  expiresDate: string;
}

export interface EffectiveStatBlock extends StatBlock {
  bonuses: Partial<Record<StatKey, number>>;
  buffs: Partial<Record<StatKey, number>>;
  woundedPenalty: boolean;
}

export interface ConsumableUseResult {
  used: boolean;
  effect: ConsumableEffect;
  hpBefore: number;
  hpAfter: number;
  woundedCleared: boolean;
  itemConsumed: boolean;
  inventoryState: InventoryState;
}

export interface MilestoneEvent {
  type: 'streak_unlock' | 'streak_bag' | 'saturn_transition';
  detail: string;
  slotsUnlocked?: UnlockedSlot[];
  bagSizeIncrease?: number;
  relicGranted?: ItemDefinition | null;
}

export function createEmptyInventoryState(): InventoryState {
  return {
    items: [],
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
      relic: null,
      consumable_1: null,
      consumable_2: null,
    },
    maxBagSize: 15,
    slotsUnlocked: ['weapon', 'armor', 'consumable'],
  };
}

// ---- Phase 5: Game API response DTOs ----

export interface EquippedItemSummaryDTO {
  instanceId: string;
  slug: string;
  name: string;
  category: string;
  rarity: string;
  statModifiers: Partial<Record<StatKey, number>>;
}

export interface CharacterResponseDTO {
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
    statModifiers: Partial<Record<StatKey, number>>;
  }>;
  activeBuffs: ActiveBuff[];
  temperament: CharacterTemperamentAxes;
  statTrace: StatDerivationTrace;
}

export interface GameStateResponseDTO {
  campaignId: string;
  hp: CharacterHP;
  streak: number;
  lastPlayedDate: string | null;
  chapter: number;
  saturnChapter: SaturnChapterState | null;
  damageShield: DamageShield | null;
  revealActive: boolean;
  slotsUnlocked: string[];
  maxBagSize: number;
  inventorySummary: {
    itemCount: number;
    bagCapacity: number;
    equippedCount: number;
  };
  milestoneFlags: string[];
}

export interface InventoryBagItemDTO {
  instanceId: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  statModifiers: Partial<Record<StatKey, number>>;
  quantity: number;
  acquiredAt: string;
  acquiredFrom: string;
  consumableEffect: ConsumableEffect | null;
  equipped: boolean;
  equippedSlot: string | null;
}

export interface InventoryResponseDTO {
  campaignId: string;
  bag: InventoryBagItemDTO[];
  equipped: {
    weapon: EquippedItemSummaryDTO | null;
    armor: EquippedItemSummaryDTO | null;
    accessory: EquippedItemSummaryDTO | null;
    consumable_1: EquippedItemSummaryDTO | null;
    consumable_2: EquippedItemSummaryDTO | null;
    relic: EquippedItemSummaryDTO | null;
  };
  slotsUnlocked: string[];
  maxBagSize: number;
  bagUsed: number;
  statBonusesFromGear: Partial<Record<StatKey, number>>;
}

export interface EncounterResponseDTO {
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
  choices: Array<{
    id: string;
    label: string;
    symbolicGesture: string;
    riskProfile: string;
    primaryStat: string;
    currentModifier: number;
  }>;
  playerState: {
    hp: CharacterHP;
    effectiveStats: EffectiveStatBlock;
    equippedSummary: string[];
    wounded: boolean;
    streak: number;
    revealHint: string | null;
  };
  resolved: boolean;
  resolution: unknown | null;
}

export interface LootTableResponseDTO {
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
    statModifiers: Partial<Record<StatKey, number>>;
    elementAffinity: string | null;
    classAffinityBonus: boolean;
    dropWeight: string;
  }>;
  relicReward: {
    slug: string;
    name: string;
    description: string;
    statModifiers: Partial<Record<StatKey, number>>;
  } | null;
}

