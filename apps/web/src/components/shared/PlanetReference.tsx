'use client';

import type { ReactNode } from 'react';
import { PLANET_COLORS, normalizePlanetName } from '@/core/planet-identity';
import { usePlacementHighlight } from '@/core/PlacementHighlightContext';

export function PlanetReference({
  planetName,
  children,
}: {
  planetName: string;
  children: ReactNode;
}) {
  const { setHighlight, clearHighlight, highlightedPlanets } = usePlacementHighlight();
  const canonical = normalizePlanetName(planetName);
  const color = PLANET_COLORS[canonical];
  const isActive = highlightedPlanets.has(canonical);

  if (!color) return <>{children}</>;

  return (
    <span
      style={{
        color: isActive ? color : undefined,
        borderBottom: `1.5px solid ${color}40`,
        transition: 'color 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={() => setHighlight([canonical])}
      onMouseLeave={() => clearHighlight()}
      onTouchStart={() => setHighlight([canonical])}
      onTouchEnd={() => clearHighlight()}
    >
      {children}
    </span>
  );
}

/** Extract plain text from react-markdown children for pattern matching. */
export function extractTextContent(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractTextContent(props?.children ?? '');
  }
  return '';
}

export const PLANET_NAME_PATTERN =
  /\b(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|Chiron|Ascendant|North Node|South Node|Ceres|Pallas|Juno|Vesta|MC|IC)\b/i;
