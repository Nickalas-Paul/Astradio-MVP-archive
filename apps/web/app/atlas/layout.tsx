'use client';

import { atlasEnabled } from './_guard';
import { motion } from 'framer-motion';

interface AtlasRouteGuardProps {
  children: React.ReactNode;
}

export default function AtlasRouteGuard({ children }: AtlasRouteGuardProps) {
  if (!atlasEnabled()) {
    return (
      <div className="min-h-[calc(100vh-128px)] flex items-center justify-center p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto text-center space-y-6"
        >
          <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-text">Education Hub Disabled</h1>
            <p className="text-subtext">
              The Astro Atlas education hub is currently disabled. Enable it with{' '}
              <code className="bg-bgElev px-2 py-1 rounded text-xs">?atlas=1</code>
            </p>
          </div>
          
          <div className="pt-4">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Home
            </a>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
