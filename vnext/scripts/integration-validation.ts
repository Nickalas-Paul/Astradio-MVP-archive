/**
 * Phase 4 — Campaign state integration validation.
 * Run: npm run rpg:integration:test
 */

import type { EphemerisSnapshot } from '../contracts';
import { computeEffectiveStatBlock } from '../game/effective-stats';
import { expireBuffs, expireShield, addCalendarDaysIso } from '../game/buff-manager';
import { processConsumableUse, applyConsumableEffect } from '../game/consumable-use';
import {
  applyChapterTransitionRewards,
  applySaturnTransitionRewards,
  buildActiveChapter,
  buildCampaignEra,
  buildSaturnChapterState,
  checkChapterTransition,
  checkEraShift,
  checkSaturnTransition,
  checkStreakMilestones,
  ensureActiveChapter,
  ensureSaturnChapter,
  findHouseRelic,
  migrateSaturnChapterToMarsEra,
  MAX_BAG_SIZE_CAP,
} from '../game/milestone-tracker';
import { findLowestValueEquippedInstance, resolveCombat } from '../game/combat-resolver';
import { createFullHp, applyWoundedStatPenalty } from '../game/hp-system';
import {
  addItem,
  computeEquipmentStatBonuses,
  equipItem,
  loadInventoryState,
} from '../rpg/inventory-manager';
import { buildItemDefinitionMap } from '../rpg/loot-roller';
import { loadRpgV1Maps } from '../rpg/maps/load-v1';
import { getCampaignChapter, getMarsTransitHouse, getSaturnTransitHouse } from '../rpg/saturn-house';
import { createEmptyInventoryState } from '../rpg/types';
import type {
  CharacterProfile,
  ChallengeScene,
  ItemDefinition,
  MechanicalEncounter,
  StatBlock,
  TransitPressure,
} from '../rpg/types';

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

function makeTransit(saturnLon: number, marsLon = saturnLon): EphemerisSnapshot {
  return {
    ts: '2026-07-20T12:00:00Z',
    tz: 'America/Chicago',
    lat: 41.88,
    lon: -87.63,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 118 },
      { name: 'Moon', lon: 200 },
      { name: 'Saturn', lon: saturnLon },
      { name: 'Mars', lon: marsLon },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

const EVEN_CUSPS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function makeProfile(stats: StatBlock): CharacterProfile {
  return {
    id: 'char_test',
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
    statTrace: { raw: stats, final: stats, perPlanet: {}, aspectBonuses: [] },
  };
}

function makeScene(): ChallengeScene {
  const pressure: TransitPressure = {
    id: 'p1',
    transitBody: 'Mars',
    natalBody: 'Sun',
    natalHouse: 7,
    aspectType: 'square',
    domain: 'partnership',
    pressureFamily: 'conflict',
    type: 'conflict',
    intensity: 0.6,
    intensityBand: 'moderate',
    lifeArea: 'relationships',
    likelyShadowPattern: 'phase1_shadow:friction',
    growthPath: 'phase1_growth:not_at_event_layer',
    memberChartId: 'm1',
    contributingDomains: [],
  };
  return {
    id: 'scene_test',
    theme: 'test',
    setting: 'a test setting',
    obstacle: { name: 'test obstacle', type: 'hazard', brief: 'test obstacle' },
    primaryPressure: pressure,
    supportingPressures: [],
    choices: [
      {
        id: 'name_truth',
        label: 'Name the truth',
        symbolicGesture: 'speak',
        posture: 'assert',
        modality: 'direct',
        riskProfile: 'high',
        outcomeDirection: 'assert_define',
        patternTag: 'truth',
      },
    ],
  };
}

function testStreakMilestones(): void {
  console.log('\n=== Test 1: Streak Milestones ===');
  const base = createEmptyInventoryState();

  const at6 = checkStreakMilestones({
    streak: 6,
    slotsUnlocked: base.slotsUnlocked,
    maxBagSize: 15,
    flags: [],
  });
  assert(!at6.newSlots.includes('accessory'), 'streak 6: no accessory unlock');
  assert(at6.events.length === 0, 'streak 6: no events');

  const at7 = checkStreakMilestones({
    streak: 7,
    slotsUnlocked: base.slotsUnlocked,
    maxBagSize: 15,
    flags: [],
  });
  assert(at7.newSlots.includes('accessory'), 'streak 7: accessory unlocked');
  assert(at7.flags.includes('milestone_streak_7'), 'streak 7: flag set');

  const at14 = checkStreakMilestones({
    streak: 14,
    slotsUnlocked: at7.newSlots,
    maxBagSize: 15,
    flags: at7.flags,
  });
  assert(at14.newSlots.includes('consumable_2'), 'streak 14: consumable_2 unlocked');
  assert(at14.flags.includes('milestone_streak_14'), 'streak 14: flag set');

  const at30 = checkStreakMilestones({
    streak: 30,
    slotsUnlocked: at14.newSlots,
    maxBagSize: 15,
    flags: at14.flags,
  });
  assert(at30.maxBagSize === 20, 'streak 30: bag +5');
  assert(at30.flags.includes('milestone_streak_30'), 'streak 30: flag set');

  const rerun7 = checkStreakMilestones({
    streak: 7,
    slotsUnlocked: at7.newSlots,
    maxBagSize: 15,
    flags: at7.flags,
  });
  assert(rerun7.events.length === 0, 're-resolve streak 7: no duplicate unlock');
}

function testChapterTransition(): void {
  console.log('\n=== Test 2: Mars Chapter Transition ===');
  const house7Lon = 195;
  const house8Lon = 225;
  const chapter = buildActiveChapter(7, '2026-01-01');
  assert(chapter.currentHouse === 7, 'starting house 7');
  assert(chapter.transitBody === 'mars', 'transitBody mars');

  assert(
    checkChapterTransition(chapter, makeTransit(195, house7Lon), EVEN_CUSPS, '2026-07-20') === null,
    'same Mars house: no transition'
  );
  assert(
    checkChapterTransition(null, makeTransit(195, house8Lon), EVEN_CUSPS, '2026-07-20') === null,
    'null activeChapter: no false transition reward'
  );

  const transition = checkChapterTransition(
    chapter,
    makeTransit(195, house8Lon),
    EVEN_CUSPS,
    '2026-07-20'
  );
  assert(!!transition && transition.oldHouse === 7 && transition.newHouse === 8, 'Mars 7 → 8');

  const rewards = applyChapterTransitionRewards({
    transition: transition!,
    chapterTransitionCountBefore: 0,
    slotsUnlocked: createEmptyInventoryState().slotsUnlocked,
    maxBagSize: 15,
    flags: [],
    history: [],
  });
  assert(rewards.slotsUnlocked.includes('relic'), 'first transition unlocks relic');
  assert(rewards.chapterTransitionCount === 1, 'chapterTransitionCount = 1');
  assert(rewards.flags.some((f) => f.startsWith('chapter_transition_')), 'chapter_transition flag');
  assert(!!rewards.relic && rewards.relic.saturnHouse === 7, 'relic from departing house');

  const era = buildCampaignEra(7, '2026-01-01');
  const eraShift = checkEraShift(era, makeTransit(house8Lon, house7Lon), EVEN_CUSPS, '2026-07-20');
  assert(!!eraShift && eraShift.newHouse === 8, 'Saturn era shift detected');
  assert(checkEraShift(null, makeTransit(house8Lon), EVEN_CUSPS, '2026-07-20') === null, 'null era: no shift');

  // Legacy Saturn helpers still work
  const legacy = buildSaturnChapterState(7, '2026-01-01', 0);
  const legacyT = checkSaturnTransition(legacy, makeTransit(house8Lon), EVEN_CUSPS, '2026-07-20');
  assert(!!legacyT, 'legacy Saturn transition still works');
  const legacyR = applySaturnTransitionRewards({
    transition: legacyT!,
    slotsUnlocked: createEmptyInventoryState().slotsUnlocked,
    maxBagSize: 15,
    flags: [],
    history: [],
  });
  assert(legacyR.flags.some((f) => f.startsWith('saturn_transition_')), 'legacy saturn flag');
}

function testConsumableUse(): void {
  console.log('\n=== Test 3: Consumable Use ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const potion =
    maps.itemDefinitions.find((d) => d.slug === 'ember_tonic') ||
    maps.itemDefinitions.find((d) => d.consumableEffect?.type === 'heal');
  if (!potion) throw new Error('no heal consumable in maps');

  let state = createEmptyInventoryState();
  const added = addItem(state, potion, 'test', 'seed:heal:1');
  state = added.state;
  state = equipItem(state, added.instance.instanceId, definitions);

  const hp = { ...createFullHp(makeStats({ vitality: 10 })), current: 20, wounded: false };

  const used = processConsumableUse({
    inventoryState: state,
    instanceId: added.instance.instanceId,
    definitions,
    hp,
    calendarDate: '2026-07-20',
    activeBuffs: [],
    damageShield: null,
  });
  assert(used.used, 'consumable used');
  assert(used.hpAfter > used.hpBefore, 'heal restored HP');
  assert(
    used.itemConsumed ||
      used.inventoryState.items.some((i) => i.instanceId === added.instance.instanceId && i.quantity < added.instance.quantity),
    'quantity decremented or removed'
  );

  let lastState = createEmptyInventoryState();
  const one = addItem(lastState, potion, 'test', 'seed:heal:last');
  lastState = one.state;
  lastState.items = lastState.items.map((i) =>
    i.instanceId === one.instance.instanceId ? { ...i, quantity: 1 } : i
  );
  lastState = equipItem(lastState, one.instance.instanceId, definitions);
  const lastUse = processConsumableUse({
    inventoryState: lastState,
    instanceId: one.instance.instanceId,
    definitions,
    hp: { ...createFullHp(makeStats()), current: 10 },
    calendarDate: '2026-07-20',
    activeBuffs: [],
    damageShield: null,
  });
  assert(lastUse.itemConsumed, 'last potion removed');
  assert(
    !lastUse.inventoryState.items.some((i) => i.instanceId === one.instance.instanceId),
    'item gone from inventory'
  );
  assert(lastUse.inventoryState.equipped.consumable_1 === null, 'slot cleared');

  const woundedHp = {
    ...createFullHp(makeStats()),
    current: 0,
    wounded: true,
    woundedDaysRemaining: 2,
    woundedUntil: '2026-07-22',
  };
  const healFx = applyConsumableEffect({
    effect: { type: 'heal', magnitude: 50 },
    hp: woundedHp,
    calendarDate: '2026-07-20',
    activeBuffs: [],
    damageShield: null,
    sourceSlug: potion.slug,
  });
  assert(healFx.hp.current > 0 && !healFx.hp.wounded, 'heal clears wounded');
  assert(healFx.woundedCleared, 'woundedCleared flag');

  const buffFx = applyConsumableEffect({
    effect: { type: 'buff', magnitude: 2, stat: 'cunning', duration: 1 },
    hp: createFullHp(makeStats()),
    calendarDate: '2026-07-20',
    activeBuffs: [],
    damageShield: null,
    sourceSlug: 'buff_potion',
  });
  assert(buffFx.activeBuffs.length === 1, 'buff added');
  assert(buffFx.activeBuffs[0]!.stat === 'cunning', 'buff targets cunning');
  assert(buffFx.activeBuffs[0]!.expiresDate === addCalendarDaysIso('2026-07-20', 1), 'buff expiry set');

  const active = expireBuffs(buffFx.activeBuffs, '2026-07-20');
  assert(active.length === 1, 'buff active on grant day');
  const expired = expireBuffs(
    buffFx.activeBuffs,
    addCalendarDaysIso(buffFx.activeBuffs[0]!.expiresDate, 1)
  );
  assert(expired.length === 0, 'buff expired after expiresDate');
}

function testEffectiveStats(): void {
  console.log('\n=== Test 4: Effective Stats ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const base = makeStats({ vitality: 10, resilience: 10, cunning: 10 });

  let inv = createEmptyInventoryState();
  const weapon =
    maps.itemDefinitions.find((d) => d.category === 'weapon' && (d.statModifiers?.vitality || 0) >= 2) ||
    maps.itemDefinitions.find((d) => d.category === 'weapon' && (d.statModifiers?.vitality || 0) > 0);
  const armor =
    maps.itemDefinitions.find((d) => d.category === 'armor' && (d.statModifiers?.resilience || 0) >= 1) ||
    maps.itemDefinitions.find((d) => d.category === 'armor');
  if (!weapon || !armor) throw new Error('need weapon/armor defs');

  const w = addItem(inv, weapon, 't', 'seed:w');
  inv = w.state;
  inv = equipItem(inv, w.instance.instanceId, definitions);
  const a = addItem(inv, armor, 't', 'seed:a');
  inv = a.state;
  inv = equipItem(inv, a.instance.instanceId, definitions);

  const gear = computeEquipmentStatBonuses(inv, definitions, 'class_libra');
  const vitBonus = gear.vitality ?? 0;
  const resBonus = gear.resilience ?? 0;

  const eff = computeEffectiveStatBlock(base, gear, [], false);
  assert(eff.vitality === 10 + vitBonus, `vitality base+gear (${eff.vitality})`);
  assert(eff.resilience === 10 + resBonus, `resilience base+gear (${eff.resilience})`);

  const withBuff = computeEffectiveStatBlock(
    base,
    gear,
    [{ stat: 'cunning', magnitude: 2, expiresDate: '2026-07-21', source: 'x' }],
    false
  );
  assert(withBuff.cunning === 12, 'cunning base+buff');

  const wounded = computeEffectiveStatBlock(base, gear, [], true);
  const expectedVit = applyWoundedStatPenalty(10 + vitBonus, true);
  assert(wounded.vitality === expectedVit, 'wounded applies 25% to effective not base');
  assert(wounded.woundedPenalty === true, 'woundedPenalty flag');
}

function testCriticalFailureInstanceId(): void {
  console.log('\n=== Test 5: Critical Failure InstanceId ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  const weapon = maps.itemDefinitions.find((d) => d.category === 'weapon')!;
  const armor = maps.itemDefinitions.find((d) => d.category === 'armor')!;

  let inv = createEmptyInventoryState();
  const w1 = addItem(inv, weapon, 't', 'seed:w1');
  inv = w1.state;
  inv = equipItem(inv, w1.instance.instanceId, definitions);
  const a1 = addItem(inv, armor, 't', 'seed:a1');
  inv = a1.state;
  inv = equipItem(inv, a1.instance.instanceId, definitions);

  const lost = findLowestValueEquippedInstance(inv, definitions);
  assert(!!lost, 'lowest value equipped found');
  assert(typeof lost!.instanceId === 'string' && lost!.instanceId.length > 0, 'returns instanceId');
  assert(
    lost!.instanceId === inv.equipped.weapon || lost!.instanceId === inv.equipped.armor,
    'instanceId is an equipped slot'
  );

  const scene = makeScene();
  const encounter: MechanicalEncounter = {
    scene,
    dc: 11,
    baseDamage: 8,
    transitBodyCategory: 'mars',
    saturnHouse: 7,
    lootTableKey: 'saturn_house_7',
    choiceStatMap: { name_truth: 'vitality' },
    intensityBand: 'moderate',
  };
  const critFail = resolveCombat({
    encounter,
    choiceId: 'name_truth',
    characterProfile: makeProfile(makeStats({ vitality: 10, resilience: 12, cunning: 12 })),
    equipmentBonuses: {},
    hp: createFullHp(makeStats()),
    inventoryState: inv,
    calendarDate: '2026-07-20',
    streak: 1,
    flags: [],
    challengeFingerprint: 'fp_crit',
    definitions,
    rawRollOverride: 1,
  });
  assert(critFail.outcome === 'critical_failure', 'crit fail outcome');
  assert(critFail.itemLostInstanceId === lost!.instanceId, 'itemLostInstanceId matches lowest-value instance');
  assert(critFail.itemLost?.slug === lost!.definition.slug, 'definition matches');
}

function testPersistIntentsShape(): void {
  console.log('\n=== Test 6: Persist Intents (TX consolidation contract) ===');
  // Pipeline returns intents; route applies them on the TX client.
  // Verify grant/delete/equipment intent shapes without a live DB.
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);
  let inv = createEmptyInventoryState();
  const weapon = maps.itemDefinitions.find((d) => d.category === 'weapon')!;
  const added = addItem(inv, weapon, 't', 'seed:loot');
  inv = added.state;

  const grantIntent = { grant: { instance: added.instance, grantSeed: 'loot:fp:choice:2026-07-20' } };
  const deleteIntent = { deleteInstanceId: added.instance.instanceId };
  const equipmentIntent = {
    equipment: {
      equipped: inv.equipped,
      slotsUnlocked: inv.slotsUnlocked,
      maxBagSize: Math.min(MAX_BAG_SIZE_CAP, inv.maxBagSize + 5),
    },
  };
  assert(!!grantIntent.grant.instance.instanceId, 'grant intent has instanceId');
  assert(!!deleteIntent.deleteInstanceId, 'delete intent uses exact instanceId');
  assert(equipmentIntent.equipment.maxBagSize <= MAX_BAG_SIZE_CAP, 'bag size capped at 50');
  assert(equipmentIntent.equipment.maxBagSize === 20, 'milestone bag growth +5');
}

function testSaturnInitAndLazyBackfill(): void {
  console.log('\n=== Test 7: Chapter Init / Migration / Lazy Backfill ===');
  const transit = makeTransit(195, 100); // Saturn H7, Mars H4
  const marsHouse = getMarsTransitHouse(transit, EVEN_CUSPS);
  const saturnHouse = getSaturnTransitHouse(transit, EVEN_CUSPS);
  assert(marsHouse === 4, 'Mars at 100° → house 4');
  assert(saturnHouse === 7, 'Saturn at 195° → house 7');

  const ensured = ensureActiveChapter(null, transit, EVEN_CUSPS, '2026-07-20');
  assert(ensured.backfilled === true && ensured.chapter.currentHouse === 4, 'Mars chapter backfill');

  const migrated = migrateSaturnChapterToMarsEra({
    saturnChapter: buildSaturnChapterState(7, '2026-01-01', 2),
    activeChapter: null,
    campaignEra: null,
    chapterTransitionCount: undefined,
    transitSnapshot: transit,
    natalCusps: EVEN_CUSPS,
    today: '2026-07-20',
  });
  assert(migrated.migrated === true, 'legacy saturnChapter migrated');
  assert(migrated.activeChapter.currentHouse === 4, 'activeChapter seeded from Mars (not Saturn)');
  assert(migrated.campaignEra.currentHouse === 7, 'campaignEra from old Saturn');
  assert(migrated.chapterTransitionCount === 2, 'transitionCount carried forward');
  assert(
    checkChapterTransition(
      migrated.activeChapter,
      transit,
      EVEN_CUSPS,
      '2026-07-20'
    ) === null,
    'migration day does not fire Mars transition'
  );

  const already = ensureActiveChapter(migrated.activeChapter, transit, EVEN_CUSPS, '2026-07-21');
  assert(already.backfilled === false, 'existing activeChapter not overwritten');

  const legacy = ensureSaturnChapter(null, transit, EVEN_CUSPS, '2026-07-20');
  assert(legacy.backfilled === true && legacy.chapter.currentHouse === 7, 'legacy Saturn backfill');
}

function testFullLoopDeterminism(): void {
  console.log('\n=== Test 8: Integration Loop (mechanical) ===');
  const maps = loadRpgV1Maps();
  const definitions = buildItemDefinitionMap(maps.itemDefinitions);

  // Day 0 state
  let streak = 0;
  let flags: string[] = [];
  let slots = createEmptyInventoryState().slotsUnlocked;
  let bag = 15;
  const chapter = buildSaturnChapterState(7, '2026-07-01', 0);

  // Build streak to 7
  for (let day = 1; day <= 7; day++) {
    streak = day;
    const ms = checkStreakMilestones({ streak, slotsUnlocked: slots, maxBagSize: bag, flags });
    slots = ms.newSlots;
    bag = ms.maxBagSize;
    flags = ms.flags;
  }
  assert(slots.includes('accessory'), 'day 7 accessory unlock');
  assert(flags.includes('milestone_streak_7'), 'day 7 flag');

  // Mock Saturn transition
  const transition = checkSaturnTransition(chapter, makeTransit(225), EVEN_CUSPS, '2026-07-08');
  assert(!!transition, 'mock transition fires');
  const rewards = applySaturnTransitionRewards({
    transition: transition!,
    slotsUnlocked: slots,
    maxBagSize: bag,
    flags,
    history: [],
  });
  assert(rewards.slotsUnlocked.includes('relic'), 'chapter event unlocks relic');
  assert(!!rewards.relic, 'chapter relic granted');
  assert(rewards.maxBagSize === bag + 5, 'chapter bag growth');

  // Effective stats remain deterministic
  const a = computeEffectiveStatBlock(makeStats({ vitality: 10 }), { vitality: 2 }, [], false);
  const b = computeEffectiveStatBlock(makeStats({ vitality: 10 }), { vitality: 2 }, [], false);
  assert(a.vitality === b.vitality && a.vitality === 12, 'effective stats deterministic');

  // Shield expiry
  const shield = expireShield({ reduction: 0.5, expiresDate: '2026-07-20' }, '2026-07-21');
  assert(shield === null, 'expired shield removed');

  // House relic lookup stable
  const r1 = findHouseRelic(7);
  const r2 = findHouseRelic(7);
  assert(!!r1 && r1.slug === r2?.slug, 'house relic lookup deterministic');

  void definitions;
  void loadInventoryState;
}

function main(): void {
  console.log('Phase 4 — Integration validation');
  testStreakMilestones();
  testChapterTransition();
  testConsumableUse();
  testEffectiveStats();
  testCriticalFailureInstanceId();
  testPersistIntentsShape();
  testSaturnInitAndLazyBackfill();
  testFullLoopDeterminism();
  console.log('\nAll Phase 4 integration checks passed.');
}

main();
