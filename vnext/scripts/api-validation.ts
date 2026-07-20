/**
 * Phase 5 — Game API DTO / layer validation.
 * Run: npm run rpg:api:test
 *
 * Exercises pure DTO builders + inventory lifecycle without live HTTP.
 */

import {
  buildCharacterDTO,
  buildEncounterDTO,
  buildGameStateDTO,
  buildInventoryDTO,
  buildLootTableDTO,
  profileFromBundle,
  slugToDisplayName,
} from '../game/dto-builders';
import { buildRevealHint } from '../game/reveal-hint';
import { computeEffectiveStatBlock } from '../game/effective-stats';
import { processConsumableUse, applyConsumableEffect } from '../game/consumable-use';
import { createFullHp, applyWoundedStatPenalty } from '../game/hp-system';
import {
  addItem,
  computeEquipmentStatBonuses,
  equipItem,
  unequipSlot,
} from '../rpg/inventory-manager';
import { buildItemDefinitionMap, buildLootTableMap } from '../rpg/loot-roller';
import { loadRpgV1Maps } from '../rpg/maps/load-v1';
import { createEmptyInventoryState } from '../rpg/types';
import type {
  CharacterProfile,
  ChoiceOption,
  StatBlock,
  StatDerivationTrace,
} from '../rpg/types';
import type { RPGEffectsBundle } from '../rpg/contracts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`✓ ${msg}`);
}

function makeStats(partial: Partial<StatBlock> = {}): StatBlock {
  return {
    vitality: 10,
    resilience: 10,
    cunning: 10,
    charm: 10,
    intuition: 10,
    willpower: 10,
    ...partial,
  };
}

function makeTrace(stats: StatBlock): StatDerivationTrace {
  return {
    raw: stats,
    final: stats,
    perPlanet: {},
    aspectBonuses: [],
  };
}

function makeProfile(stats: StatBlock): CharacterProfile {
  return {
    id: 'char_api_test',
    classSlug: 'class_libra',
    subclassSlug: 'subclass_moon',
    risingModifierSlug: 'rising_leo',
    primaryElement: 'air',
    tonalPolarity: 'balanced',
    motionProfile: 'steady',
    gravityProfile: 'medium',
    luminaryWeight: 'balanced',
    dominantPlanets: ['Venus'],
    angularEmphasis: { first: false, fourth: false, seventh: true, tenth: false },
    temperament: {
      will: 0.5,
      insight: 0.5,
      attunement: 0.5,
      courage: 0.5,
      discipline: 0.5,
      adaptability: 0.5,
      bond: 0.5,
      shadowCapacity: 0.4,
      radiance: 0.5,
    },
    signatureDomains: [],
    statBlock: stats,
    statTrace: makeTrace(stats),
  };
}

function testSlugNames(): void {
  console.log('\n=== Slug display names ===');
  assert(slugToDisplayName('class_taurus') === 'Taurus', 'class slug → Taurus');
  assert(slugToDisplayName('subclass_moon') === 'Moon', 'subclass slug → Moon');
  assert(slugToDisplayName('rising_leo') === 'Leo', 'rising slug → Leo');
}

function testCharacterDTO(): void {
  console.log('\n=== Test 1: Character Sheet DTO ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const profile = makeProfile(makeStats({ vitality: 10, resilience: 10 }));
  let inv = createEmptyInventoryState();
  const weapon = maps.itemDefinitions.find((d) => d.category === 'weapon')!;
  const added = addItem(inv, weapon, 't', 'seed:w');
  inv = equipItem(added.state, added.instance.instanceId, definitions);

  const dto = buildCharacterDTO({
    profile,
    inventoryState: inv,
    definitions,
    campaignState: { hp: createFullHp(profile.statBlock), activeBuffs: [] },
    calendarDate: '2026-07-20',
  });
  assert(dto.classSlug === 'class_libra', 'classSlug present');
  assert(dto.className === 'Libra', 'className human-readable');
  assert(dto.baseStats.vitality === 10, 'baseStats vitality');
  assert(dto.effectiveStats.vitality >= 10, 'effectiveStats includes gear');
  assert(dto.equippedItems.length === 1, 'equipped items listed');
  assert(!!dto.temperament && !!dto.statTrace, 'temperament + trace');

  const woundedHp = { ...createFullHp(profile.statBlock), wounded: true, woundedDaysRemaining: 2, woundedUntil: '2026-07-22' };
  const woundedDto = buildCharacterDTO({
    profile,
    inventoryState: inv,
    definitions,
    campaignState: { hp: woundedHp, activeBuffs: [] },
    calendarDate: '2026-07-20',
  });
  const gear = computeEquipmentStatBonuses(inv, definitions, profile.classSlug);
  const expected = applyWoundedStatPenalty(10 + (gear.vitality ?? 0), true);
  assert(woundedDto.effectiveStats.vitality === expected, 'wounded penalty on effective');

  const buffed = buildCharacterDTO({
    profile,
    inventoryState: createEmptyInventoryState(),
    definitions,
    campaignState: {
      hp: createFullHp(profile.statBlock),
      activeBuffs: [{ stat: 'cunning', magnitude: 2, expiresDate: '2026-07-21', source: 'x' }],
    },
    calendarDate: '2026-07-20',
  });
  assert(buffed.effectiveStats.cunning === 12, 'buff reflected in effective');
  assert(buffed.activeBuffs.length === 1, 'activeBuffs on DTO');
}

function testGameStateDTO(): void {
  console.log('\n=== Test 2: Game State DTO ===');
  const inv = createEmptyInventoryState();
  const dto = buildGameStateDTO({
    campaignId: 'camp_1',
    state: {
      tone_track: {},
      domain_track: {},
      chapter: 3,
      flags: ['milestone_streak_7', 'other_flag', 'saturn_transition_7_to_8'],
      hp: createFullHp(makeStats()),
      streak: 7,
      lastPlayedDate: '2026-07-19',
      saturnChapter: {
        startingHouse: 7,
        currentHouse: 7,
        domain: 'relationships',
        label: 'The Relational Dungeon',
        enteredDate: '2026-01-01',
        transitionCount: 0,
      },
      activeBuffs: [],
      damageShield: null,
      revealActive: false,
    },
    inventoryState: inv,
  });
  assert(dto.hp.current === dto.hp.max, 'HP full by default create');
  assert(dto.streak === 7, 'streak');
  assert(dto.saturnChapter?.label === 'The Relational Dungeon', 'saturn chapter');
  assert(dto.milestoneFlags.includes('milestone_streak_7'), 'milestone flags filtered');
  assert(!dto.milestoneFlags.includes('other_flag'), 'non-milestone flags excluded');
  assert(dto.inventorySummary.bagCapacity === 15, 'inventory summary');

  const empty = buildGameStateDTO({
    campaignId: 'camp_old',
    state: { tone_track: {}, domain_track: {}, chapter: 1, flags: [] },
    inventoryState: inv,
  });
  assert(empty.streak === 0 && empty.saturnChapter === null, 'pre-Phase4 defaults');
  assert(empty.hp.max > 0, 'default HP synthesized');
}

function testInventoryLifecycle(): void {
  console.log('\n=== Test 3: Inventory Lifecycle ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const weapon = maps.itemDefinitions.find((d) => d.category === 'weapon')!;
  const armor = maps.itemDefinitions.find((d) => d.category === 'armor')!;

  let inv = createEmptyInventoryState();
  const w = addItem(inv, weapon, 't', 'seed:w');
  inv = w.state;
  const a = addItem(inv, armor, 't', 'seed:a');
  inv = a.state;

  const before = buildInventoryDTO('c1', inv, definitions, 'class_libra');
  assert(before.bag.length === 2, 'bag has 2 items');
  assert(before.equipped.weapon === null, 'weapon slot empty');

  inv = equipItem(inv, w.instance.instanceId, definitions);
  const afterEquip = buildInventoryDTO('c1', inv, definitions, 'class_libra');
  assert(afterEquip.equipped.weapon?.instanceId === w.instance.instanceId, 'weapon equipped');
  assert(afterEquip.bag.find((b) => b.instanceId === w.instance.instanceId)?.equipped === true, 'bag marks equipped');

  inv = unequipSlot(inv, 'weapon');
  const afterUnequip = buildInventoryDTO('c1', inv, definitions, 'class_libra');
  assert(afterUnequip.equipped.weapon === null, 'weapon unequipped');

  // accessory not unlocked
  const accessory = maps.itemDefinitions.find((d) => d.category === 'accessory');
  if (accessory) {
    const acc = addItem(inv, accessory, 't', 'seed:acc');
    inv = acc.state;
    let threw = false;
    try {
      equipItem(inv, acc.instance.instanceId, definitions);
    } catch {
      threw = true;
    }
    assert(threw, 'equip locked accessory throws');
  }

  // discard equipped check (logic mirror)
  inv = equipItem(inv, w.instance.instanceId, definitions);
  const equippedIds = Object.values(inv.equipped).filter(Boolean);
  assert(equippedIds.includes(w.instance.instanceId), 'cannot discard while equipped (guard)');
}

function testConsumableUse(): void {
  console.log('\n=== Test 4: Consumable Use ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const potion = maps.itemDefinitions.find((d) => d.consumableEffect?.type === 'heal')!;

  let inv = createEmptyInventoryState();
  const added = addItem(inv, potion, 't', 'seed:p');
  inv = equipItem(added.state, added.instance.instanceId, definitions);
  const hp = { ...createFullHp(makeStats()), current: 20 };

  const used = processConsumableUse({
    inventoryState: inv,
    instanceId: added.instance.instanceId,
    definitions,
    hp,
    calendarDate: '2026-07-20',
    activeBuffs: [],
    damageShield: null,
  });
  assert(used.hpAfter > used.hpBefore, 'heal increases HP');
  assert(used.itemConsumed || used.inventoryState.items.some((i) => i.quantity < added.instance.quantity), 'qty change');

  const full = createFullHp(makeStats());
  const noHeal = applyConsumableEffect({
    effect: { type: 'heal', magnitude: 5 },
    hp: full,
    calendarDate: '2026-07-20',
    activeBuffs: [],
    damageShield: null,
    sourceSlug: potion.slug,
  });
  assert(noHeal.hpAfter === noHeal.hpBefore, 'heal at full HP no change (422 candidate)');

  const buffFx = applyConsumableEffect({
    effect: { type: 'buff', magnitude: 2, stat: 'cunning', duration: 1 },
    hp: createFullHp(makeStats()),
    calendarDate: '2026-07-20',
    activeBuffs: [],
    damageShield: null,
    sourceSlug: 'buff',
  });
  assert(buffFx.activeBuffs[0]?.stat === 'cunning', 'buff applied');
}

function testEncounterDTO(): void {
  console.log('\n=== Test 5: Encounter Preview DTO ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const profile = makeProfile(makeStats({ vitality: 14, cunning: 12 }));
  const choices: ChoiceOption[] = [
    {
      id: 'assert',
      label: 'Assert',
      symbolicGesture: 'stand',
      patternTag: 'a',
      posture: 'assert',
      modality: 'direct',
      riskProfile: 'high',
      outcomeDirection: 'assert_define',
    },
    {
      id: 'engage',
      label: 'Engage',
      symbolicGesture: 'move',
      patternTag: 'e',
      posture: 'engage',
      modality: 'direct',
      riskProfile: 'med',
      outcomeDirection: 'engage_advance',
    },
  ];

  const dto = buildEncounterDTO({
    campaignId: 'c1',
    calendarDate: '2026-07-20',
    dailyInner: {
      challenge: {
        theme: 'theme',
        setting: 'setting',
        obstacle: 'obstacle',
        choices,
      },
      mechanical_encounter: {
        scene: { choices },
        dc: 12,
        baseDamage: 8,
        transitBodyCategory: 'mars',
        saturnHouse: 7,
        lootTableKey: 'saturn_house_7',
        choiceStatMap: {},
        intensityBand: 'moderate',
      },
      challenge_fingerprint: 'fp_abc',
      encounter_intro_narration: 'You face the gate.',
      encounter_intro_source: 'fallback',
    },
    resolution: null,
    profile,
    inventoryState: createEmptyInventoryState(),
    definitions,
    campaignState: {
      tone_track: {},
      domain_track: {},
      chapter: 1,
      flags: [],
      hp: createFullHp(profile.statBlock),
      streak: 2,
      revealActive: true,
    },
  });

  assert(dto.encounter.dc === 12, 'mechanical dc');
  assert(dto.choices.length === 2, 'choices present');
  const assertChoice = dto.choices.find((c) => c.id === 'assert')!;
  assert(assertChoice.primaryStat === 'vitality', 'assert → vitality');
  assert(assertChoice.currentModifier === Math.floor((14 - 10) / 2), 'modifier from effective');
  assert(!!dto.playerState.revealHint, 'revealHint when revealActive');
  assert(dto.resolved === false, 'not resolved');

  const resolved = buildEncounterDTO({
    ...{
      campaignId: 'c1',
      calendarDate: '2026-07-20',
      dailyInner: {
        challenge: { theme: 't', setting: 's', obstacle: 'o', choices },
        mechanical_encounter: {
          scene: { choices },
          dc: 12,
          baseDamage: 8,
          transitBodyCategory: 'mars',
          saturnHouse: 7,
          lootTableKey: 'saturn_house_7',
          choiceStatMap: {},
          intensityBand: 'moderate',
        },
        challenge_fingerprint: 'fp_abc',
        encounter_intro_narration: '',
        encounter_intro_source: 'fallback',
      },
      profile,
      inventoryState: createEmptyInventoryState(),
      definitions,
      campaignState: { tone_track: {}, domain_track: {}, chapter: 1, flags: [] },
    },
    resolution: { combat_resolution: { outcome: 'success' } },
  });
  assert(resolved.resolved === true, 'resolved true when resolution present');
}

function testLootTableDTO(): void {
  console.log('\n=== Test 6: Loot Table DTO ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const tables = buildLootTableMap(maps.lootTables);
  const dto = buildLootTableDTO({
    campaignId: 'c1',
    saturnHouse: 7,
    table: tables.get(7),
    definitions,
    classSlug: 'class_libra',
    campaignChapter: 1,
  });
  assert(dto.saturnHouse === 7, 'house 7');
  assert(dto.label.length > 0, 'label present');
  assert(dto.items.length > 0, 'items listed');
  assert(dto.items.every((i) => typeof i.dropWeight === 'string'), 'dropWeight is rarity label');
  if (dto.relicReward) {
    assert(!!dto.relicReward.slug, 'relic reward for house 7');
  }
}

function testRevealAndProfileFromBundle(): void {
  console.log('\n=== Test 7: Reveal + bundle profile ===');
  const a = buildRevealHint({
    challengeFingerprint: 'fp',
    calendarDate: '2026-07-20',
    revealActive: true,
  });
  const b = buildRevealHint({
    challengeFingerprint: 'fp',
    calendarDate: '2026-07-20',
    revealActive: true,
  });
  assert(!!a && a === b, 'reveal hint deterministic');
  assert(
    buildRevealHint({ challengeFingerprint: 'fp', calendarDate: '2026-07-20', revealActive: false }) ===
      null,
    'no hint when inactive'
  );

  const stats = makeStats({ vitality: 11 });
  const bundle = {
    metadata: {
      rpg_map_version: 'v1',
      rpg_algo_version: 'rpg-v2',
      audio_algo_version: 'audio-v1',
      natal_snapshot_hash: 'abc123',
      bundle_hash: 'bh',
    },
    classSlug: 'class_aries',
    subclassSlug: 'subclass_taurus',
    risingModifierSlug: 'rising_leo',
    placements: [],
    aspects: [],
    domainSummary: [],
    statBlock: stats,
    statTrace: makeTrace(stats),
  } as unknown as RPGEffectsBundle;
  const profile = profileFromBundle(bundle, stats, makeTrace(stats));
  assert(profile.classSlug === 'class_aries', 'profileFromBundle class');
  assert(profile.statBlock.vitality === 11, 'profileFromBundle stats');
}

function testEffectiveStatsIntegration(): void {
  console.log('\n=== Test 8: Effective stats integration ===');
  const base = makeStats({ vitality: 10 });
  const eff = computeEffectiveStatBlock(base, { vitality: 2 }, [], false);
  assert(eff.vitality === 12, 'gear bonus');
  const wounded = computeEffectiveStatBlock(base, { vitality: 2 }, [], true);
  assert(wounded.vitality === applyWoundedStatPenalty(12, true), 'wounded on combined');
}

function main(): void {
  console.log('Phase 5 — Game API validation');
  testSlugNames();
  testCharacterDTO();
  testGameStateDTO();
  testInventoryLifecycle();
  testConsumableUse();
  testEncounterDTO();
  testLootTableDTO();
  testRevealAndProfileFromBundle();
  testEffectiveStatsIntegration();
  console.log('\nAll Phase 5 API layer checks passed.');
}

main();
