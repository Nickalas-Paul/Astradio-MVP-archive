// Atlas Hooks
// Search, bookmarks, reading progress, and content management

import { useEffect, useMemo, useState } from 'react';
import { AtlasRegistry } from './registry';
import type { AtlasArticle, AtlasQuiz } from './types';
import { atlasTrackers } from './telemetry';

export function useAtlasSearch(q: string) {
  const [results, setResults] = useState<AtlasArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = AtlasRegistry.search(q);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  return { results, loading, error };
}

const BK_KEY = 'atlas.bookmarks.v1';
export function useBookmarks() {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BK_KEY);
      setIds(stored ? JSON.parse(stored) : []);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
      setIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = (id: string) => {
    setIds(prev => {
      const has = prev.includes(id);
      const next = has ? prev.filter(x => x !== id) : [id, ...prev].slice(0, 200);
      try {
        localStorage.setItem(BK_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save bookmarks:', err);
      }
      return next;
    });
  };

  const clear = () => {
    setIds([]);
    try {
      localStorage.removeItem(BK_KEY);
    } catch (err) {
      console.error('Failed to clear bookmarks:', err);
    }
  };

  return { 
    ids, 
    toggle, 
    has: (id: string) => ids.includes(id),
    clear,
    loading
  };
}

const RP_KEY = 'atlas.reading.v1';
export function useReadingProgress(id: string) {
  const [pct, setPct] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RP_KEY);
      const progress = stored ? JSON.parse(stored) : {};
      setPct(progress[id] || 0);
    } catch (err) {
      console.error('Failed to load reading progress:', err);
      setPct(0);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const save = (p: number) => {
    setPct(p);
    try {
      const stored = localStorage.getItem(RP_KEY);
      const progress = stored ? JSON.parse(stored) : {};
      progress[id] = p;
      localStorage.setItem(RP_KEY, JSON.stringify(progress));
    } catch (err) {
      console.error('Failed to save reading progress:', err);
    }
  };

  const clear = () => {
    setPct(0);
    try {
      const stored = localStorage.getItem(RP_KEY);
      const progress = stored ? JSON.parse(stored) : {};
      delete progress[id];
      localStorage.setItem(RP_KEY, JSON.stringify(progress));
    } catch (err) {
      console.error('Failed to clear reading progress:', err);
    }
  };

  return { pct, save, clear, loading };
}

export function useAtlasContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const content = useMemo(() => {
    try {
      const index = AtlasRegistry.all();
      return {
        totalArticles: Object.keys(index.byId).length,
        articlesByKind: Object.keys(index.byKind).reduce((acc, kind) => {
          acc[kind as keyof typeof index.byKind] = index.byKind[kind as keyof typeof index.byKind].length;
          return acc;
        }, {} as Record<string, number>),
        lastUpdated: new Date().toISOString()
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { content, loading, error };
}

export function useAtlasQuiz() {
  const [currentQuiz, setCurrentQuiz] = useState<AtlasQuiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const startQuiz = () => {
    const quiz = AtlasRegistry.getRandomQuiz();
    setCurrentQuiz(quiz);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setCompleted(false);
    setShowExplanation(false);
  };

  const selectAnswer = (index: number) => {
    setSelectedAnswer(index);
    setShowExplanation(true);
    
    const isCorrect = index === currentQuiz?.answer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    if (currentQuiz) {
      atlasTrackers.quizAnswer(currentQuiz.id, isCorrect);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < 4) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
      const nextQuiz = AtlasRegistry.getRandomQuiz();
      setCurrentQuiz(nextQuiz);
    } else {
      setCompleted(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuiz(null);
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setCompleted(false);
    setShowExplanation(false);
  };

  return {
    currentQuiz,
    currentIndex,
    selectedAnswer,
    score,
    completed,
    showExplanation,
    startQuiz,
    selectAnswer,
    nextQuestion,
    resetQuiz
  };
}

export function useAtlasStats() {
  const [stats, setStats] = useState<{
    totalArticles: number;
    articlesByKind: Record<string, number>;
    totalBookmarks: number;
    readingProgress: number;
    lastUpdated: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const index = AtlasRegistry.all();
      const bookmarks = JSON.parse(localStorage.getItem(BK_KEY) || '[]');
      const readingProgress = JSON.parse(localStorage.getItem(RP_KEY) || '{}');
      
      const totalProgress = Object.values(readingProgress).reduce((sum: number, pct: any) => sum + pct, 0);
      const avgProgress = Object.keys(readingProgress).length > 0 ? totalProgress / Object.keys(readingProgress).length : 0;

      setStats({
        totalArticles: Object.keys(index.byId).length,
        articlesByKind: Object.keys(index.byKind).reduce((acc, kind) => {
          acc[kind] = index.byKind[kind as keyof typeof index.byKind].length;
          return acc;
        }, {} as Record<string, number>),
        totalBookmarks: bookmarks.length,
        readingProgress: Math.round(avgProgress),
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading };
}

