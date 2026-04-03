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
}

export function AppShell({ children, showContextRail, contextRailContent }: AppShellProps) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {/* Header — same primary surface links as Home (HeaderTabs) */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-bg/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <Link href="/" className="text-emerald-400 font-semibold tracking-wide shrink-0">
            Astradio
          </Link>
          <HeaderTabs />
        </div>
      </header>
      
      {/* Main Content Area */}
      <main className="flex-1 flex">
        {sidebarOpen && (
          <aside className="w-80 bg-surface-1 border-r border-border p-6">
            {showContextRail ? contextRailContent : null}
          </aside>
        )}
        
        {/* Page Content */}
        <div className="flex-1 p-6">
          {children}
        </div>
      </main>
      
      {/* Floating Player Bar */}
      <PlayerBar />
      
      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}
