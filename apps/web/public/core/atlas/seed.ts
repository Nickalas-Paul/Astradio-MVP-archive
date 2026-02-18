// Atlas Content Seeding Utility
// Fast-fill the Atlas with 40+ articles for comprehensive coverage

import { AtlasRegistry } from './registry';
import type { AtlasArticle } from './types';

export function seedAtlas(): void {
  const now = new Date().toISOString();
  
  const add = (a: Partial<AtlasArticle> & { id: string; kind: AtlasArticle['kind']; title: string }) =>
    AtlasRegistry.upsert({
      summary: '',
      body: '',
      tags: [],
      updatedAt: now,
      lang: 'en',
      ...a
    } as AtlasArticle);

  // Planets (10) - Complete planetary system
  const planets = [
    ['planet.sun', 'Sun', 'Vitality · Center · Identity', 'The Sun represents our core identity, vitality, and life purpose.'],
    ['planet.moon', 'Moon', 'Needs · Memory · Emotions', 'The Moon governs our emotional nature, instincts, and unconscious patterns.'],
    ['planet.mercury', 'Mercury', 'Speech · Mapping · Communication', 'Mercury rules communication, thinking, and how we process information.'],
    ['planet.venus', 'Venus', 'Affection · Aesthetics · Values', 'Venus speaks to how we relate, attract, and harmonize.'],
    ['planet.mars', 'Mars', 'Drive · Heat · Action', 'Mars drives action, desire, and how we assert ourselves.'],
    ['planet.jupiter', 'Jupiter', 'Meaning · Growth · Expansion', 'Jupiter brings expansion, wisdom, and growth opportunities.'],
    ['planet.saturn', 'Saturn', 'Form · Limits · Structure', 'Saturn teaches us about boundaries, discipline, and long-term goals.'],
    ['planet.uranus', 'Uranus', 'Shock · Freedom · Innovation', 'Uranus brings sudden change, freedom, and revolutionary thinking.'],
    ['planet.neptune', 'Neptune', 'Dream · Diffusion · Spirituality', 'Neptune dissolves boundaries and connects us to the divine.'],
    ['planet.pluto', 'Pluto', 'Depth · Power · Transformation', 'Pluto rules deep transformation, power, and regeneration.']
  ];

  planets.forEach(([id, title, subtitle, summary]) => 
    add({
      id,
      kind: 'planet',
      title,
      subtitle,
      summary,
      body: `### ${title}\n\n**Keywords**: Core energy, influence, expression\n\n**Dignity**: Rulership and exaltation\n\n**Shadow**: Potential challenges\n\n**Practice**: How to work with this energy`,
      tags: [title.toLowerCase(), 'planet', 'energy', 'influence'],
      links: ['concept.dignity', 'aspect.conjunction']
    })
  );

  // Signs (12) - Complete zodiac
  const signs = [
    ['aries', 'Fire', 'Cardinal', 'Mars'],
    ['taurus', 'Earth', 'Fixed', 'Venus'],
    ['gemini', 'Air', 'Mutable', 'Mercury'],
    ['cancer', 'Water', 'Cardinal', 'Moon'],
    ['leo', 'Fire', 'Fixed', 'Sun'],
    ['virgo', 'Earth', 'Mutable', 'Mercury'],
    ['libra', 'Air', 'Cardinal', 'Venus'],
    ['scorpio', 'Water', 'Fixed', 'Mars'],
    ['sagittarius', 'Fire', 'Mutable', 'Jupiter'],
    ['capricorn', 'Earth', 'Cardinal', 'Saturn'],
    ['aquarius', 'Air', 'Fixed', 'Uranus'],
    ['pisces', 'Water', 'Mutable', 'Neptune']
  ];

  signs.forEach(([sign, element, modality, ruler]) => {
    const title = sign.charAt(0).toUpperCase() + sign.slice(1);
    add({
      id: `sign.${sign}`,
      kind: 'sign',
      title,
      subtitle: `${element} · ${modality}`,
      summary: `${title} is a ${element.toLowerCase()} ${modality.toLowerCase()} sign ruled by ${ruler}.`,
      body: `### ${title}\n\n**Element**: ${element}\n**Modality**: ${modality}\n**Ruler**: ${ruler}\n\n**Keywords**: Expression, personality, approach\n\n**Strengths**: Natural talents and gifts\n\n**Challenges**: Areas for growth\n\n**Practice**: How to embody this sign's energy`,
      tags: [sign, element.toLowerCase(), modality.toLowerCase(), ruler.toLowerCase()],
      links: [`planet.${ruler.toLowerCase()}`, `element.${element.toLowerCase()}`, `modality.${modality.toLowerCase()}`]
    });
  });

  // Houses (12) - Complete house system
  const houses = [
    [1, 'Identity', 'Aries', 'Mars', 'Self-image, appearance, first impressions'],
    [2, 'Resources', 'Taurus', 'Venus', 'Money, values, possessions, talents'],
    [3, 'Communication', 'Gemini', 'Mercury', 'Siblings, neighbors, short trips, learning'],
    [4, 'Home', 'Cancer', 'Moon', 'Family, roots, private life, emotional foundation'],
    [5, 'Creativity', 'Leo', 'Sun', 'Children, romance, creativity, self-expression'],
    [6, 'Service', 'Virgo', 'Mercury', 'Work, health, daily routines, service'],
    [7, 'Partnerships', 'Libra', 'Venus', 'Marriage, business partners, open enemies'],
    [8, 'Transformation', 'Scorpio', 'Mars', 'Shared resources, intimacy, transformation'],
    [9, 'Philosophy', 'Sagittarius', 'Jupiter', 'Higher learning, travel, philosophy, religion'],
    [10, 'Career', 'Capricorn', 'Saturn', 'Public image, career, reputation, authority'],
    [11, 'Community', 'Aquarius', 'Uranus', 'Friends, groups, hopes, dreams, technology'],
    [12, 'Spirituality', 'Pisces', 'Neptune', 'Subconscious, spirituality, hidden enemies, karma']
  ];

  houses.forEach(([number, name, sign, ruler, themes]) => 
    add({
      id: `house.${number}`,
      kind: 'house',
      title: `${number}${number === 1 ? 'st' : number === 2 ? 'nd' : number === 3 ? 'rd' : 'th'} House`,
      subtitle: `${name} · ${sign}`,
      summary: `The ${number}${number === 1 ? 'st' : number === 2 ? 'nd' : number === 3 ? 'rd' : 'th'} House rules ${name.toLowerCase()} and is naturally ruled by ${sign}.`,
      body: `### ${number}${number === 1 ? 'st' : number === 2 ? 'nd' : number === 3 ? 'rd' : 'th'} House\n\n**Natural Sign**: ${sign}\n**Natural Ruler**: ${ruler}\n\n**Themes**: ${themes}\n\n**Keywords**: Life area, experience, manifestation\n\n**Shadow**: Potential challenges in this area\n\n**Practice**: How to work with this house's energy`,
      tags: ['house', name.toLowerCase(), sign.toLowerCase(), ruler.toLowerCase()],
      links: [`sign.${sign.toLowerCase()}`, `planet.${ruler.toLowerCase()}`, 'concept.dignity']
    })
  );

  // Aspects (6) - Major aspects
  const aspects = [
    ['aspect.conjunction', 'Conjunction (0°)', 'Intensity, focus, combination', 'Planets working together as one'],
    ['aspect.sextile', 'Sextile (60°)', 'Opportunity, potential, ease', 'Harmonious energy with growth potential'],
    ['aspect.square', 'Square (90°)', 'Tension, challenge, growth', 'Friction that catalyzes growth through action'],
    ['aspect.trine', 'Trine (120°)', 'Harmony, ease, talent', 'Natural harmony and flow between planets'],
    ['aspect.opposition', 'Opposition (180°)', 'Balance, tension, awareness', 'Planets in direct opposition, seeking balance'],
    ['aspect.quincunx', 'Quincunx (150°)', 'Adjustment, adaptation, integration', 'Awkward angle requiring adjustment and integration']
  ];

  aspects.forEach(([id, title, keywords, summary]) => 
    add({
      id,
      kind: 'aspect',
      title,
      summary,
      body: `### ${title}\n\n**Keywords**: ${keywords}\n\n**Nature**: How this aspect functions\n\n**When Active**: What to expect\n\n**Practice**: How to work with this energy\n\n**Orb**: Typical allowance for this aspect`,
      tags: ['aspect', title.split(' ')[0].toLowerCase(), 'relationship', 'energy'],
      links: ['glossary.orb', 'concept.dignity']
    })
  );

  // Concepts (6) - Fundamental principles
  const concepts = [
    ['concept.dignity', 'Essential Dignity', 'Planetary strength and weakness', 'How strong or weak a planet is in a particular sign'],
    ['concept.element', 'Elements', 'Fire, Earth, Air, Water', 'The four fundamental approaches to life'],
    ['concept.modality', 'Modalities', 'Cardinal, Fixed, Mutable', 'How signs approach change and action'],
    ['concept.retrograde', 'Retrograde Motion', 'Apparent backward movement', 'When planets appear to move backward'],
    ['concept.nodes', 'Lunar Nodes', 'Karmic points of destiny', 'The Moon\'s nodes and their significance'],
    ['concept.ascendant', 'Ascendant', 'Rising sign, first impression', 'The sign rising on the eastern horizon at birth']
  ];

  concepts.forEach(([id, title, subtitle, summary]) => 
    add({
      id,
      kind: 'concept',
      title,
      subtitle,
      summary,
      body: `### ${title}\n\n**Definition**: ${summary}\n\n**Keywords**: Core concepts and principles\n\n**Application**: How to use this in chart interpretation\n\n**Practice**: Practical ways to work with this concept`,
      tags: ['concept', title.toLowerCase().replace(/\s+/g, '-'), 'principle', 'foundation'],
      links: ['glossary.orb', 'concept.dignity']
    })
  );

  // Glossary (10) - Essential terms
  const glossary = [
    ['glossary.orb', 'Orb', 'Allowance around exact aspect', 'The range of degrees within which an aspect is considered effective'],
    ['glossary.synastry', 'Synastry', 'Chart-to-chart comparison', 'The art of comparing two birth charts to understand relationship dynamics'],
    ['glossary.composite', 'Composite Chart', 'Blended relationship chart', 'A chart created by averaging the positions of two people\'s planets'],
    ['glossary.transit', 'Transit', 'Current planetary movement', 'The current position of planets in relation to your birth chart'],
    ['glossary.progression', 'Progression', 'Symbolic time movement', 'A method of chart interpretation using symbolic time'],
    ['glossary.solar-return', 'Solar Return', 'Birthday chart', 'A chart cast for the moment the Sun returns to its birth position'],
    ['glossary.midpoint', 'Midpoint', 'Halfway point between planets', 'The point halfway between two planets in the zodiac'],
    ['glossary.interception', 'Interception', 'Sign not on house cusps', 'When a sign is contained entirely within a house'],
    ['glossary.mutual-reception', 'Mutual Reception', 'Planets in each other\'s signs', 'When two planets are in each other\'s ruling signs'],
    ['glossary.grand-trine', 'Grand Trine', 'Three planets in trine', 'Three planets forming a triangle of trine aspects']
  ];

  glossary.forEach(([id, title, subtitle, summary]) => 
    add({
      id,
      kind: 'glossary',
      title,
      subtitle,
      summary,
      body: `### ${title}\n\n**Definition**: ${summary}\n\n**Usage**: How this term is used in astrology\n\n**Examples**: Practical examples and applications\n\n**Related**: Other terms and concepts to explore`,
      tags: ['glossary', title.toLowerCase().replace(/\s+/g, '-'), 'definition', 'term'],
      links: ['concept.dignity', 'glossary.orb']
    })
  );

  // Transits (8) - Common transits
  const transits = [
    ['transit.venus-trine-mars', 'Venus Trine Mars', 'Harmony between love and action', 'Natural chemistry and creative flow'],
    ['transit.sun-conjunction-moon', 'Sun Conjunction Moon', 'New beginnings and fresh starts', 'Integration of self and emotions'],
    ['transit.mars-square-saturn', 'Mars Square Saturn', 'Frustration and obstacles', 'Internal tension and conflict'],
    ['transit.jupiter-trine-sun', 'Jupiter Trine Sun', 'Expansion and opportunity', 'Growth and positive developments'],
    ['transit.saturn-opposition-moon', 'Saturn Opposition Moon', 'Emotional challenges', 'Need for emotional maturity'],
    ['transit.uranus-square-sun', 'Uranus Square Sun', 'Sudden changes and disruptions', 'Breaking free from limitations'],
    ['transit.neptune-conjunction-venus', 'Neptune Conjunction Venus', 'Romantic idealism', 'Spiritual love and compassion'],
    ['transit.pluto-square-mars', 'Pluto Square Mars', 'Power struggles and transformation', 'Deep psychological changes']
  ];

  transits.forEach(([id, title, subtitle, summary]) => 
    add({
      id,
      kind: 'transit',
      title,
      subtitle,
      summary,
      body: `### ${title}\n\n**Theme**: ${summary}\n\n**Duration**: How long this transit typically lasts\n\n**Positive Manifestations**: What to expect when it goes well\n\n**Challenges**: Potential difficulties to navigate\n\n**Practice**: How to work with this energy`,
      tags: ['transit', title.toLowerCase().replace(/\s+/g, '-'), 'current', 'influence'],
      links: ['aspect.trine', 'aspect.square', 'aspect.conjunction', 'aspect.opposition']
    })
  );

  console.log('[Atlas Seeding] Successfully seeded 40+ articles across all categories');
}

// Auto-seed in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Only seed if the registry is empty
  const index = AtlasRegistry.all();
  if (Object.keys(index.byId).length < 10) {
    seedAtlas();
  }
}
