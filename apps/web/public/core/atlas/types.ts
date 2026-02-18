// Atlas Content Model & Taxonomy
// Complete type system for astrological education content

export type AtlasKind = 'planet' | 'sign' | 'house' | 'aspect' | 'transit' | 'concept' | 'glossary';

export type AtlasArticle = {
  id: string;                 // e.g. "planet.venus"
  kind: AtlasKind;
  title: string;              // "Venus"
  subtitle?: string;          // "Affection · Aesthetics · Receptivity"
  summary: string;            // short teaser
  body: string;               // Markdown/plaintext for now (MDX later)
  tags: string[];             // ['venus','love','taurus','libra']
  links?: string[];           // cross-links to other ids
  updatedAt: string;          // ISO
  lang?: 'en' | 'es';
};

export type AtlasIndex = {
  byId: Record<string, AtlasArticle>;
  byKind: Record<AtlasKind, string[]>;
  search: Array<{ id: string; t: string }>; // naive index: title+summary+tags
};

export type AtlasQuiz = {
  id: string;
  prompt: string;
  choices: string[];
  answer: number;
  explain?: string;
};

export type AtlasBookmark = {
  id: string;
  articleId: string;
  createdAt: string;
  note?: string;
};

export type AtlasReadingProgress = {
  articleId: string;
  percentage: number;
  lastReadAt: string;
};

export type AtlasSearchResult = {
  article: AtlasArticle;
  relevance: number;
  matchedFields: string[];
};

export type AtlasContentStats = {
  totalArticles: number;
  articlesByKind: Record<AtlasKind, number>;
  totalBookmarks: number;
  readingProgress: number;
  lastUpdated: string;
};
