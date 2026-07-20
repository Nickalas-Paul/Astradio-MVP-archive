#!/usr/bin/env node
/**
 * One-shot generator for item_definitions.json + loot_tables.json.
 * Run: node scripts/generate-inventory-maps.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'vnext', 'rpg', 'maps', 'v1');

function item(o) {
  const out = {
    slug: o.slug,
    name: o.name,
    description: o.description,
    category: o.category,
    rarity: o.rarity,
    statModifiers: o.statModifiers || {},
    saturnHouse: o.saturnHouse,
    tags: o.tags || [],
  };
  if (o.elementAffinity) out.elementAffinity = o.elementAffinity;
  if (o.classAffinity) out.classAffinity = o.classAffinity;
  if (o.consumableEffect) out.consumableEffect = o.consumableEffect;
  return out;
}

const defs = [];

// ---- House 1 Identity Forge (full) ----
defs.push(
  item({ slug: 'spark_blade', name: 'Spark Blade', description: 'First cut of self.', category: 'weapon', rarity: 'common', statModifiers: { vitality: 1 }, saturnHouse: 1, elementAffinity: 'fire', tags: ['identity', 'weapon'] }),
  item({ slug: 'will_edge', name: 'Will Edge', description: 'Sharpened by resolve.', category: 'weapon', rarity: 'uncommon', statModifiers: { vitality: 2 }, saturnHouse: 1, tags: ['identity', 'weapon'] }),
  item({ slug: 'sol_brand', name: 'Sol Brand', description: 'Carries the mark of becoming.', category: 'weapon', rarity: 'rare', statModifiers: { vitality: 2, willpower: 1 }, saturnHouse: 1, classAffinity: 'class_aries', tags: ['identity', 'weapon'] }),
  item({ slug: 'ascendant_fang', name: 'Ascendant Fang', description: 'Born at the rising edge.', category: 'weapon', rarity: 'legendary', statModifiers: { vitality: 3, willpower: 1 }, saturnHouse: 1, tags: ['identity', 'weapon'] }),
  item({ slug: 'self_mail', name: 'Self Mail', description: 'Fits only you.', category: 'armor', rarity: 'common', statModifiers: { resilience: 1 }, saturnHouse: 1, tags: ['identity', 'armor'] }),
  item({ slug: 'forge_plate', name: 'Forge Plate', description: 'Tempered in the first house.', category: 'armor', rarity: 'uncommon', statModifiers: { resilience: 2 }, saturnHouse: 1, tags: ['identity', 'armor'] }),
  item({ slug: 'identity_aegis', name: 'Identity Aegis', description: 'Holds the line of who you are.', category: 'armor', rarity: 'rare', statModifiers: { resilience: 2, vitality: 1 }, saturnHouse: 1, tags: ['identity', 'armor'] }),
  item({ slug: 'corona_ward', name: 'Corona Ward', description: 'Radiant and unyielding.', category: 'armor', rarity: 'legendary', statModifiers: { resilience: 4 }, saturnHouse: 1, tags: ['identity', 'armor'] }),
  item({ slug: 'courage_band', name: 'Courage Band', description: 'A reminder to begin.', category: 'accessory', rarity: 'uncommon', statModifiers: { vitality: 1, willpower: 1 }, saturnHouse: 1, tags: ['identity', 'accessory'] }),
  item({ slug: 'rising_seal', name: 'Rising Seal', description: 'Marks the eastern gate.', category: 'accessory', rarity: 'rare', statModifiers: { vitality: 2, charm: 1 }, saturnHouse: 1, tags: ['identity', 'accessory'] }),
  item({ slug: 'ember_tonic', name: 'Ember Tonic', description: 'Warmth returns to the limbs.', category: 'consumable', rarity: 'common', saturnHouse: 1, consumableEffect: { type: 'heal', magnitude: 3 }, tags: ['identity', 'consumable'] }),
  item({ slug: 'assert_draught', name: 'Assert Draught', description: 'Steady the first step.', category: 'consumable', rarity: 'uncommon', saturnHouse: 1, consumableEffect: { type: 'buff', stat: 'vitality', magnitude: 2, duration: 1 }, tags: ['identity', 'consumable'] }),
  item({ slug: 'mask_breaker', name: 'Mask Breaker', description: 'See yourself without varnish.', category: 'consumable', rarity: 'rare', saturnHouse: 1, consumableEffect: { type: 'reveal', magnitude: 1 }, tags: ['identity', 'consumable'] }),
  item({ slug: 'aries_ember', name: "Aries' Ember", description: 'The first fire, kept.', category: 'relic', rarity: 'legendary', statModifiers: { vitality: 2, willpower: 2 }, saturnHouse: 1, classAffinity: 'class_aries', tags: ['identity', 'relic', 'milestone'] })
);

// ---- House 7 Relational Dungeon (full) ----
defs.push(
  item({ slug: 'mirror_blade', name: 'Mirror Blade', description: 'A sword that cuts both ways.', category: 'weapon', rarity: 'common', statModifiers: { vitality: 1 }, saturnHouse: 7, tags: ['relationship', 'weapon'] }),
  item({ slug: 'diplomats_edge', name: "Diplomat's Edge", description: 'Sharpened by negotiation.', category: 'weapon', rarity: 'uncommon', statModifiers: { charm: 2 }, saturnHouse: 7, tags: ['relationship', 'weapon'] }),
  item({ slug: 'bond_blade', name: 'Bond Blade', description: 'Stronger when two stand together.', category: 'weapon', rarity: 'rare', statModifiers: { vitality: 2, charm: 1 }, saturnHouse: 7, classAffinity: 'class_libra', tags: ['relationship', 'weapon'] }),
  item({ slug: 'eclipse_saber', name: 'Eclipse Saber', description: 'Forged where self meets other.', category: 'weapon', rarity: 'legendary', statModifiers: { vitality: 3, willpower: 1 }, saturnHouse: 7, tags: ['relationship', 'weapon'] }),
  item({ slug: 'compromise_mail', name: 'Compromise Mail', description: 'Flexible where it matters.', category: 'armor', rarity: 'common', statModifiers: { resilience: 1 }, saturnHouse: 7, tags: ['relationship', 'armor'] }),
  item({ slug: 'reflection_guard', name: 'Reflection Guard', description: 'Shows attackers their own force.', category: 'armor', rarity: 'uncommon', statModifiers: { resilience: 2 }, saturnHouse: 7, tags: ['relationship', 'armor'] }),
  item({ slug: 'harmonics_plate', name: 'Harmonics Plate', description: 'Resonates with incoming energy.', category: 'armor', rarity: 'rare', statModifiers: { resilience: 2, intuition: 1 }, saturnHouse: 7, tags: ['relationship', 'armor'] }),
  item({ slug: 'covenant_ward', name: 'Covenant Ward', description: 'Unbreakable as a kept promise.', category: 'armor', rarity: 'legendary', statModifiers: { resilience: 4 }, saturnHouse: 7, tags: ['relationship', 'armor'] }),
  item({ slug: 'mediators_ring', name: "Mediator's Ring", description: 'Find the middle ground.', category: 'accessory', rarity: 'uncommon', statModifiers: { charm: 1, cunning: 1 }, saturnHouse: 7, tags: ['relationship', 'accessory'] }),
  item({ slug: 'partnership_amulet', name: 'Partnership Amulet', description: 'Power drawn from connection.', category: 'accessory', rarity: 'rare', statModifiers: { charm: 2, intuition: 1 }, saturnHouse: 7, tags: ['relationship', 'accessory'] }),
  item({ slug: 'venus_trine_elixir', name: 'Venus Trine Elixir', description: 'Sweetness distilled.', category: 'consumable', rarity: 'common', saturnHouse: 7, consumableEffect: { type: 'heal', magnitude: 3 }, tags: ['relationship', 'consumable'] }),
  item({ slug: 'balance_potion', name: 'Balance Potion', description: 'Steadies the scales.', category: 'consumable', rarity: 'uncommon', saturnHouse: 7, consumableEffect: { type: 'buff', stat: 'resilience', magnitude: 2, duration: 1 }, tags: ['relationship', 'consumable'] }),
  item({ slug: 'mirror_shield_draught', name: 'Mirror Shield Draught', description: 'Reflect what comes.', category: 'consumable', rarity: 'rare', saturnHouse: 7, consumableEffect: { type: 'shield', magnitude: 50 }, tags: ['relationship', 'consumable'] }),
  item({ slug: 'libras_scale', name: "Libra's Scale", description: 'The weight of every choice, measured.', category: 'relic', rarity: 'legendary', statModifiers: { charm: 2, willpower: 2 }, saturnHouse: 7, classAffinity: 'class_libra', tags: ['relationship', 'relic', 'milestone'] })
);

// ---- House 10 Summit Tribunal (full) ----
defs.push(
  item({ slug: 'edict_blade', name: 'Edict Blade', description: 'Cuts with authority.', category: 'weapon', rarity: 'common', statModifiers: { willpower: 1 }, saturnHouse: 10, tags: ['career', 'weapon'] }),
  item({ slug: 'summit_spear', name: 'Summit Spear', description: 'Points toward the peak.', category: 'weapon', rarity: 'uncommon', statModifiers: { willpower: 2 }, saturnHouse: 10, tags: ['career', 'weapon'] }),
  item({ slug: 'tribunal_glaive', name: 'Tribunal Glaive', description: 'Judgment made sharp.', category: 'weapon', rarity: 'rare', statModifiers: { willpower: 2, vitality: 1 }, saturnHouse: 10, classAffinity: 'class_capricorn', tags: ['career', 'weapon'] }),
  item({ slug: 'legacy_scythe', name: 'Legacy Scythe', description: 'Harvests what you built.', category: 'weapon', rarity: 'legendary', statModifiers: { willpower: 3, charm: 1 }, saturnHouse: 10, tags: ['career', 'weapon'] }),
  item({ slug: 'office_mail', name: 'Office Mail', description: 'Standard issue dignity.', category: 'armor', rarity: 'common', statModifiers: { resilience: 1 }, saturnHouse: 10, tags: ['career', 'armor'] }),
  item({ slug: 'throne_guard', name: 'Throne Guard', description: 'Holds the public face.', category: 'armor', rarity: 'uncommon', statModifiers: { resilience: 2 }, saturnHouse: 10, tags: ['career', 'armor'] }),
  item({ slug: 'mandate_plate', name: 'Mandate Plate', description: 'Authority as protection.', category: 'armor', rarity: 'rare', statModifiers: { resilience: 2, willpower: 1 }, saturnHouse: 10, tags: ['career', 'armor'] }),
  item({ slug: 'summit_aegis', name: 'Summit Aegis', description: 'Unmoved at the height.', category: 'armor', rarity: 'legendary', statModifiers: { resilience: 3, willpower: 1 }, saturnHouse: 10, tags: ['career', 'armor'] }),
  item({ slug: 'seal_of_office', name: 'Seal of Office', description: 'Proof of standing.', category: 'accessory', rarity: 'uncommon', statModifiers: { willpower: 1, charm: 1 }, saturnHouse: 10, tags: ['career', 'accessory'] }),
  item({ slug: 'midheaven_crest', name: 'Midheaven Crest', description: 'Visible from every valley.', category: 'accessory', rarity: 'rare', statModifiers: { willpower: 2, cunning: 1 }, saturnHouse: 10, tags: ['career', 'accessory'] }),
  item({ slug: 'status_tonic', name: 'Status Tonic', description: 'Restore composure under eyes.', category: 'consumable', rarity: 'common', saturnHouse: 10, consumableEffect: { type: 'heal', magnitude: 3 }, tags: ['career', 'consumable'] }),
  item({ slug: 'authority_draught', name: 'Authority Draught', description: 'Hold the room for a day.', category: 'consumable', rarity: 'uncommon', saturnHouse: 10, consumableEffect: { type: 'buff', stat: 'willpower', magnitude: 2, duration: 1 }, tags: ['career', 'consumable'] }),
  item({ slug: 'verdict_shield', name: 'Verdict Shield', description: 'Absorbs one public blow.', category: 'consumable', rarity: 'rare', saturnHouse: 10, consumableEffect: { type: 'shield', magnitude: 50 }, tags: ['career', 'consumable'] }),
  item({ slug: 'capricorns_keystone', name: "Capricorn's Keystone", description: 'The stone that holds the arch.', category: 'relic', rarity: 'legendary', statModifiers: { willpower: 2, resilience: 2 }, saturnHouse: 10, classAffinity: 'class_capricorn', tags: ['career', 'relic', 'milestone'] })
);

// ---- Stub houses ----
const stubs = [
  [2, 'resources', 'vault', 'earth', { vitality: 1 }, { resilience: 1 }, { cunning: 1 }],
  [3, 'communication', 'whisper', 'air', { cunning: 1 }, { resilience: 1 }, { charm: 1 }],
  [4, 'home', 'crypt', 'water', { resilience: 1 }, { resilience: 1 }, { intuition: 1 }],
  [5, 'creativity', 'arena', 'fire', { charm: 1 }, { vitality: 1 }, { intuition: 1 }],
  [6, 'work', 'proving', 'earth', { resilience: 1 }, { resilience: 1 }, { cunning: 1 }],
  [8, 'transformation', 'underworld', 'water', { willpower: 1 }, { resilience: 1 }, { intuition: 1 }],
  [9, 'philosophy', 'pilgrim', 'fire', { intuition: 1 }, { willpower: 1 }, { cunning: 1 }],
  [11, 'community', 'network', 'air', { cunning: 1 }, { charm: 1 }, { willpower: 1 }],
  [12, 'unconscious', 'dream', 'water', { intuition: 1 }, { resilience: 1 }, { willpower: 1 }],
];

for (const [h, domain, prefix, el, wStat, aStat, xStat] of stubs) {
  const title = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  defs.push(
    item({ slug: `${prefix}_blade`, name: `${title} Blade`, description: `Stub weapon for house ${h}.`, category: 'weapon', rarity: 'common', statModifiers: wStat, saturnHouse: h, elementAffinity: el, tags: [domain, 'weapon', 'stub'] }),
    item({ slug: `${prefix}_mail`, name: `${title} Mail`, description: `Stub armor for house ${h}.`, category: 'armor', rarity: 'common', statModifiers: aStat, saturnHouse: h, tags: [domain, 'armor', 'stub'] }),
    item({ slug: `${prefix}_charm`, name: `${title} Charm`, description: `Stub accessory for house ${h}.`, category: 'accessory', rarity: 'uncommon', statModifiers: xStat, saturnHouse: h, tags: [domain, 'accessory', 'stub'] }),
    item({ slug: `${prefix}_tonic`, name: `${title} Tonic`, description: `Stub consumable for house ${h}.`, category: 'consumable', rarity: 'common', saturnHouse: h, consumableEffect: { type: 'heal', magnitude: 2 }, tags: [domain, 'consumable', 'stub'] })
  );
}

const seen = new Set();
for (const d of defs) {
  if (seen.has(d.slug)) throw new Error(`duplicate slug ${d.slug}`);
  seen.add(d.slug);
}

fs.writeFileSync(path.join(OUT, 'item_definitions.json'), JSON.stringify(defs, null, 2) + '\n');

const byHouse = {};
for (const d of defs) {
  if (!byHouse[d.saturnHouse]) byHouse[d.saturnHouse] = [];
  byHouse[d.saturnHouse].push(d);
}

const rarityWeight = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
const domains = {
  1: 'self', 2: 'resources', 3: 'communication', 4: 'home', 5: 'creativity', 6: 'work',
  7: 'relationships', 8: 'transformation', 9: 'philosophy', 10: 'career', 11: 'community', 12: 'unconscious',
};

const tables = [];
for (let h = 1; h <= 12; h++) {
  const items = byHouse[h] || [];
  tables.push({
    saturnHouse: h,
    domain: domains[h],
    items: items
      .filter((d) => d.category !== 'relic')
      .map((d) => ({
        slug: d.slug,
        weight: rarityWeight[d.rarity] || 10,
        minChapter: d.rarity === 'legendary' ? 3 : d.rarity === 'rare' ? 2 : 1,
      })),
  });
}

fs.writeFileSync(path.join(OUT, 'loot_tables.json'), JSON.stringify(tables, null, 2) + '\n');
console.log(`Wrote ${defs.length} items; tables:`, tables.map((t) => `${t.saturnHouse}:${t.items.length}`).join(' '));
