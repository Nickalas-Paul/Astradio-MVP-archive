// Atlas Content Registry & Loader
// Seed content + ready for expansion

import type { AtlasArticle, AtlasIndex, AtlasKind, AtlasQuiz } from './types';

const SEED: AtlasArticle[] = [
  {
    id: 'planet.venus',
    kind: 'planet',
    title: 'Venus',
    subtitle: 'Affection · Aesthetics · Receptivity',
    summary: 'Venus speaks to how we relate, attract, and harmonize.',
    body: [
      '### Keywords',
      '- Love, taste, values, art, attraction',
      '### Dignity',
      '- Domicile: Taurus, Libra · Exaltation: Pisces',
      '### Shadow',
      '- People-pleasing, vanity, inertia',
      '### Practice',
      '- Beautify your space. Offer praise without agenda.'
    ].join('\n'),
    tags: ['venus', 'love', 'taurus', 'libra', 'aesthetics'],
    links: ['aspect.trine', 'sign.taurus', 'sign.libra'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'planet.mars',
    kind: 'planet',
    title: 'Mars',
    subtitle: 'Action · Desire · Assertion',
    summary: 'Mars drives action, desire, and how we assert ourselves.',
    body: [
      '### Keywords',
      '- Action, energy, courage, conflict, sexuality',
      '### Dignity',
      '- Domicile: Aries, Scorpio · Exaltation: Capricorn',
      '### Shadow',
      '- Aggression, impulsiveness, selfishness',
      '### Practice',
      '- Channel energy into physical activity. Set clear boundaries.'
    ].join('\n'),
    tags: ['mars', 'action', 'aries', 'scorpio', 'energy'],
    links: ['aspect.square', 'sign.aries', 'sign.scorpio'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'planet.sun',
    kind: 'planet',
    title: 'Sun',
    subtitle: 'Identity · Vitality · Purpose',
    summary: 'The Sun represents our core identity and life purpose.',
    body: [
      '### Keywords',
      '- Identity, ego, vitality, creativity, leadership',
      '### Dignity',
      '- Domicile: Leo · Exaltation: Aries',
      '### Shadow',
      '- Egotism, arrogance, need for constant attention',
      '### Practice',
      '- Express your authentic self. Take creative risks.'
    ].join('\n'),
    tags: ['sun', 'identity', 'leo', 'creativity', 'leadership'],
    links: ['aspect.conjunction', 'sign.leo', 'house.5'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'planet.moon',
    kind: 'planet',
    title: 'Moon',
    subtitle: 'Emotions · Instincts · Nurturing',
    summary: 'The Moon governs our emotional nature and unconscious patterns.',
    body: [
      '### Keywords',
      '- Emotions, instincts, habits, nurturing, intuition',
      '### Dignity',
      '- Domicile: Cancer · Exaltation: Taurus',
      '### Shadow',
      '- Moodiness, over-dependency, emotional manipulation',
      '### Practice',
      '- Honor your emotional needs. Create safe spaces.'
    ].join('\n'),
    tags: ['moon', 'emotions', 'cancer', 'instincts', 'nurturing'],
    links: ['aspect.opposition', 'sign.cancer', 'house.4'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'sign.taurus',
    kind: 'sign',
    title: 'Taurus',
    subtitle: 'Stability · Beauty · Persistence',
    summary: 'Taurus values stability, beauty, and material security.',
    body: [
      '### Element & Modality',
      '- Earth · Fixed',
      '### Keywords',
      '- Stability, beauty, persistence, sensuality, loyalty',
      '### Strengths',
      '- Reliable, artistic, patient, good with resources',
      '### Challenges',
      '- Stubborn, resistant to change, materialistic',
      '### Practice',
      '- Create beautiful, stable environments. Honor your values.'
    ].join('\n'),
    tags: ['taurus', 'earth', 'fixed', 'stability', 'beauty'],
    links: ['planet.venus', 'element.earth', 'modality.fixed'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'sign.aries',
    kind: 'sign',
    title: 'Aries',
    subtitle: 'Action · Leadership · Pioneering',
    summary: 'Aries is the pioneer, taking action and leading the way.',
    body: [
      '### Element & Modality',
      '- Fire · Cardinal',
      '### Keywords',
      '- Action, leadership, courage, independence, pioneering',
      '### Strengths',
      '- Natural leaders, high energy, innovative, decisive',
      '### Challenges',
      '- Impatient, impulsive, selfish, quick to anger',
      '### Practice',
      '- Channel energy into new projects. Take calculated risks.'
    ].join('\n'),
    tags: ['aries', 'fire', 'cardinal', 'action', 'leadership'],
    links: ['planet.mars', 'element.fire', 'modality.cardinal'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'sign.leo',
    kind: 'sign',
    title: 'Leo',
    subtitle: 'Creativity · Confidence · Drama',
    summary: 'Leo brings creativity, confidence, and natural drama.',
    body: [
      '### Element & Modality',
      '- Fire · Fixed',
      '### Keywords',
      '- Creativity, confidence, drama, generosity, pride',
      '### Strengths',
      '- Natural performers, creative, generous, confident',
      '### Challenges',
      '- Need for attention, arrogance, dramatic, self-centered',
      '### Practice',
      '- Express your creativity. Share your gifts with others.'
    ].join('\n'),
    tags: ['leo', 'fire', 'fixed', 'creativity', 'confidence'],
    links: ['planet.sun', 'element.fire', 'modality.fixed'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'sign.cancer',
    kind: 'sign',
    title: 'Cancer',
    subtitle: 'Nurturing · Protection · Emotions',
    summary: 'Cancer is the nurturer, protecting and caring for others.',
    body: [
      '### Element & Modality',
      '- Water · Cardinal',
      '### Keywords',
      '- Nurturing, protection, emotions, family, intuition',
      '### Strengths',
      '- Natural caregivers, intuitive, loyal, protective',
      '### Challenges',
      '- Over-emotional, over-protective, moody, clingy',
      '### Practice',
      '- Create safe, nurturing spaces. Trust your intuition.'
    ].join('\n'),
    tags: ['cancer', 'water', 'cardinal', 'nurturing', 'protection'],
    links: ['planet.moon', 'element.water', 'modality.cardinal'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'house.1',
    kind: 'house',
    title: '1st House',
    subtitle: 'Identity · Appearance · First Impressions',
    summary: 'The 1st House represents our identity and how we present ourselves.',
    body: [
      '### Keywords',
      '- Identity, appearance, first impressions, self-image',
      '### Rulership',
      '- Natural ruler: Aries · Traditional ruler: Mars',
      '### Themes',
      '- How we present ourselves to the world',
      '- Our approach to new beginnings',
      '- Physical appearance and mannerisms',
      '### Practice',
      '- Express your authentic self. Take care of your appearance.'
    ].join('\n'),
    tags: ['house', 'identity', 'appearance', 'aries', 'mars'],
    links: ['sign.aries', 'planet.mars', 'aspect.conjunction'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'house.7',
    kind: 'house',
    title: '7th House',
    subtitle: 'Contracts · Mirrors · Relating',
    summary: 'Where we meet the Other: partners, clients, open rivals.',
    body: [
      '### Keywords',
      '- Relationships, partnerships, contracts, marriage',
      '### Rulership',
      '- Natural ruler: Libra · Traditional ruler: Venus',
      '### Themes',
      '- One-on-one relationships and partnerships',
      '- What we seek in a partner',
      '- How we relate to others',
      '### Practice',
      '- Define terms clearly. State your needs openly.'
    ].join('\n'),
    tags: ['house', 'relationship', 'contracts', 'libra', 'venus'],
    links: ['sign.libra', 'planet.venus', 'aspect.opposition'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'house.5',
    kind: 'house',
    title: '5th House',
    subtitle: 'Creativity · Romance · Self-Expression',
    summary: 'The 5th House rules creativity, romance, and self-expression.',
    body: [
      '### Keywords',
      '- Creativity, romance, children, fun, entertainment',
      '### Rulership',
      '- Natural ruler: Leo · Traditional ruler: Sun',
      '### Themes',
      '- Creative self-expression and artistic pursuits',
      '- Romance and dating',
      '- Children and parenting',
      '### Practice',
      '- Express your creativity. Have fun and play.'
    ].join('\n'),
    tags: ['house', 'creativity', 'romance', 'leo', 'sun'],
    links: ['sign.leo', 'planet.sun', 'aspect.trine'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'house.4',
    kind: 'house',
    title: '4th House',
    subtitle: 'Home · Family · Emotional Foundation',
    summary: 'The 4th House represents home, family, and emotional security.',
    body: [
      '### Keywords',
      '- Home, family, roots, emotional foundation, private life',
      '### Rulership',
      '- Natural ruler: Cancer · Traditional ruler: Moon',
      '### Themes',
      '- Home and family life',
      '- Emotional foundation and security',
      '- Connection to roots and heritage',
      '### Practice',
      '- Create a nurturing home environment. Honor your roots.'
    ].join('\n'),
    tags: ['house', 'home', 'family', 'cancer', 'moon'],
    links: ['sign.cancer', 'planet.moon', 'aspect.opposition'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'aspect.square',
    kind: 'aspect',
    title: 'Square (90°)',
    summary: 'Friction that catalyzes growth through action.',
    body: [
      '### Nature',
      '- Dynamic tension; forces decisions',
      '### When Active',
      '- Expect deadlines, irritations, breakthroughs',
      '### Practice',
      '- Choose one concrete step. Ship something small.',
      '### Keywords',
      '- Tension, challenge, growth, conflict, motivation'
    ].join('\n'),
    tags: ['square', 'aspect', 'tension', 'growth', '90'],
    links: ['planet.mars', 'planet.saturn', 'modality.cardinal'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'aspect.trine',
    kind: 'aspect',
    title: 'Trine (120°)',
    summary: 'Harmony and ease between planets.',
    body: [
      '### Nature',
      '- Natural harmony and flow',
      '### When Active',
      '- Opportunities flow easily, talents emerge',
      '### Practice',
      '- Trust your instincts. Don\'t overthink it.',
      '### Keywords',
      '- Harmony, ease, talent, opportunity, flow'
    ].join('\n'),
    tags: ['trine', 'aspect', 'harmony', 'ease', '120'],
    links: ['planet.venus', 'planet.jupiter', 'element.fire'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'aspect.conjunction',
    kind: 'aspect',
    title: 'Conjunction (0°)',
    summary: 'Planets working together as one.',
    body: [
      '### Nature',
      '- Intensified energy and focus',
      '### When Active',
      '- New beginnings, concentrated power',
      '### Practice',
      '- Channel the combined energy wisely.',
      '### Keywords',
      '- Intensity, focus, combination, new beginning, power'
    ].join('\n'),
    tags: ['conjunction', 'aspect', 'intensity', 'focus', '0'],
    links: ['planet.sun', 'planet.moon', 'planet.mercury'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'aspect.opposition',
    kind: 'aspect',
    title: 'Opposition (180°)',
    summary: 'Planets in direct opposition, seeking balance.',
    body: [
      '### Nature',
      '- Tension that seeks resolution',
      '### When Active',
      '- Need for balance, awareness of different perspectives',
      '### Practice',
      '- Find the middle ground. Integrate opposites.',
      '### Keywords',
      '- Balance, tension, awareness, integration, relationship'
    ].join('\n'),
    tags: ['opposition', 'aspect', 'balance', 'tension', '180'],
    links: ['planet.sun', 'planet.moon', 'house.1', 'house.7'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'concept.dignity',
    kind: 'concept',
    title: 'Dignity',
    subtitle: 'Planetary Strength & Weakness',
    summary: 'Dignity describes how strong or weak a planet is in a particular sign.',
    body: [
      '### Types of Dignity',
      '- **Domicile**: Planet in its own sign (strongest)',
      '- **Exaltation**: Planet in its exalted sign (very strong)',
      '- **Detriment**: Planet in opposite sign (weakened)',
      '- **Fall**: Planet in opposite of exalted sign (weakest)',
      '### Practice',
      '- Notice which planets are strong in your chart',
      '- Work with dignity to understand planetary expression'
    ].join('\n'),
    tags: ['dignity', 'concept', 'strength', 'weakness', 'planets'],
    links: ['planet.venus', 'planet.mars', 'planet.sun', 'planet.moon'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'concept.element',
    kind: 'concept',
    title: 'Elements',
    subtitle: 'Fire, Earth, Air, Water',
    summary: 'The four elements describe fundamental approaches to life.',
    body: [
      '### The Four Elements',
      '- **Fire**: Aries, Leo, Sagittarius - Action, passion, inspiration',
      '- **Earth**: Taurus, Virgo, Capricorn - Practical, grounded, material',
      '- **Air**: Gemini, Libra, Aquarius - Intellectual, social, communicative',
      '- **Water**: Cancer, Scorpio, Pisces - Emotional, intuitive, sensitive',
      '### Practice',
      '- Notice which elements dominate your chart',
      '- Balance your elemental expression'
    ].join('\n'),
    tags: ['element', 'concept', 'fire', 'earth', 'air', 'water'],
    links: ['sign.aries', 'sign.taurus', 'sign.gemini', 'sign.cancer'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'concept.modality',
    kind: 'concept',
    title: 'Modalities',
    subtitle: 'Cardinal, Fixed, Mutable',
    summary: 'The three modalities describe how signs approach change and action.',
    body: [
      '### The Three Modalities',
      '- **Cardinal**: Aries, Cancer, Libra, Capricorn - Initiators, leaders',
      '- **Fixed**: Taurus, Leo, Scorpio, Aquarius - Stable, persistent',
      '- **Mutable**: Gemini, Virgo, Sagittarius, Pisces - Adaptable, flexible',
      '### Practice',
      '- Notice which modality dominates your chart',
      '- Work with your natural approach to change'
    ].join('\n'),
    tags: ['modality', 'concept', 'cardinal', 'fixed', 'mutable'],
    links: ['sign.aries', 'sign.taurus', 'sign.gemini', 'sign.cancer'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'glossary.orb',
    kind: 'glossary',
    title: 'Orb',
    summary: 'The allowable degree of separation for an aspect to be considered active.',
    body: [
      '### Definition',
      'The orb is the range of degrees within which an aspect is considered effective.',
      '### Typical Orbs',
      '- Conjunction: 8-10°',
      '- Opposition: 8-10°',
      '- Square: 6-8°',
      '- Trine: 6-8°',
      '- Sextile: 4-6°',
      '### Practice',
      '- Tighter orbs indicate stronger aspects',
      '- Wider orbs indicate weaker but still active aspects'
    ].join('\n'),
    tags: ['orb', 'glossary', 'aspect', 'degrees', 'separation'],
    links: ['aspect.square', 'aspect.trine', 'aspect.conjunction'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'glossary.synastry',
    kind: 'glossary',
    title: 'Synastry',
    summary: 'The comparison of two birth charts to understand relationship dynamics.',
    body: [
      '### Definition',
      'Synastry is the art of comparing two birth charts to understand relationship dynamics.',
      '### Key Elements',
      '- Planetary aspects between charts',
      '- House overlays (where one person\'s planets fall in the other\'s houses)',
      '- Element and modality compatibility',
      '### Practice',
      '- Look for harmonious aspects for ease',
      '- Notice challenging aspects for growth opportunities'
    ].join('\n'),
    tags: ['synastry', 'glossary', 'relationship', 'comparison', 'compatibility'],
    links: ['aspect.square', 'aspect.trine', 'house.7', 'concept.element'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'transit.venus-trine-mars',
    kind: 'transit',
    title: 'Venus Trine Mars',
    subtitle: 'Harmony Between Love and Action',
    summary: 'This transit brings natural harmony between your desires and actions.',
    body: [
      '### Theme',
      'Harmony between love and action, natural chemistry and creative flow.',
      '### Positive Manifestations',
      '- Natural chemistry and attraction',
      '- Easy expression of love and desire',
      '- Creative flow and inspiration',
      '- Harmonious relationships',
      '### Practice',
      '- Channel this energy into creative projects',
      '- Express your feelings openly and honestly',
      '- Use this time for romantic gestures'
    ].join('\n'),
    tags: ['transit', 'venus', 'mars', 'trine', 'harmony'],
    links: ['planet.venus', 'planet.mars', 'aspect.trine'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'transit.sun-conjunction-moon',
    kind: 'transit',
    title: 'Sun Conjunction Moon',
    subtitle: 'New Beginnings and Fresh Starts',
    summary: 'This transit marks a new beginning in your emotional and personal life.',
    body: [
      '### Theme',
      'New beginnings and fresh starts, integration of self and emotions.',
      '### Positive Manifestations',
      '- New beginnings and fresh starts',
      '- Integration of self and emotions',
      '- Clarity about your identity',
      '- Emotional balance and harmony',
      '### Practice',
      '- Set new intentions and goals',
      '- Focus on self-care and emotional well-being',
      '- Begin new projects or relationships'
    ].join('\n'),
    tags: ['transit', 'sun', 'moon', 'conjunction', 'new-beginnings'],
    links: ['planet.sun', 'planet.moon', 'aspect.conjunction'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  },
  {
    id: 'transit.mars-square-saturn',
    kind: 'transit',
    title: 'Mars Square Saturn',
    subtitle: 'Frustration and Obstacles',
    summary: 'This transit brings frustration and obstacles that test your patience.',
    body: [
      '### Theme',
      'Frustration and obstacles that test your patience and determination.',
      '### Challenges',
      '- Internal tension and conflict',
      '- Difficulty integrating energies',
      '- Frustration and impatience',
      '- Need for constant challenge',
      '### Practice',
      '- Focus on long-term goals',
      '- Build discipline and routine',
      '- Learn to work with limitations'
    ].join('\n'),
    tags: ['transit', 'mars', 'saturn', 'square', 'frustration'],
    links: ['planet.mars', 'planet.saturn', 'aspect.square'],
    updatedAt: new Date().toISOString(),
    lang: 'en'
  }
];

const QUIZ_SEED: AtlasQuiz[] = [
  {
    id: 'q1',
    prompt: 'A square (90°) is best described as…',
    choices: ['Easy flow', 'Friction forcing action', 'Total blockage', 'Pure harmony'],
    answer: 1,
    explain: 'Squares activate; they push toward decision & change.'
  },
  {
    id: 'q2',
    prompt: 'Venus is exalted in…',
    choices: ['Capricorn', 'Pisces', 'Virgo', 'Aries'],
    answer: 1,
    explain: 'Classically exalted in Pisces.'
  },
  {
    id: 'q3',
    prompt: 'The 7th House rules…',
    choices: ['Home and family', 'Partnerships and relationships', 'Career and reputation', 'Spirituality and higher learning'],
    answer: 1,
    explain: 'The 7th House is the house of partnerships and one-on-one relationships.'
  },
  {
    id: 'q4',
    prompt: 'Mars rules which signs?',
    choices: ['Aries and Scorpio', 'Taurus and Libra', 'Gemini and Virgo', 'Cancer and Leo'],
    answer: 0,
    explain: 'Mars is the traditional ruler of Aries and Scorpio.'
  },
  {
    id: 'q5',
    prompt: 'A trine (120°) aspect brings…',
    choices: ['Tension and conflict', 'Harmony and ease', 'Intensity and focus', 'Balance and integration'],
    answer: 1,
    explain: 'Trines bring natural harmony and easy flow between planets.'
  }
];

function buildIndex(seed: AtlasArticle[]): AtlasIndex {
  const byId: Record<string, AtlasArticle> = {};
  const byKind = { 
    planet: [], 
    sign: [], 
    house: [], 
    aspect: [], 
    transit: [], 
    concept: [], 
    glossary: [] 
  } as Record<AtlasKind, string[]>;
  const search: Array<{ id: string; t: string }> = [];
  
  for (const a of seed) {
    byId[a.id] = a;
    byKind[a.kind].push(a.id);
    const blob = [a.title, a.summary, (a.tags || []).join(' ')].join(' ').toLowerCase();
    search.push({ id: a.id, t: blob });
  }
  
  return { byId, byKind, search };
}

let INDEX = buildIndex(SEED);

export const AtlasRegistry = {
  all: (): AtlasIndex => INDEX,
  get: (id: string) => INDEX.byId[id] || null,
  kind: (k: AtlasKind) => (INDEX.byKind[k] || []).map(id => INDEX.byId[id]),
  search: (q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const idx = INDEX.search.filter(e => e.t.includes(s)).slice(0, 50);
    return idx.map(e => INDEX.byId[e.id]);
  },
  upsert: (a: AtlasArticle) => { // for later CMS ingestion
    const next = Object.values(INDEX.byId).filter(x => x.id !== a.id);
    next.push(a);
    INDEX = buildIndex(next);
    return a;
  },
  getQuiz: (id: string) => QUIZ_SEED.find(q => q.id === id) || null,
  getAllQuizzes: () => QUIZ_SEED,
  getRandomQuiz: () => QUIZ_SEED[Math.floor(Math.random() * QUIZ_SEED.length)]
};
