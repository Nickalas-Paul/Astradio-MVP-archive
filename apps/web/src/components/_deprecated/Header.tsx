'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore, usePlayerStore } from '../store';
import { isFeatureEnabled } from '../core/config/flags';

export function Header() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { isPlaying, isPaused, setPlaying, setPaused } = usePlayerStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/sandbox', label: 'Sandbox' },
    { href: '/overlay', label: 'Overlay' },
    { href: '/composer', label: 'Composer' },
    { href: '/community', label: 'Community' },
    { href: '/atlas', label: 'Atlas', enabled: isFeatureEnabled('ENABLE_ATLAS') },
  ].filter(item => item.enabled !== false);

  const handlePlayPause = () => {
    if (isPlaying) {
      setPaused(true);
    } else {
      setPlaying(true);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald to-violet rounded-lg flex items-center justify-center">
              <span className="text-bg font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-semibold">Astradio</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-emerald/20 text-emerald'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bgElev'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Play/Pause Button (if idle) */}
            {!isPlaying && !isPaused && (
              <button
                onClick={handlePlayPause}
                className="btn-primary text-sm px-4 py-2"
              >
                ▶️ Play
              </button>
            )}

            {/* Sidebar Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bgElev transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bgElev transition-colors"
                aria-label="User menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-bgElev border border-border rounded-xl shadow-soft py-2">
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-text-primary hover:bg-bg transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    href="/about"
                    className="block px-4 py-2 text-sm text-text-primary hover:bg-bg transition-colors"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    About
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden mt-4 pt-4 border-t border-border">
          <nav className="flex space-x-4 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  pathname === item.href
                    ? 'bg-emerald/20 text-emerald'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bgElev'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
