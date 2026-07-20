import type { ComposeVisualControls } from '../../../core/compose-visual-controls';
import type { AuraRawSnapshot } from '../aura-raw-snapshot';

export type HarmonicElement = 'fire' | 'earth' | 'air' | 'water';
export type HarmonicQuality = 'high' | 'medium' | 'low';

export type HarmonicPlanetSource = {
  key: string;
  name: string;
  index: number;
  lon: number;
  theta: number;
  position: [number, number];
  frequency: number;
  amplitude: number;
  color: string;
  element: HarmonicElement;
  markerSize: number;
};

export type HarmonicAspectArc = {
  key: string;
  type: string;
  fromIdx: number;
  toIdx: number;
  midpointAngle: number;
  influence: number;
  color: string;
  opacity: number;
};

export type HarmonicPalette = {
  warmth: number;
  baseColorA: string;
  baseColorB: string;
};

export type HarmonicLandscapeProps = {
  snapshot: AuraRawSnapshot;
  composeControls?: ComposeVisualControls | null;
  linkedExportId?: string | null;
  active?: boolean;
  onWebGLError?: () => void;
  onReady?: () => void;
  onSelectionChange?: (hasSelection: boolean) => void;
  clearSelectionSignal?: number;
};
