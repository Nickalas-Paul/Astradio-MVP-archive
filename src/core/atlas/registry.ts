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
  // ... remaining seed entries identical to src/core/atlas/registry.ts ...
];

const QUIZ_SEED: AtlasQuiz[] = [
  { id: 'q1', prompt: 'A square (90°) is best described as…', choices: ['Easy flow', 'Friction forcing action', 'Total blockage', 'Pure harmony'], answer: 1, explain: 'Squares activate; they push toward decision & change.' },
  { id: 'q2', prompt: 'Venus is exalted in…', choices: ['Capricorn', 'Pisces', 'Virgo', 'Aries'], answer: 1, explain: 'Classically exalted in Pisces.' },
  { id: 'q3', prompt: 'The 7th House rules…', choices: ['Home and family', 'Partnerships and relationships', 'Career and reputation', 'Spirituality and higher learning'], answer: 1, explain: 'The 7th House is the house of partnerships and one-on-one relationships.' },
  { id: 'q4', prompt: 'Mars rules which signs?', choices: ['Aries and Scorpio', 'Taurus and Libra', 'Gemini and Virgo', 'Cancer and Leo'], answer: 0, explain: 'Mars is the traditional ruler of Aries and Scorpio.' },
  { id: 'q5', prompt: 'A trine (120°) aspect brings…', choices: ['Tension and conflict', 'Harmony and ease', 'Intensity and focus', 'Balance and integration'], answer: 1, explain: 'Trines bring natural harmony and easy flow between planets.' }
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

