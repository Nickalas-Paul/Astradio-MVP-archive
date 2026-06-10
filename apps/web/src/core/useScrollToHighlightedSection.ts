'use client';

import { useEffect } from 'react';

/** Scroll the first reading section matching highlighted planets into view (wheel → text). */
export function useScrollToHighlightedSection(highlightedPlanets: Set<string>) {
  useEffect(() => {
    if (highlightedPlanets.size === 0) return;
    const allSections = document.querySelectorAll('[data-section-planets]');
    for (const el of allSections) {
      const planets = (el.getAttribute('data-section-planets') || '').split(',').filter(Boolean);
      if (planets.some((p) => highlightedPlanets.has(p))) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        break;
      }
    }
  }, [highlightedPlanets]);
}
