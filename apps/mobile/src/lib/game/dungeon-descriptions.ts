export type DungeonDescription = {
  house: number;
  description: string;
  whatToExpect: string[];
};

/**
 * Static Dungeon Codex copy — second-person, evocative, no astrology jargon.
 * Stat emphasis aligns with house_stat_affinity.json; loot themes match chapter loot tables.
 */
export const DUNGEON_DESCRIPTIONS: Record<number, DungeonDescription> = {
  1: {
    house: 1,
    description:
      'This is where you are shaped. The Forge strips away everything borrowed and tests what remains. Encounters here challenge your sense of self, your body, your appearance, and your right to take up space. What survives the heat is yours to keep.',
    whatToExpect: [
      'Confrontations about presence, courage, and standing your ground when no one else will.',
      'Vitality tends to matter most — raw staying power when the heat turns up.',
      'Forge-forged weapons, identity armor, and tonics that restore nerve and nerve alone.',
      'The emotional terrain is exposure: pride, shame, and the question of who you are without the mask.',
    ],
  },
  2: {
    house: 2,
    description:
      'Everything here has a price, and the Vault wants to know yours. Encounters test your relationship with money, possessions, and what you value enough to fight for. The deeper question is never about the treasure. It is about whether you believe you deserve it.',
    whatToExpect: [
      'Scarcity traps, bargaining stands, and tests of what you will spend or sacrifice.',
      'Resilience carries the day — holding the line when resources run thin.',
      'Vault blades, hoard-guard armor, and charms that turn loss into leverage.',
      'The emotional terrain is worth: greed, security, and the fear of not having enough.',
    ],
  },
  3: {
    house: 3,
    description:
      'Words carry weight here, and silence carries more. Encounters test your communication, your daily routines, your relationship with siblings and neighbors. Every message you send or withhold becomes a move on the board.',
    whatToExpect: [
      'Misread signals, gossip corridors, and puzzles that reward reading the room.',
      'Cunning shines — quick thinking beats brute force in the Hall.',
      'Whisper-blades, message charms, and gear that rewards clever escapes.',
      'The emotional terrain is noise: curiosity, anxiety, and the cost of being misunderstood.',
    ],
  },
  4: {
    house: 4,
    description:
      'The dead have opinions here, and the living carry them. Encounters test your roots, your home, your family legacy, and the private foundations you have built. What you find underground may explain what keeps shifting above.',
    whatToExpect: [
      'Threshold guardians, inherited debts, and choices that pit comfort against truth.',
      'Resilience matters — endurance through grief and the long work of rebuilding.',
      'Heirloom mail, crypt wards, and relics tied to lineage and shelter.',
      'The emotional terrain is belonging: nostalgia, obligation, and the pull of old stories.',
    ],
  },
  5: {
    house: 5,
    description:
      'The spotlight is always on in the Arena. Encounters test your creativity, your capacity for joy, your willingness to be seen and judged for what you make. Romance, children, and art all live under this roof.',
    whatToExpect: [
      'Performances under pressure, risky gambits, and moments that demand charisma.',
      'Charm opens doors — persuasion and presence outweigh raw force.',
      'Stage weapons, expressive armor, and trophies that amplify flair.',
      'The emotional terrain is visibility: delight, embarrassment, and the hunger to be chosen.',
    ],
  },
  6: {
    house: 6,
    description:
      'No glory here, only the work. Encounters test your discipline, your health habits, your daily service, and your willingness to improve without applause. The Grounds reward precision and punish shortcuts.',
    whatToExpect: [
      'Grinding trials, maintenance rituals, and obstacles that punish sloppiness.',
      'Resilience and steady effort — consistency beats flash in the Grounds.',
      'Service blades, duty plate, and practical consumables for the long haul.',
      'The emotional terrain is diligence: fatigue, pride in craft, and resentment of drudgery.',
    ],
  },
  7: {
    house: 7,
    description:
      'You cannot face this one alone, and that is the point. Encounters test your partnerships, your capacity for compromise, your ability to see yourself through another person\'s eyes. The mirror shows what you refuse to.',
    whatToExpect: [
      'Standoffs with allies, mirrored choices, and tests of trust under strain.',
      'Charm and diplomacy — winning without burning the bridge.',
      'Bond-forged gear, pact charms, and items that reward cooperation.',
      'The emotional terrain is intimacy: jealousy, loyalty, and the fear of being truly known.',
    ],
  },
  8: {
    house: 8,
    description:
      'Nothing enters the Gate and leaves unchanged. Encounters test your relationship with loss, shared resources, intimacy, and the power that lives in what you cannot control. Transformation is not optional here.',
    whatToExpect: [
      'High-stakes bargains, buried secrets, and confrontations with what you cannot undo.',
      'Willpower anchors you — holding form when everything else dissolves.',
      'Gate relics, transformation wards, and gear forged in shared peril.',
      'The emotional terrain is surrender: fear, release, and the cost of letting go.',
    ],
  },
  9: {
    house: 9,
    description:
      'The horizon keeps moving, and so must you. Encounters test your beliefs, your hunger for meaning, your willingness to be wrong about something important. Travel, education, and philosophy all converge on this path.',
    whatToExpect: [
      'Crossroads riddles, mentor trials, and choices that redefine what you thought you knew.',
      'Intuition guides the climb — pattern-reading over muscle memory.',
      'Pilgrim staves, horizon charms, and gear suited to long roads.',
      'The emotional terrain is faith: wonder, doubt, and the ache for a larger story.',
    ],
  },
  10: {
    house: 10,
    description:
      'Everyone is watching, and the Tribunal keeps score. Encounters test your ambitions, your public reputation, your career, and your willingness to accept authority or challenge it. The summit is lonely for a reason.',
    whatToExpect: [
      'Public reckonings, authority tests, and gambits where reputation is the stake.',
      'Willpower steadies the climb — resolve when the crowd turns.',
      'Summit regalia, tribunal armor, and symbols of earned rank.',
      'The emotional terrain is ambition: status, scrutiny, and the price of being seen at the top.',
    ],
  },
  11: {
    house: 11,
    description:
      'Connection is the currency and the trap. Encounters test your place in groups, your friendships, your ideals, and how you balance belonging with individuality. The Labyrinth rewards those who can navigate without losing themselves.',
    whatToExpect: [
      'Network puzzles, faction pressure, and dilemmas where the group and the self collide.',
      'Cunning maps the maze — reading alliances matters more than force.',
      'Labyrinth links, community sigils, and gear that rewards social leverage.',
      'The emotional terrain is belonging: loyalty, alienation, and the fear of being replaceable.',
    ],
  },
  12: {
    house: 12,
    description:
      'The walls dissolve here, and so do you. Encounters test your relationship with solitude, the unconscious, hidden enemies, and everything you have put away. What you find in the Vault was always yours. You just forgot.',
    whatToExpect: [
      'Dream logic, unseen pursuers, and truths that surface only when you stop running.',
      'Intuition pierces the fog — trust the signal beneath the noise.',
      'Dream-shards, veil wards, and relics drawn from what you buried.',
      'The emotional terrain is surrender: solitude, dread, and the relief of finally naming the shadow.',
    ],
  },
};

export const ALL_DUNGEON_HOUSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
