'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AtlasAPI } from '../../core/atlas/atlas-api';
import { isFeatureEnabled } from '../../core/config/flags';
import { trackFeatureUse } from '../../core/telemetry';
import type { WikiArticle } from '../../core/social/types';

export default function AtlasSearch() {
  const [query, setQuery] = useState('venus');
  const [results, setResults] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_ATLAS')) {
    return null;
  }

  useEffect(() => {
    const searchArticles = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchResults = await AtlasAPI.search(query);
        setResults(searchResults);
        trackFeatureUse('atlas', 'search', { query, resultCount: searchResults.length });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchArticles, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const getKindIcon = (kind: WikiArticle['kind']) => {
    switch (kind) {
      case 'planet':
        return '🪐';
      case 'sign':
        return '♈';
      case 'house':
        return '🏠';
      case 'aspect':
        return '⚡';
      case 'transit':
        return '🌊';
      case 'concept':
        return '💡';
      default:
        return '📖';
    }
  };

  const getKindColor = (kind: WikiArticle['kind']) => {
    switch (kind) {
      case 'planet':
        return 'text-emerald';
      case 'sign':
        return 'text-violet';
      case 'house':
        return 'text-warning';
      case 'aspect':
        return 'text-danger';
      case 'transit':
        return 'text-success';
      case 'concept':
        return 'text-subtext';
      default:
        return 'text-text';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-text">Astro Atlas</h3>
        <p className="text-sm text-subtext">
          Search for planets, signs, houses, aspects, and astrological concepts
        </p>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search signs, planets, houses, aspects…"
          className="w-full px-4 py-3 rounded-xl bg-bgElev border border-border text-text focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger/20 border border-danger text-danger text-sm">
          {error}
        </div>
      )}

      {query.trim() && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-text">Search Results</h4>
            <span className="text-sm text-subtext">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>

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
            <ul className="space-y-2">
              {results.map((article, index) => (
                <motion.li
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-2xl border border-border bg-bgElev hover:border-emerald/50 transition-colors group cursor-pointer"
                  onClick={() => {
                    trackFeatureUse('atlas', 'view_article', { articleId: article.id });
                    // TODO: Open article detail modal or navigate to article page
                    console.log('View article:', article.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getKindIcon(article.kind)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-text group-hover:text-emerald transition-colors">
                          {article.title}
                        </h5>
                        <span className={`text-xs px-2 py-1 rounded-full bg-bgElev border border-border ${getKindColor(article.kind)}`}>
                          {article.kind}
                        </span>
                      </div>
                      <p className="text-sm text-subtext leading-relaxed">
                        {article.summary}
                      </p>
                      {article.links && article.links.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-xs text-subtext">Related:</span>
                          <div className="flex flex-wrap gap-1">
                            {article.links.slice(0, 3).map(linkId => (
                              <span
                                key={linkId}
                                className="text-xs px-2 py-1 rounded-full bg-violet/10 text-violet border border-violet/20"
                              >
                                {linkId.split('.').pop()}
                              </span>
                            ))}
                            {article.links.length > 3 && (
                              <span className="text-xs text-subtext">
                                +{article.links.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-subtext group-hover:text-text transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Quick Access Categories */}
      {!query.trim() && (
        <div className="space-y-3">
          <h4 className="text-md font-medium text-text">Quick Access</h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { kind: 'planet', label: 'Planets', icon: '🪐', color: 'bg-emerald/10 border-emerald/20 text-emerald' },
              { kind: 'sign', label: 'Signs', icon: '♈', color: 'bg-violet/10 border-violet/20 text-violet' },
              { kind: 'house', label: 'Houses', icon: '🏠', color: 'bg-warning/10 border-warning/20 text-warning' },
              { kind: 'aspect', label: 'Aspects', icon: '⚡', color: 'bg-danger/10 border-danger/20 text-danger' }
            ].map(category => (
              <button
                key={category.kind}
                onClick={() => setQuery(category.kind)}
                className={`p-3 rounded-xl border ${category.color} hover:opacity-80 transition-opacity`}
              >
                <div className="text-2xl mb-1">{category.icon}</div>
                <div className="text-sm font-medium">{category.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
