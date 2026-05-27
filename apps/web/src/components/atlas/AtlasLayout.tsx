'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useBookmarks } from '../../core/atlas/hooks';
import { isFeatureEnabled } from '../../../config/flags';

interface AtlasLayoutProps {
  children: React.ReactNode;
}

export default function AtlasLayout({ children }: AtlasLayoutProps) {
  const pathname = usePathname();
  const { ids: bookmarks } = useBookmarks();

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_ATLAS')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-128px)] p-4 lg:p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-text mb-4">Astro Atlas</h1>
          <p className="text-subtext text-lg mb-8">
            The education hub is currently disabled. Enable it with <code className="bg-bgElev px-2 py-1 rounded">?atlas=1</code>
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/atlas', label: 'Home', icon: '🏠' },
    { href: '/atlas/k/planet', label: 'Planets', icon: '🪐' },
    { href: '/atlas/k/sign', label: 'Signs', icon: '♈' },
    { href: '/atlas/k/house', label: 'Houses', icon: '🏠' },
    { href: '/atlas/k/aspect', label: 'Aspects', icon: '⚡' },
    { href: '/atlas/k/transit', label: 'Transits', icon: '🌊' },
    { href: '/atlas/k/concept', label: 'Concepts', icon: '💡' },
    { href: '/atlas/k/glossary', label: 'Glossary', icon: '📖' }
  ];

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6 max-w-7xl mx-auto p-4 lg:p-8">
      {/* Sidebar */}
      <aside className="p-4 rounded-2xl border border-border bg-bgElev h-fit sticky top-20">
        <div className="space-y-4">
          {/* Navigation */}
          <nav className="space-y-2">
            <div className="font-semibold text-subtext mb-3 text-sm uppercase tracking-wide">
              Atlas Navigation
            </div>
            {navItems.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-accent-muted text-accent-light'
                      : 'text-subtext hover:text-text hover:bg-bgElev'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </motion.div>
            ))}
          </nav>

          {/* Bookmarks Section */}
          {bookmarks.length > 0 && (
            <div className="pt-4 border-t border-border">
              <div className="font-semibold text-subtext mb-3 text-sm uppercase tracking-wide">
                Bookmarks ({bookmarks.length})
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {bookmarks.slice(0, 10).map((bookmarkId, index) => {
                  // This would need to be enhanced to show actual article titles
                  return (
                    <motion.div
                      key={bookmarkId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <Link
                        href={`/atlas/a/${bookmarkId}`}
                        className="block px-3 py-1 rounded text-xs text-subtext hover:text-text hover:bg-bgElev transition-colors truncate"
                      >
                        {bookmarkId.replace('.', ' ')}
                      </Link>
                    </motion.div>
                  );
                })}
                {bookmarks.length > 10 && (
                  <div className="text-xs text-subtext px-3 py-1">
                    +{bookmarks.length - 10} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="pt-4 border-t border-border">
            <div className="font-semibold text-subtext mb-3 text-sm uppercase tracking-wide">
              Quick Stats
            </div>
            <div className="space-y-2 text-xs text-subtext">
              <div className="flex justify-between">
                <span>Articles:</span>
                <span className="text-text">25+</span>
              </div>
              <div className="flex justify-between">
                <span>Bookmarks:</span>
                <span className="text-text">{bookmarks.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span className="text-text">Today</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="space-y-6">
        {children}
      </main>
    </div>
  );
}
