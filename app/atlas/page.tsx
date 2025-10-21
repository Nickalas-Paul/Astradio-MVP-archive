'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import AtlasLayout from '../../src/components/atlas/AtlasLayout';
import { AtlasRegistry } from '../../src/core/atlas/registry';
import { useAtlasSearch } from '../../src/core/atlas/hooks';
import QuizWidget from '../../src/components/atlas/QuizWidget';
import Callout from '../../src/components/atlas/Callout';
import Link from 'next/link';
import { isFeatureEnabled } from '../../src/core/config/flags';
import { atlasTrackers } from '../../src/core/atlas/telemetry';
import { seedAtlas } from '../../src/core/atlas/seed';

export default function AtlasPage() {
  const [query, setQuery] = useState('');
  const { results, loading, error } = useAtlasSearch(query);

  // Track page view and seed content
  useEffect(() => {
    atlasTrackers.viewAtlas();
    
    // Seed content in development
    if (process.env.NODE_ENV === 'development') {
      seedAtlas();
    }
  }, []);

  // Track search
  useEffect(() => {
    if (query.trim()) {
      atlasTrackers.search(query, results.length);
    }
  }, [query, results.length]);

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_ATLAS')) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] p-4 lg:p-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-text mb-4">Astro Atlas</h1>
            <p className="text-subtext text-lg mb-8">
              The education hub is currently disabled. Enable it with <code className="bg-bgElev px-2 py-1 rounded">?atlas=1</code>
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const featured = ['planet.venus', 'aspect.square', 'house.7'].map(id => AtlasRegistry.get(id)).filter(Boolean);

  return (
    <AppShell>
      <AtlasLayout>
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center space-y-4"
          >
            <h1 className="text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald to-violet leading-tight">
              Astro Atlas
            </h1>
            <p className="text-lg text-subtext max-w-2xl mx-auto">
              Your comprehensive guide to astrological knowledge. Explore planets, signs, houses, aspects, and transits.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex items-center justify-center"
          >
            <div className="relative w-full max-w-md">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search planets, signs, houses, aspects…"
                className="w-full px-4 py-3 rounded-xl bg-bgElev border border-border text-text focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </motion.div>

          {/* Search Results */}
          {query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Search Results</h2>
                <span className="text-sm text-subtext">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              </div>

              {error && (
                <Callout tone="warn">
                  {error}
                </Callout>
              )}

              {results.length === 0 && !loading ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-subtext text-sm">No results found</p>
                  <p className="text-xs text-subtext mt-1">Try different keywords or check spelling</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {results.map((article, index) => (
                    <motion.li
                      key={article.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={`/atlas/a/${article.id}`}
                        className="block p-4 rounded-2xl border border-border bg-bgElev hover:border-emerald/50 transition-colors group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl flex-shrink-0">
                            {article.kind === 'planet' && '🪐'}
                            {article.kind === 'sign' && '♈'}
                            {article.kind === 'house' && '🏠'}
                            {article.kind === 'aspect' && '⚡'}
                            {article.kind === 'transit' && '🌊'}
                            {article.kind === 'concept' && '💡'}
                            {article.kind === 'glossary' && '📖'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-text group-hover:text-emerald transition-colors">
                                {article.title}
                              </h3>
                              <span className="text-xs px-2 py-1 rounded-full bg-bgElev border border-border text-subtext">
                                {article.kind}
                              </span>
                            </div>
                            <p className="text-sm text-subtext leading-relaxed">
                              {article.summary}
                            </p>
                            {article.subtitle && (
                              <p className="text-xs text-violet mt-1">
                                {article.subtitle}
                              </p>
                            )}
                          </div>
                          <div className="text-subtext group-hover:text-text transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {/* Featured Content */}
          {!query.trim() && (
            <>
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <h2 className="text-xl font-semibold text-text mb-4">Featured Articles</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {featured.map((article, index) => (
                    <motion.div
                      key={article?.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                    >
                      {article && (
                        <Link
                          href={`/atlas/a/${article.id}`}
                          className="block p-4 rounded-2xl border border-border bg-bgElev hover:border-emerald/50 transition-colors group"
                        >
                          <div className="text-2xl mb-2">
                            {article.kind === 'planet' && '🪐'}
                            {article.kind === 'aspect' && '⚡'}
                            {article.kind === 'house' && '🏠'}
                          </div>
                          <h3 className="font-medium text-text group-hover:text-emerald transition-colors mb-1">
                            {article.title}
                          </h3>
                          <p className="text-sm text-subtext">
                            {article.summary}
                          </p>
                        </Link>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.section>

              {/* Quick Learn & Start Here */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="grid md:grid-cols-2 gap-6"
              >
                <div>
                  <h3 className="text-lg font-semibold text-text mb-4">Quick Learn</h3>
                  <QuizWidget />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text mb-4">Start Here</h3>
                  <div className="space-y-4">
                    <Callout tone="tip">
                      <div className="space-y-2">
                        <div className="font-medium">Begin your astrological journey</div>
                        <ul className="text-sm space-y-1">
                          <li>• <Link href="/atlas/k/planet" className="underline hover:text-emerald">Planets</Link> carry motives and voices</li>
                          <li>• <Link href="/atlas/k/sign" className="underline hover:text-emerald">Signs</Link> color expression</li>
                          <li>• <Link href="/atlas/k/house" className="underline hover:text-emerald">Houses</Link> show life arenas</li>
                          <li>• <Link href="/atlas/k/aspect" className="underline hover:text-emerald">Aspects</Link> connect the story</li>
                        </ul>
                      </div>
                    </Callout>
                    <Callout tone="info">
                      <div className="space-y-2">
                        <div className="font-medium">Pro Tips</div>
                        <ul className="text-sm space-y-1">
                          <li>• Bookmark articles for quick reference</li>
                          <li>• Use glossary tooltips for definitions</li>
                          <li>• Take quizzes to test your knowledge</li>
                          <li>• Explore related articles for deeper learning</li>
                        </ul>
                      </div>
                    </Callout>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </AtlasLayout>
    </AppShell>
  );
}
