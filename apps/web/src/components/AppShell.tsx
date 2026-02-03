'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
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
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur bg-surface-0/80 border-b border-border">
        <div className="mx-auto max-w-content px-6 py-3 flex items-center justify-between">
          <span className="text-lg tracking-wide font-medium">Astradio</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-pill bg-surface-2 hover:bg-surface-3 transition duration-base ease-aurora border border-border text-text-primary">
              Dashboard
            </button>
          </div>
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
