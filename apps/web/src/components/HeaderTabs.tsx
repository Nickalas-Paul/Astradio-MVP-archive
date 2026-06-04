'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const NAV = [
  { href: '/profile', label: 'My Sky' },
  { href: '/community', label: 'Community' },
  { href: '/sandbox', label: 'Sandbox' },
  { href: '/settings', label: 'Settings' },
] as const;

function linkClass(active: boolean): string {
  const motion =
    'shrink-0 inline-flex items-center justify-center min-h-[44px] px-3 py-2 rounded-xl transition-all duration-base ease-aurora';
  return active
    ? `${motion} bg-accent-muted border border-accent/40 text-accent-light`
    : `${motion} text-text-secondary border border-transparent hover:bg-white/5 hover:text-text-primary hover:border-white/10`;
}

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-2 text-body-sm overflow-x-auto scrollbar-hide max-w-[calc(100vw-8rem)] sm:max-w-none -mr-2 pr-2"
      aria-label="Main navigation"
    >
      {NAV.map(({ href, label }) => (
        <Link key={href} href={href} className={linkClass(isNavActive(pathname, href))}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default HeaderTabs;
