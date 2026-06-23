'use client';

import { useEffect, type RefObject } from 'react';

/** Scroll the first reading section matching highlighted planets into view (wheel → text). */
export function useScrollToHighlightedSection(
  highlightedPlanets: Set<string>,
  containerRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (highlightedPlanets.size === 0) return;

    const sections =
      containerRef?.current != null
        ? containerRef.current.querySelectorAll('[data-section-planets]')
        : document.querySelectorAll('[data-section-planets]');

    for (const el of sections) {
      const planets = (el.getAttribute('data-section-planets') || '').split(',').filter(Boolean);
      if (planets.some((p) => highlightedPlanets.has(p))) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        break;
      }
    }
  }, [highlightedPlanets, containerRef]);
}
