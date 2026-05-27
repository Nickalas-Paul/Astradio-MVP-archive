'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import HeaderTabs from './HeaderTabs';
import { PlayerBar } from './PlayerBar';
import { ToastContainer } from './ToastContainer';
import { useUIStore } from '../store';

interface AppShellProps {
  children: ReactNode;
  showContextRail?: boolean;
  contextRailContent?: ReactNode;
  /** When false, hides the global PlayerBar (e.g. Home uses local Lyria transport). */
  showPlayer?: boolean;
  /** Padding/classes on the page content wrapper; default matches app routes. */
  contentClassName?: string;
}

export function AppShell({
  children,
  showContextRail,
  contextRailContent,
  showPlayer = true,
  contentClassName = 'p-6',
}: AppShellProps) {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-bg/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="text-accent-light font-semibold tracking-wide shrink-0">
            Astradio
          </Link>
          <HeaderTabs />
        </div>
      </header>

      <main className="flex-1 flex">
        {sidebarOpen && showContextRail && (
          <aside className="w-80 bg-surface-1 border-r border-border p-6">{contextRailContent}</aside>
        )}

        <div className={`flex-1 ${contentClassName}`.trim()}>{children}</div>
      </main>

      {showPlayer && <PlayerBar />}
      <ToastContainer />
    </div>
  );
}
