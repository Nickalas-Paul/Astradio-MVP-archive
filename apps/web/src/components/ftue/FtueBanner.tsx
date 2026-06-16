'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { advanceFtueImpression, dismissFtueBanner } from './ftue-banner-storage';

export type FtueBannerProps = {
  storageKey: string;
  children: ReactNode;
  /** Page visits before auto-dismiss (default 1). */
  maxImpressions?: number;
  /** Optional CTA (link/button); does not dismiss the banner. */
  cta?: ReactNode;
  dismissLabel?: string;
  className?: string;
};

export function FtueBanner({
  storageKey,
  children,
  maxImpressions = 1,
  cta,
  dismissLabel = 'Got it',
  className = '',
}: FtueBannerProps) {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const state = advanceFtueImpression(localStorage, storageKey, maxImpressions);
      setVisible(state === 'visible');
      if (state === 'visible') {
        const t = window.requestAnimationFrame(() => setEntered(true));
        return () => window.cancelAnimationFrame(t);
      }
    } catch {
      setVisible(false);
    }
    return undefined;
  }, [storageKey, maxImpressions]);

  const dismiss = useCallback(() => {
    try {
      if (typeof window !== 'undefined') dismissFtueBanner(localStorage, storageKey);
    } catch {
      // ignore quota / private mode
    }
    setVisible(false);
  }, [storageKey]);

  if (!visible) return null;

  return (
    <div
      className={`rounded-xl border border-border border-l-2 border-l-accent/70 bg-bgElev px-4 py-4 sm:px-5 sm:py-5 transition-all duration-500 ease-out ${
        entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
      } ${className}`.trim()}
      role="note"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-2 text-body-sm text-text-secondary leading-relaxed">{children}</div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:pt-0.5">
          {cta}
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
          >
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
