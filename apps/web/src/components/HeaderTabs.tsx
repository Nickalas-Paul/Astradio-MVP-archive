'use client';

import Link from 'next/link';
import React from 'react';

export function HeaderTabs() {
  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link
        href="/profile"
        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
      >
        Profile
      </Link>

      <Link
        href="/community"
        className="px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
      >
        Community
      </Link>
      <Link
        href="/sandbox"
        className="px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
      >
        Sandbox
      </Link>
      <Link
        href="/campaign"
        className="px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
      >
        Campaign
      </Link>
      <Link
        href="/education"
        className="px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
      >
        Education
      </Link>
      <Link
        href="/settings"
        className="px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
      >
        Settings
      </Link>
    </nav>
  );
}

export default HeaderTabs;
