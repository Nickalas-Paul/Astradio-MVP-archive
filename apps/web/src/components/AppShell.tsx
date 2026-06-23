'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import HeaderTabs from './HeaderTabs';
import { GlobalAudioPlayer } from './GlobalAudioPlayer';
import { ToastContainer } from './ToastContainer';
import { useUIStore } from '../store';

interface AppShellProps {
  children: ReactNode;
  showContextRail?: boolean;
  contextRailContent?: ReactNode;
  /** When false, hides the global audio player (e.g. Home uses local Lyria transport). */
  showPlayer?: boolean;
  /** Padding/classes on the page content wrapper; default matches app routes. */
  contentClassName?: string;
}

export function AppShell({
  children,
  showContextRail,
  contextRailContent,
  showPlayer = true,
  contentClassName = 'p-4 md:p-6 safe-bottom',
}: AppShellProps) {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-bg/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-wordmark.png" alt="" className="h-6 w-6 rounded" />
            <span className="text-accent font-semibold tracking-wide">Astradio</span>
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

      {showPlayer && <GlobalAudioPlayer />}
      <ToastContainer />
    </div>
  );
}
