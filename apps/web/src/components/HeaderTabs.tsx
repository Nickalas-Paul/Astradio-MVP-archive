'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const NAV = [
  { href: '/profile', label: 'My Sky' },
  { href: '/today', label: 'Today' },
  { href: '/community', label: 'Community' },
  { href: '/sandbox', label: 'Sandbox' },
] as const;

function linkClass(active: boolean): string {
  const motion =
    'shrink-0 inline-flex items-center justify-center min-h-[44px] px-3 py-2 rounded-xl transition-all duration-base ease-aurora';
  return active
    ? `${motion} bg-accent-muted border border-accent/40 text-accent`
    : `${motion} text-text-secondary border border-transparent hover:bg-white/5 hover:text-text-primary hover:border-white/10`;
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/');
  }
  if (href === '/community') {
    return pathname === '/community' || pathname.startsWith('/community/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SettingsGearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function HeaderTabs() {
  const pathname = usePathname();
  const settingsActive = pathname === '/settings' || pathname.startsWith('/settings/');

  return (
    <div className="flex items-center gap-3 min-w-0 shrink-0">
      <nav
        className="flex items-center gap-2 text-body-sm overflow-x-auto scrollbar-hide max-w-[calc(100vw-10rem)] sm:max-w-none"
        aria-label="Main navigation"
      >
        {NAV.map(({ href, label }) => (
          <Link key={href} href={href} className={linkClass(isNavActive(pathname, href))}>
            {label}
          </Link>
        ))}
      </nav>
      <Link
        href="/settings"
        aria-label="Settings"
        className={`shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl transition-all duration-base ease-aurora ${
          settingsActive
            ? 'text-accent bg-accent-muted border border-accent/40'
            : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent'
        }`}
      >
        <SettingsGearIcon />
      </Link>
    </div>
  );
}

export default HeaderTabs;
