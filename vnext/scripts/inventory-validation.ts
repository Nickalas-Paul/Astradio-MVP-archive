/**
 * Phase 2 — Inventory system validation.
 * Run: npm run rpg:inventory:test
 */

import fs from 'fs';
import path from 'path';
import type { EphemerisSnapshot } from '../contracts';
import { loadRpgV1Maps } from '../rpg/maps/load-v1';
import { getSaturnTransitHouse, getMarsTransitHouse, getCampaignChapter } from '../rpg/saturn-house';
import {
  addItem,
  canAddItem,
  computeEquipmentStatBonuses,
  equipItem,
  getBagUtilization,
  removeItem,
  unequipSlot,
  useConsumable,
} from '../rpg/inventory-manager';
import {
  buildItemDefinitionMap,
  buildLootTableMap,
  computeDropChance,
  rollLoot,
} from '../rpg/loot-roller';
import { createEmptyInventoryState } from '../rpg/types';
import type { ItemDefinition } from '../rpg/types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  // eslint-disable-next-line no-console
  console.log(`✓ ${msg}`);
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

function testSaturnHouse(): void {
  // Equal houses: cusp[i] = i*30. Saturn at 195° → house 7 (180–210).
  const natalCusps = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const house = getSaturnTransitHouse(makeTransit(195), natalCusps);
  assert(house === 7, `Saturn at 195° maps to house 7 (got ${house})`);

  const marsHouse = getMarsTransitHouse(makeTransit(195, 100), natalCusps);
  assert(marsHouse === 4, `Mars at 100° maps to house 4 (got ${marsHouse})`);
  assert(
    getCampaignChapter(marsHouse).lootTableKey === 'saturn_house_4',
    'Mars house still uses saturn_house_N loot key'
  );

  const chapter = getCampaignChapter(house);
  assert(chapter.domain === 'relationships', `chapter domain relationships (got ${chapter.domain})`);
  assert(
    chapter.thematicLabel === 'The Relational Dungeon',
    `chapter label Relational Dungeon (got ${chapter.thematicLabel})`
  );
  assert(chapter.lootTableKey === 'saturn_house_7', `loot table key saturn_house_7`);

  // House 1: Saturn at 10°
  const h1 = getSaturnTransitHouse(makeTransit(10), natalCusps);
  assert(h1 === 1, `Saturn at 10° maps to house 1 (got ${h1})`);
  assert(getCampaignChapter(1).thematicLabel === 'The Identity Forge', 'house 1 Identity Forge');

  // House 10: Saturn at 275°
  const h10 = getSaturnTransitHouse(makeTransit(275), natalCusps);
  assert(h10 === 10, `Saturn at 275° maps to house 10 (got ${h10})`);
  assert(getCampaignChapter(10).thematicLabel === 'The Summit Tribunal', 'house 10 Summit Tribunal');
}

function testInventoryOps(defs: Map<string, ItemDefinition>): void {
  let state = createEmptyInventoryState();
  const weapon = defs.get('mirror_blade')!;
  const armor = defs.get('compromise_mail')!;
  const consumable = defs.get('venus_trine_elixir')!;
  assert(!!weapon && !!armor && !!consumable, 'fixture items exist');

  const a = addItem(state, weapon, 'test', 'grant_w1');
  state = a.state;
  const b = addItem(state, armor, 'test', 'grant_a1');
  state = b.state;
  const c = addItem(state, consumable, 'test', 'grant_c1');
  state = c.state;
  assert(state.items.length === 3, 'added 3 items');

  state = equipItem(state, a.instance.instanceId, defs);
  assert(state.equipped.weapon === a.instance.instanceId, 'weapon slot populated');
  assert(
    state.items.some((i) => i.instanceId === a.instance.instanceId),
    'equipped weapon still in bag'
  );

  const weapon2 = defs.get('diplomats_edge')!;
  const d = addItem(state, weapon2, 'test', 'grant_w2');
  state = d.state;
  state = equipItem(state, d.instance.instanceId, defs);
  assert(state.equipped.weapon === d.instance.instanceId, 'new weapon equipped');
  assert(
    state.items.some((i) => i.instanceId === a.instance.instanceId),
    'old weapon still in bag after auto-unequip'
  );

  state = equipItem(state, c.instance.instanceId, defs);
  assert(state.equipped.consumable_1 === c.instance.instanceId, 'consumable equipped');

  // Stack another of same consumable then use once
  const stacked = addItem(state, consumable, 'test', 'grant_c_stack');
  state = stacked.state;
  const stackInst = state.items.find((i) => i.slug === consumable.slug)!;
  assert(stackInst.quantity === 2, `consumable stacked to 2 (got ${stackInst.quantity})`);

  const used = useConsumable(state, stackInst.instanceId, defs);
  state = used.state;
  assert(used.effect.type === 'heal', 'consumable effect heal');
  assert(used.effect.magnitude === 3, 'heal magnitude 3');
  const after = state.items.find((i) => i.instanceId === stackInst.instanceId)!;
  assert(after.quantity === 1, 'quantity decremented to 1');

  const usedLast = useConsumable(state, stackInst.instanceId, defs);
  state = usedLast.state;
  assert(
    !state.items.some((i) => i.instanceId === stackInst.instanceId),
    'last consumable removed from bag'
  );
  assert(state.equipped.consumable_1 === null, 'consumable slot cleared');

  // Fill bag to capacity
  state = createEmptyInventoryState();
  state.maxBagSize = 3;
  state = addItem(state, weapon, 't', 'g1').state;
  state = addItem(state, armor, 't', 'g2').state;
  state = addItem(state, defs.get('spark_blade')!, 't', 'g3').state;
  assert(!canAddItem(state), 'canAddItem false at limit');
  assert(getBagUtilization(state).used === 3, 'bag utilization 3');

  state = equipItem(state, state.items[0].instanceId, defs);
  state = removeItem(state, state.items[0].instanceId);
  assert(state.items.length === 2, 'item removed');
  assert(state.equipped.weapon === null, 'equipped slot cleared on remove');

  state = unequipSlot(
    (() => {
      const s = createEmptyInventoryState();
      const x = addItem(s, weapon, 't', 'ux');
      return equipItem(x.state, x.instance.instanceId, defs);
    })(),
    'weapon'
  );
  assert(state.equipped.weapon === null, 'unequip clears slot');
}

function testLootDeterminism(
  tables: ReturnType<typeof buildLootTableMap>,
  defs: Map<string, ItemDefinition>
): void {
  const input = {
    saturnHouse: 7,
    challengeFingerprint: 'fp_abc_deterministic',
    choiceId: 'choice_assert_1',
    playerCunning: 12,
    campaignChapter: 2,
    boldChoice: true,
  };

  const first = rollLoot(input, tables, defs);
  const firstJson = JSON.stringify(first);
  for (let i = 0; i < 100; i++) {
    if (JSON.stringify(rollLoot(input, tables, defs)) !== firstJson) {
      throw new Error(`FAIL: loot determinism broke on run ${i + 1}`);
    }
  }
  assert(true, 'loot roll identical across 100 runs');

  const other = rollLoot({ ...input, challengeFingerprint: 'fp_different' }, tables, defs);
  assert(
    JSON.stringify(other) !== JSON.stringify(first),
    'different fingerprint yields different roll'
  );

  const chanceLow = computeDropChance(5, false);
  const chanceHigh = computeDropChance(15, false);
  assert(chanceHigh > chanceLow, `cunning raises drop chance (${chanceLow} < ${chanceHigh})`);

  const low = rollLoot({ ...input, playerCunning: 5, boldChoice: false }, tables, defs);
  const high = rollLoot({ ...input, playerCunning: 15, boldChoice: false }, tables, defs);
  assert(
    low.rollTrace.dropChance < high.rollTrace.dropChance,
    'rollTrace dropChance reflects cunning'
  );
  // High cunning shifts rarity weights — selectedRarity may or may not differ for same seed path;
  // at least dropChance and weights path exercised.
  void low;
  void high;
}

function testStatBonuses(defs: Map<string, ItemDefinition>): void {
  let state = createEmptyInventoryState();
  state = { ...state, slotsUnlocked: ['weapon', 'armor', 'accessory', 'consumable', 'relic'] };

  const bond = addItem(state, defs.get('bond_blade')!, 't', 'sb1');
  state = bond.state;
  const plate = addItem(state, defs.get('harmonics_plate')!, 't', 'sb2');
  state = plate.state;
  state = equipItem(state, bond.instance.instanceId, defs);
  state = equipItem(state, plate.instance.instanceId, defs);

  const base = computeEquipmentStatBonuses(state, defs);
  assert(base.vitality === 2, `vitality 2 without affinity (got ${base.vitality})`);
  assert(base.charm === 1, `charm 1 (got ${base.charm})`);
  assert(base.resilience === 2, `resilience 2 (got ${base.resilience})`);
  assert(base.intuition === 1, `intuition 1 (got ${base.intuition})`);

  const withAffinity = computeEquipmentStatBonuses(state, defs, 'class_libra');
  // bond_blade highest mod is vitality:2 → +1 affinity → 3
  assert(withAffinity.vitality === 3, `class affinity vitality 3 (got ${withAffinity.vitality})`);
  assert(withAffinity.charm === 1, 'affinity does not change lower mods');

  const noMatch = computeEquipmentStatBonuses(state, defs, 'class_aries');
  assert(noMatch.vitality === 2, 'non-matching class no affinity bonus');
}

function testLootTableIntegrity(maps: ReturnType<typeof loadRpgV1Maps>): void {
  const slugs = new Set(maps.itemDefinitions.map((d) => d.slug));
  assert(slugs.size === maps.itemDefinitions.length, 'no duplicate item slugs');

  for (let h = 1; h <= 12; h++) {
    const table = maps.lootTables.find((t) => t.saturnHouse === h);
    assert(!!table, `loot table for house ${h}`);
    assert(table!.items.length >= 4, `house ${h} has >= 4 loot entries`);
    for (const e of table!.items) {
      assert(slugs.has(e.slug), `loot slug ${e.slug} in definitions`);
    }
  }

  for (const h of [1, 7, 10]) {
    const table = maps.lootTables.find((t) => t.saturnHouse === h)!;
    assert(
      table.items.length >= 12 && table.items.length <= 16,
      `full house ${h} has 12-16 items (got ${table.items.length})`
    );
  }
}

function testMigrationIdempotencyContract(): void {
  const migrationPath = path.join(
    process.cwd(),
    'migrations',
    '040_game_inventory.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert(sql.includes('grant_seed TEXT UNIQUE'), 'migration has UNIQUE grant_seed');
  assert(
    sql.includes('REFERENCES stage5_campaigns(campaign_id) ON DELETE CASCADE'),
    'migration cascades from stage5_campaigns'
  );
  assert(sql.includes('rpg_campaign_items'), 'migration creates rpg_campaign_items');
  assert(sql.includes('rpg_campaign_equipment'), 'migration creates rpg_campaign_equipment');

  // Live DB test is optional — Phase 2 validates schema contract when POSTGRES_URL absent.
  if (!process.env.POSTGRES_URL) {
    assert(true, 'DB live idempotency skipped (no POSTGRES_URL); schema contract OK');
  }
}

function main(): void {
  // eslint-disable-next-line no-console
  console.log('\n=== Phase 2 Inventory Validation ===\n');

  const maps = loadRpgV1Maps();
  const defs = buildItemDefinitionMap(maps.itemDefinitions);
  const tables = buildLootTableMap(maps.lootTables);

  // eslint-disable-next-line no-console
  console.log('--- Test 1: Saturn House Detection ---');
  testSaturnHouse();

  // eslint-disable-next-line no-console
  console.log('\n--- Test 2: Inventory Operations ---');
  testInventoryOps(defs);

  // eslint-disable-next-line no-console
  console.log('\n--- Test 3: Loot Roll Determinism ---');
  testLootDeterminism(tables, defs);

  // eslint-disable-next-line no-console
  console.log('\n--- Test 4: Equipment Stat Bonuses ---');
  testStatBonuses(defs);

  // eslint-disable-next-line no-console
  console.log('\n--- Test 5: Loot Table Integrity ---');
  testLootTableIntegrity(maps);

  // eslint-disable-next-line no-console
  console.log('\n--- Test 6: Database Idempotency Contract ---');
  testMigrationIdempotencyContract();

  // eslint-disable-next-line no-console
  console.log('\n=== All inventory validation tests passed ===\n');
}

main();
