'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppShell } from '../../../../src/components/AppShell';
import AtlasLayout from '../../../../src/components/atlas/AtlasLayout';
import { AtlasRegistry } from '../../../../src/core/atlas/registry';
import { useBookmarks, useReadingProgress } from '../../../../src/core/atlas/hooks';
import Callout from '../../../../src/components/atlas/Callout';
import GlossaryTooltip from '../../../../src/components/atlas/GlossaryTooltip';
import Link from 'next/link';
import { isFeatureEnabled } from '../../../../src/core/config/flags';
import { atlasTrackers } from '../../../../src/core/atlas/telemetry';

export default function AtlasArticlePage() {
  const { id } = useParams() as { id: string };
  const article = AtlasRegistry.get(id);
  const { has, toggle } = useBookmarks();
  const { pct, save } = useReadingProgress(id);

  // Track article view
  useEffect(() => {
    if (article) {
      atlasTrackers.viewArticle(article.id);
    }
  }, [article]);

  useEffect(() => {
    const onScroll = () => {
      const sc = document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0) {
        const progress = Math.round((sc / max) * 100);
        save(progress);
        
        // Track reading progress (throttled)
        if (progress % 25 === 0) { // Track at 25%, 50%, 75%, 100%
          atlasTrackers.articleProgress(id, progress);
        }
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [id, save]);

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

  if (!article) {
    return (
      <AppShell>
        <AtlasLayout>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">Article not found</h2>
            <p className="text-subtext mb-6">
              The article you're looking for doesn't exist or has been moved.
            </p>
            <Link
              href="/atlas"
              className="px-6 py-3 rounded-xl bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors"
            >
              Back to Atlas
            </Link>
          </motion.div>
        </AtlasLayout>
      </AppShell>
    );
  }

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'planet': return '🪐';
      case 'sign': return '♈';
      case 'house': return '🏠';
      case 'aspect': return '⚡';
      case 'transit': return '🌊';
      case 'concept': return '💡';
      case 'glossary': return '📖';
      default: return '📚';
    }
  };

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'planet': return 'text-emerald';
      case 'sign': return 'text-violet';
      case 'house': return 'text-warning';
      case 'aspect': return 'text-danger';
      case 'transit': return 'text-success';
      case 'concept': return 'text-subtext';
      case 'glossary': return 'text-text';
      default: return 'text-text';
    }
  };

  return (
    <AppShell>
      <AtlasLayout>
        <div className="space-y-6">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-start justify-between"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{getKindIcon(article.kind)}</span>
                <span className={`text-xs px-2 py-1 rounded-full bg-bgElev border border-border uppercase tracking-wide ${getKindColor(article.kind)}`}>
                  {article.kind}
                </span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-text mb-2">
                {article.title}
              </h1>
              {article.subtitle && (
                <p className="text-lg text-violet mb-3">
                  {article.subtitle}
                </p>
              )}
              <p className="text-subtext leading-relaxed mb-4">
                {article.summary}
              </p>
              <div className="flex items-center gap-4 text-sm text-subtext">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald rounded-full"></div>
                  <span>Read progress: {pct}%</span>
                </div>
                <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <button
              onClick={() => {
                const wasBookmarked = has(article.id);
                toggle(article.id);
                atlasTrackers.bookmark(article.id, !wasBookmarked);
              }}
              className={`px-4 py-2 rounded-xl border transition-colors ${
                has(article.id)
                  ? 'bg-emerald border-emerald text-bg'
                  : 'bg-bgElev border-border text-text hover:bg-border'
              }`}
            >
              {has(article.id) ? 'Bookmarked' : 'Bookmark'}
            </button>
          </motion.header>

          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="w-full bg-bgElev rounded-full h-2"
          >
            <div
              className="bg-emerald h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </motion.div>

          {/* Article Content */}
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="prose prose-invert max-w-none"
          >
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
              {article.body
                .replace(/square/g, '□ square')
                .replace(/Venus/g, '♀ Venus')
                .replace(/Mars/g, '♂ Mars')
                .replace(/Sun/g, '☉ Sun')
                .replace(/Moon/g, '☽ Moon')
                .replace(/Mercury/g, '☿ Mercury')
                .replace(/Jupiter/g, '♃ Jupiter')
                .replace(/Saturn/g, '♄ Saturn')
                .replace(/Uranus/g, '♅ Uranus')
                .replace(/Neptune/g, '♆ Neptune')
                .replace(/Pluto/g, '♇ Pluto')
              }
            </div>
          </motion.article>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-text">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1 rounded-full bg-bgElev border border-border text-subtext hover:text-text transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Related Articles */}
          {article.links && article.links.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Callout tone="tip">
                <div className="space-y-2">
                  <div className="font-medium">Related Articles</div>
                  <div className="flex flex-wrap gap-2">
                    {article.links.map(linkId => {
                      const relatedArticle = AtlasRegistry.get(linkId);
                      return relatedArticle ? (
                        <Link
                          key={linkId}
                          href={`/atlas/a/${linkId}`}
                          className="text-sm underline hover:text-emerald transition-colors"
                        >
                          {relatedArticle.title}
                        </Link>
                      ) : null;
                    })}
                  </div>
                </div>
              </Callout>
            </motion.div>
          )}

          {/* Glossary Demo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Callout tone="info">
              <div className="space-y-2">
                <div className="font-medium">Interactive Learning</div>
                <p className="text-sm">
                  Try hovering over terms like <GlossaryTooltip term="orb">orb</GlossaryTooltip> or{' '}
                  <GlossaryTooltip term="synastry">synastry</GlossaryTooltip> to see quick definitions.
                </p>
              </div>
            </Callout>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className="flex items-center justify-between pt-6 border-t border-border"
          >
            <Link
              href={`/atlas/k/${article.kind}`}
              className="flex items-center gap-2 text-sm text-subtext hover:text-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to {article.kind}
            </Link>
            <Link
              href="/atlas"
              className="flex items-center gap-2 text-sm text-subtext hover:text-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Atlas Home
            </Link>
          </motion.div>
        </div>
      </AtlasLayout>
    </AppShell>
  );
}
