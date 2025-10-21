'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppShell } from '../../../../src/components/AppShell';
import AtlasLayout from '../../../../src/components/atlas/AtlasLayout';
import { AtlasRegistry } from '../../../../src/core/atlas/registry';
import Link from 'next/link';
import { isFeatureEnabled } from '../../../../src/core/config/flags';

export default function AtlasKindPage() {
  const { kind } = useParams() as { kind: 'planet' | 'sign' | 'house' | 'aspect' | 'transit' | 'concept' | 'glossary' };
  
  const items = useMemo(() => AtlasRegistry.kind(kind), [kind]);

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

  const getKindDescription = (kind: string) => {
    switch (kind) {
      case 'planet': return 'The celestial bodies that influence our lives and personalities';
      case 'sign': return 'The twelve zodiac signs that color our expression';
      case 'house': return 'The twelve life areas where planetary energies manifest';
      case 'aspect': return 'The angular relationships between planets';
      case 'transit': return 'Current planetary movements and their effects';
      case 'concept': return 'Fundamental astrological principles and ideas';
      case 'glossary': return 'Definitions of astrological terms and concepts';
      default: return 'Astrological knowledge and wisdom';
    }
  };

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
            <div className="text-4xl mb-2">{getKindIcon(kind)}</div>
            <h1 className="text-3xl lg:text-4xl font-bold text-text capitalize">
              {kind}
            </h1>
            <p className="text-lg text-subtext max-w-2xl mx-auto">
              {getKindDescription(kind)}
            </p>
          </motion.div>

          {/* Content */}
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text mb-2">No articles yet</h3>
              <p className="text-sm text-subtext">
                We're working on adding more {kind} content. Check back soon!
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">
                  {items.length} Article{items.length !== 1 ? 's' : ''}
                </h2>
                <div className="text-sm text-subtext">
                  {kind === 'planet' && 'Core energies and influences'}
                  {kind === 'sign' && 'Personality traits and expressions'}
                  {kind === 'house' && 'Life areas and experiences'}
                  {kind === 'aspect' && 'Planetary relationships'}
                  {kind === 'transit' && 'Current influences'}
                  {kind === 'concept' && 'Fundamental principles'}
                  {kind === 'glossary' && 'Term definitions'}
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((article, index) => (
                  <motion.div
                    key={article.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                  >
                    <Link
                      href={`/atlas/a/${article.id}`}
                      className="block p-4 rounded-2xl border border-border bg-bgElev hover:border-emerald/50 transition-colors group h-full"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="text-2xl">
                            {article.kind === 'planet' && '🪐'}
                            {article.kind === 'sign' && '♈'}
                            {article.kind === 'house' && '🏠'}
                            {article.kind === 'aspect' && '⚡'}
                            {article.kind === 'transit' && '🌊'}
                            {article.kind === 'concept' && '💡'}
                            {article.kind === 'glossary' && '📖'}
                          </div>
                          <div className="text-subtext group-hover:text-text transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>

                        <div>
                          <h3 className="font-medium text-text group-hover:text-emerald transition-colors mb-1">
                            {article.title}
                          </h3>
                          {article.subtitle && (
                            <p className="text-xs text-violet mb-2">
                              {article.subtitle}
                            </p>
                          )}
                          <p className="text-sm text-subtext leading-relaxed">
                            {article.summary}
                          </p>
                        </div>

                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {article.tags.slice(0, 3).map(tag => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-1 rounded-full bg-bgElev border border-border text-subtext"
                              >
                                {tag}
                              </span>
                            ))}
                            {article.tags.length > 3 && (
                              <span className="text-xs text-subtext">
                                +{article.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Related Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="pt-6 border-t border-border"
          >
            <h3 className="text-lg font-semibold text-text mb-4">Explore Other Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['planet', 'sign', 'house', 'aspect', 'transit', 'concept', 'glossary']
                .filter(k => k !== kind)
                .map(otherKind => (
                  <Link
                    key={otherKind}
                    href={`/atlas/k/${otherKind}`}
                    className="p-3 rounded-xl border border-border bg-bgElev hover:border-emerald/50 transition-colors text-center group"
                  >
                    <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                      {getKindIcon(otherKind)}
                    </div>
                    <div className="text-sm font-medium text-text group-hover:text-emerald transition-colors capitalize">
                      {otherKind}
                    </div>
                  </Link>
                ))}
            </div>
          </motion.div>
        </div>
      </AtlasLayout>
    </AppShell>
  );
}
