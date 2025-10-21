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

  // Minimal seeding to keep bundle small; rest can be added in dev via registry
  add({ id: 'planet.venus', kind: 'planet', title: 'Venus', summary: 'The planet of love and aesthetics.' });
  add({ id: 'aspect.square', kind: 'aspect', title: 'Square (90°)', summary: 'Friction that catalyzes growth.' });
  add({ id: 'house.7', kind: 'house', title: '7th House', summary: 'Partnerships and one-on-one dynamics.' });
}

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const index = AtlasRegistry.all();
  if (Object.keys(index.byId).length < 3) {
    seedAtlas();
  }
}

