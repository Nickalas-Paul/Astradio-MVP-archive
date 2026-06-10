'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { normalizePlanetName } from '@/core/planet-identity';

interface PlacementHighlightState {
  highlightedPlanets: Set<string>;
  setHighlight: (planets: string[]) => void;
  clearHighlight: () => void;
}

const PlacementHighlightContext = createContext<PlacementHighlightState>({
  highlightedPlanets: new Set(),
  setHighlight: () => {},
  clearHighlight: () => {},
});

export function PlacementHighlightProvider({ children }: { children: React.ReactNode }) {
  const [highlightedPlanets, setHighlightedPlanets] = useState<Set<string>>(new Set());

  const setHighlight = useCallback((planets: string[]) => {
    setHighlightedPlanets(new Set(planets.map((p) => normalizePlanetName(p))));
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedPlanets(new Set());
  }, []);

  const value = useMemo(
    () => ({
      highlightedPlanets,
      setHighlight,
      clearHighlight,
    }),
    [highlightedPlanets, setHighlight, clearHighlight]
  );

  return (
    <PlacementHighlightContext.Provider value={value}>{children}</PlacementHighlightContext.Provider>
  );
}

export function usePlacementHighlight() {
  return useContext(PlacementHighlightContext);
}
