'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const NAV = [
  { href: '/profile', label: 'Profile' },
  { href: '/community', label: 'Community' },
  { href: '/sandbox', label: 'Sandbox' },
  { href: '/settings', label: 'Settings' },
] as const;

function linkClass(active: boolean): string {
  return active
    ? 'px-3 py-1.5 rounded-xl bg-accent-muted border border-accent/40 text-accent-light'
    : 'px-3 py-1.5 rounded-xl text-text-secondary border border-transparent hover:bg-white/5 hover:text-text-primary hover:border-white/10';
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
    <nav className="flex items-center gap-3 text-body-sm">
      {NAV.map(({ href, label }) => (
        <Link key={href} href={href} className={linkClass(isNavActive(pathname, href))}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default HeaderTabs;
