// Atlas Content Model & Taxonomy
// Complete type system for astrological education content

export type AtlasKind = 'planet' | 'sign' | 'house' | 'aspect' | 'transit' | 'concept' | 'glossary';

export type AtlasArticle = {
  id: string;
  kind: AtlasKind;
  title: string;
  subtitle?: string;
  summary: string;
  body: string;
  tags: string[];
  links?: string[];
  updatedAt: string;
  lang?: 'en' | 'es';
};

export type AtlasIndex = {
  byId: Record<string, AtlasArticle>;
  byKind: Record<AtlasKind, string[]>;
  search: Array<{ id: string; t: string }>;
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

