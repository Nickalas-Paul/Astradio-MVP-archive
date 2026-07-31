/**
 * Phase 3 — Combat / HP / narration validation.
 * Run: npm run rpg:combat:test
 */

import {
  applyDamageToHp,
  applyDailyRecovery,
  applyWoundedStatPenalty,
  createFullHp,
  deriveMaxHp,
  woundedRecoveryDays,
} from '../game/hp-system';
import { rollDie, resolveRollOutcome, resolveCombat, hash32 } from '../game/combat-resolver';
import { statModifier, primaryStatForChoice } from '../game/choice-stat-map';
import { baseDamageForTransitBody, resilienceDamageReduction } from '../game/damage-tables';
import { computeDC, buildMechanicalEncounter } from '../game/encounter-builder';
import { buildFallbackIntro, buildFallbackOutcome } from '../game/narrative-fallback';
import { buildNarrativePrompt, buildEncounterIntroPrompt } from '../game/narrative-prompt-builder';
import { resolveCharacterIdentity } from '../rpg/class-display';
import { __geminiTest } from '../render/gemini-client';
import { createEmptyInventoryState } from '../rpg/types';
import type {
  ChallengeScene,
  CharacterProfile,
  ChoiceOption,
  MechanicalEncounter,
  StatBlock,
  TransitPressure,
} from '../rpg/types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`✓ ${msg}`);
}

function makeStats(partial: Partial<StatBlock>): StatBlock {
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
    statTrace: {
      raw: stats,
      final: stats,
      perPlanet: {},
      aspectBonuses: [],
    },
  };
}

function makePressure(overrides: Partial<TransitPressure> = {}): TransitPressure {
  return {
    id: 'p1',
    transitBody: 'Mars',
    natalBody: 'Sun',
    natalHouse: 7,
    aspectType: 'square',
    domain: 'partnership',
    pressureFamily: 'conflict',
    type: 'conflict',
    intensity: 0.7,
    intensityBand: 'moderate',
    lifeArea: 'relationships',
    likelyShadowPattern: 'phase1_shadow:frictional',
    growthPath: 'phase1_growth:not_at_event_layer',
    contributingDomains: [],
    ...overrides,
  };
}

function makeChoice(id: string, direction: ChoiceOption['outcomeDirection']): ChoiceOption {
  return {
    id,
    label: 'Test choice',
    symbolicGesture: 'A test gesture',
    patternTag: id,
    posture: 'assert',
    modality: 'direct',
    riskProfile: 'risk',
    outcomeDirection: direction,
  };
}

function makeScene(): ChallengeScene {
  const primary = makePressure();
  return {
    id: 'scene:test',
    theme: 'A test theme about partnership.',
    setting: 'a relational setting',
    obstacle: { name: 'The Obstacle', type: 'hazard', brief: 'The obstacle presses.' },
    primaryPressure: primary,
    supportingPressures: [],
    choices: [
      makeChoice('name_truth', 'assert_define'),
      makeChoice('push_forward', 'engage_advance'),
    ],
  };
}

function testHpSystem(): void {
  const nick = makeStats({ vitality: 6, resilience: 18 });
  assert(deriveMaxHp(nick) === 74, 'Nickster max HP = 74');

  const red = resilienceDamageReduction(18);
  assert(red === 4, 'Resilience 18 reduces by 4');
  const incoming = 10;
  const actual = Math.max(1, incoming - red);
  assert(actual === 6, '10 damage with R18 → 6');

  let hp = createFullHp(nick);
  const kill = applyDamageToHp({
    hp,
    damage: 74,
    resilience: 18,
    calendarDate: '2026-07-20',
    streak: 0,
    flags: [],
  });
  assert(kill.woundedTriggered, 'lethal damage triggers wounded');
  assert(kill.hp.wounded, 'hp.wounded true');
  assert(kill.hp.woundedDaysRemaining === woundedRecoveryDays(18), 'recovery days from resilience');

  let whp = kill.hp;
  for (let i = 0; i < kill.hp.woundedDaysRemaining; i++) {
    whp = applyDailyRecovery(whp);
  }
  assert(!whp.wounded, 'wounded clears after recovery days');
  assert(whp.current === Math.floor(whp.max * 0.5), 'recover to half max');

  hp = createFullHp(nick);
  hp = { ...hp, current: hp.max - 10 };
  const healed = applyDailyRecovery(hp);
  assert(healed.current === hp.max - 5, 'passive +5 heal');

  const save = applyDamageToHp({
    hp: createFullHp(nick),
    damage: 200,
    resilience: 18,
    calendarDate: '2026-07-20',
    streak: 7,
    flags: [],
  });
  assert(save.streakSaved && save.hp.current === 1, 'streak save → HP 1');
  assert(save.flags.includes('near_death_save'), 'near_death_save flag');

  const save2 = applyDamageToHp({
    hp: save.hp,
    damage: 200,
    resilience: 18,
    calendarDate: '2026-07-20',
    streak: 7,
    flags: save.flags,
  });
  assert(save2.woundedTriggered && !save2.streakSaved, 'second lethal wounds when flag set');

  assert(applyWoundedStatPenalty(16, true) === 12, 'wounded 25% of 16 → 12');
  assert(statModifier(18) === 4 && statModifier(10) === 0 && statModifier(4) === -3, 'stat modifiers');
}

function testDieDeterminism(): void {
  const seed = 'fp:choice:2026-07-20';
  const first = rollDie(seed);
  for (let i = 0; i < 100; i++) {
    if (rollDie(seed) !== first) throw new Error(`FAIL: die nondeterministic at ${i}`);
  }
  assert(true, 'die roll identical across 100 runs');
  assert(rollDie(seed + ':x') !== first || hash32(seed + ':x') !== hash32(seed), 'different seed differs');
  for (let i = 0; i < 50; i++) {
    const r = rollDie(`seed_${i}`);
    assert(r >= 1 && r <= 20, `roll in 1-20 (${r})`);
  }
}

function testCombatOutcomes(): void {
  const scene = makeScene();
  const profile = makeProfile(makeStats({ vitality: 14, resilience: 12, cunning: 12 }));
  const encounter: MechanicalEncounter = {
    scene,
    dc: 11,
    baseDamage: baseDamageForTransitBody('Mars'),
    transitBodyCategory: 'mars',
    saturnHouse: 7,
    lootTableKey: 'saturn_house_7',
    choiceStatMap: { name_truth: 'vitality', push_forward: 'cunning' },
    intensityBand: 'moderate',
  };
  assert(encounter.baseDamage === 8, 'Mars base damage 8');

  const inv = createEmptyInventoryState();
  const success = resolveCombat({
    encounter,
    choiceId: 'name_truth',
    characterProfile: profile,
    equipmentBonuses: {},
    hp: createFullHp(profile.statBlock),
    inventoryState: inv,
    calendarDate: '2026-07-20',
    streak: 1,
    flags: [],
    challengeFingerprint: 'fp_test',
    rawRollOverride: 12,
  });
  assert(success.outcome === 'success', `roll 12+2 vs 11 → success (got ${success.outcome})`);
  assert(success.damageDealt === 0, 'success deals 0 damage');

  const partial = resolveCombat({
    encounter,
    choiceId: 'name_truth',
    characterProfile: profile,
    equipmentBonuses: {},
    hp: createFullHp(profile.statBlock),
    inventoryState: inv,
    calendarDate: '2026-07-20',
    streak: 1,
    flags: [],
    challengeFingerprint: 'fp_test',
    rawRollOverride: 8,
  });
  assert(partial.outcome === 'partial', `roll 8+2 vs 11 → partial (got ${partial.outcome})`);
  assert(partial.damageDealt > 0, 'partial deals damage');

  const critFail = resolveCombat({
    encounter,
    choiceId: 'name_truth',
    characterProfile: makeProfile(makeStats({ vitality: 10, resilience: 12, cunning: 12 })),
    equipmentBonuses: {},
    hp: createFullHp(makeStats({ vitality: 10, resilience: 12 })),
    inventoryState: inv,
    calendarDate: '2026-07-20',
    streak: 1,
    flags: [],
    challengeFingerprint: 'fp_test',
    rawRollOverride: 1,
  });
  assert(critFail.outcome === 'critical_failure', `roll 1+0 vs 11 → crit fail (got ${critFail.outcome})`);

  const crit = resolveCombat({
    encounter,
    choiceId: 'name_truth',
    characterProfile: profile,
    equipmentBonuses: {},
    hp: createFullHp(profile.statBlock),
    inventoryState: inv,
    calendarDate: '2026-07-20',
    streak: 1,
    flags: [],
    challengeFingerprint: 'fp_test',
    rawRollOverride: 20,
  });
  assert(crit.outcome === 'critical_success', `roll 20+2 vs 11 → crit success (got ${crit.outcome})`);
  assert(crit.healAmount === 3, 'crit success heals 3');
}

function testWoundedModifiers(): void {
  const profile = makeProfile(makeStats({ vitality: 16, resilience: 16, cunning: 16 }));
  const hp = { ...createFullHp(profile.statBlock), wounded: true, woundedDaysRemaining: 2, woundedUntil: '2026-07-22' };
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
  const result = resolveCombat({
    encounter,
    choiceId: 'name_truth',
    characterProfile: profile,
    equipmentBonuses: {},
    hp,
    inventoryState: createEmptyInventoryState(),
    calendarDate: '2026-07-20',
    streak: 1,
    flags: [],
    challengeFingerprint: 'fp_wound',
    rawRollOverride: 20,
  });
  assert(result.outcome === 'success', 'wounded converts crit success → success');
  assert(applyWoundedStatPenalty(16, true) === 12, 'stat penalty 25%');
}

function testGeminiClientContract(): void {
  const url = __geminiTest.buildUrl('my-project', 'us-central1');
  assert(
    url.includes('us-central1-aiplatform.googleapis.com') &&
      url.includes('my-project') &&
      url.includes('gemini-2.5-flash'),
    'Gemini URL construction'
  );
  assert(__geminiTest.TIMEOUT_MS === 10000, 'timeout 10s');
  assert(__geminiTest.MAX_ATTEMPTS === 3, 'max 3 attempts (1 + 2 retries)');
  assert(__geminiTest.GEMINI_MODEL === 'gemini-2.5-flash', 'model gemini-2.5-flash');
}

function testNarrativeFallback(): void {
  const scene = makeScene();
  const encounter: MechanicalEncounter = {
    scene,
    dc: 11,
    baseDamage: 8,
    transitBodyCategory: 'mars',
    saturnHouse: 7,
    lootTableKey: 'saturn_house_7',
    choiceStatMap: {},
    intensityBand: 'moderate',
  };
  const intro = buildFallbackIntro(encounter, { thematicLabel: 'The Relational Dungeon', domain: 'relationships' });
  assert(intro.length > 20, 'fallback intro non-empty');

  const identity = resolveCharacterIdentity(
    'class_libra',
    'subclass_libra',
    'rising_leo',
    makeStats({})
  );
  const introId = buildFallbackIntro(
    encounter,
    { thematicLabel: 'The Relational Dungeon', domain: 'relationships' },
    identity
  );
  assert(introId.includes('Mirrorblade'), 'fallback intro uses fantasy class name');

  const choice = scene.choices[0]!;
  const outcomes = ['critical_success', 'success', 'partial', 'failure', 'critical_failure'] as const;
  const texts = new Set<string>();
  for (const o of outcomes) {
    const combat = {
      dieRoll: { raw: 10, modifier: 0, total: 10, outcome: o },
      outcome: o,
      damageDealt: 0,
      hpAfter: 50,
      healAmount: 0,
      woundedTriggered: false,
      streakSaved: false,
      lootResult: { dropped: false, item: null, rollTrace: { seed: '', dropChance: 0, rarityRoll: 0, selectedRarity: null, tableFiltered: 0 } },
      itemLost: null,
      itemLostInstanceId: null,
      xpGained: 0,
    };
    const t = buildFallbackOutcome(encounter, choice, combat, identity, {
      name: 'Vitality',
      value: 12,
      modifier: 1,
      isStrength: true,
      isWeakness: false,
    });
    assert(t.length > 10, `fallback outcome for ${o}`);
    texts.add(t);
  }
  assert(texts.size === 5, 'distinct fallback text per outcome');

  const prompt = buildNarrativePrompt({
    characterClass: 'class_libra',
    characterSubclass: 'subclass_libra',
    characterRising: 'rising_leo',
    characterIdentity: identity,
    primaryStatUsed: {
      name: 'Vitality',
      value: 12,
      modifier: 2,
      isStrength: true,
      isWeakness: false,
    },
    statBlock: makeStats({}),
    hp: createFullHp(makeStats({})),
    equippedItems: [],
    encounter,
    chosenOption: choice,
    combatResult: {
      dieRoll: { raw: 12, modifier: 2, total: 14, outcome: 'success' },
      outcome: 'success',
      damageDealt: 0,
      hpAfter: 70,
      healAmount: 0,
      woundedTriggered: false,
      streakSaved: false,
      lootResult: {
        dropped: false,
        item: null,
        rollTrace: {
          seed: '',
          dropChance: 0,
          rarityRoll: 0,
          selectedRarity: null,
          tableFiltered: 0,
        },
      },
      itemLost: null,
      itemLostInstanceId: null,
      xpGained: 0,
    },
    activeChapter: { house: 7, domain: 'relationships', label: 'The Relational Dungeon' },
    campaignChapter: 1,
    recentHistory: [],
  });
  assert(prompt.includes('Dungeon Master') && prompt.includes('THE CHOICE'), 'outcome prompt structured');
  assert(
    prompt.includes('Mirrorblade') && prompt.includes('CHARACTER:') && prompt.includes('INHABITANTS:'),
    'outcome prompt has identity + inhabitants'
  );
  assert(prompt.includes('nothing equipped'), 'outcome prompt formats empty gear');

  const introPrompt = buildEncounterIntroPrompt({
    characterClass: 'class_libra',
    characterSubclass: 'subclass_libra',
    characterRising: 'rising_leo',
    characterIdentity: identity,
    statBlock: makeStats({}),
    hp: createFullHp(makeStats({})),
    equippedItems: [
      {
        name: 'Network Mail',
        category: 'armor',
        brief: 'Stub armor for house 11.',
        statBonuses: '+1 charm',
      },
    ],
    encounter,
    activeChapter: { house: 7, domain: 'relationships', label: 'The Relational Dungeon' },
    campaignChapter: 1,
    recentHistory: [],
  });
  assert(introPrompt.includes('TODAY\'S ENCOUNTER'), 'intro prompt structured');
  assert(
    introPrompt.includes('Mirrorblade') && introPrompt.includes('Weave Mirrorblade identity'),
    'intro prompt personalizes identity'
  );
  assert(introPrompt.includes('INHABITANTS:'), 'intro prompt includes inhabitants');
  assert(
    introPrompt.includes('Network Mail [armor] (+1 charm)'),
    'intro prompt formats equipped gear with category and bonuses'
  );
  assert(
    !introPrompt.includes('Stub armor for house 11'),
    'intro equipped line does not dump system description'
  );
}

function testEncounterBuilder(): void {
  const scene = makeScene();
  const profile = makeProfile(makeStats({}));
  const natalCusps: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ] = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const transit = {
    ts: '2026-07-20T12:00:00Z',
    tz: 'UTC',
    lat: 0,
    lon: 0,
    houseSystem: 'placidus' as const,
    planets: [
      { name: 'Saturn', lon: 195 },
      { name: 'Mars', lon: 100 },
    ],
    houses: natalCusps,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
  const mech = buildMechanicalEncounter(scene, profile, transit, natalCusps, 1, {
    calendarDate: '2026-07-20',
    campaignId: 'test-campaign',
    intensityScore: scene.primaryPressure.intensity,
  });
  assert(
    mech.dc ===
      computeDC(scene.primaryPressure.intensity, 1, '2026-07-20', 'test-campaign'),
    'DC matches intensity'
  );
  // Mars at lon 100 with even cusps → house 4; field name saturnHouse is Mars-valued
  assert(mech.saturnHouse === 4, 'Mars-derived chapter house 4');
  assert(mech.lootTableKey === 'saturn_house_4', 'loot key scheme unchanged');
  assert(mech.choiceStatMap.name_truth === 'vitality', 'assert → vitality');
  assert(primaryStatForChoice(scene.choices[1]!) === 'cunning', 'engage → cunning');
}

function main(): void {
  console.log('\n=== Phase 3 Combat Validation ===\n');
  console.log('--- Test 1: HP System ---');
  testHpSystem();
  console.log('\n--- Test 2: Die Roll Determinism ---');
  testDieDeterminism();
  console.log('\n--- Test 3: Combat Resolution ---');
  testCombatOutcomes();
  console.log('\n--- Test 4: Wounded Modifiers ---');
  testWoundedModifiers();
  console.log('\n--- Test 5: Gemini Client Contract ---');
  testGeminiClientContract();
  console.log('\n--- Test 6: Narrative Fallback ---');
  testNarrativeFallback();
  console.log('\n--- Test 7: Encounter Builder ---');
  testEncounterBuilder();
  console.log('\n=== All combat validation tests passed ===\n');
}

main();
