'use client';

import { useState } from 'react';
import { WheelBuilder } from '@/components/wheel/WheelBuilder';
import { PlanetPalette } from './PlanetPalette';
import type { EphemerisSnapshot, SandboxOverrides, PlanetKey, SandboxSlotEntryMode } from '../../types/sandbox';

export interface SandboxWheelPanelProps {
  currentSnapshot: EphemerisSnapshot | null;
  overrides: SandboxOverrides;
  isUpdating: boolean;
  synastryNotice: string | null;
  freeBuild: boolean;
  ascendantOverrideDeg: number;
  activeSlotIndex: number;
  previewSyncError: string | null;
  onOverrideChange: (planet: PlanetKey, lonDeg: number) => void;
  onResetAll: () => void;
  /** Active slot workflow — drives Clear All vs Restore All label. */
  entryMode?: SandboxSlotEntryMode | null;
}

export function SandboxWheelPanel({
  currentSnapshot,
  overrides,
  isUpdating,
  synastryNotice,
  freeBuild,
  ascendantOverrideDeg,
  activeSlotIndex,
  previewSyncError,
  onOverrideChange,
  onResetAll,
  entryMode,
}: SandboxWheelPanelProps) {
  const isBlankCanvas = entryMode === 'blank_canvas';
  const resetAllLabel = isBlankCanvas ? 'Clear All' : 'Restore All';
  const [constrainToHouse, setConstrainToHouse] = useState(true);
  const [showAspectLines, setShowAspectLines] = useState(true);
  const [paletteSelectedPlanet, setPaletteSelectedPlanet] = useState<PlanetKey | null>(null);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text">Wheel</h2>
          <p className="text-sm text-subtext mt-1">
            Drag planets or use degree inputs. Without birth data, the wheel uses a neutral layout; after birth, house cusps follow the natal chart.
          </p>
          <p className="text-xs text-subtext mt-1">
            Ephemeris preview for active slot {activeSlotIndex}—positions here are not the resolved report or audio output.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-subtext">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={constrainToHouse} onChange={(e) => setConstrainToHouse(e.target.checked)} className="rounded" />
            Constrain to house
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showAspectLines} onChange={(e) => setShowAspectLines(e.target.checked)} className="rounded" />
            Aspect lines
          </label>
        </div>
        {Object.keys(overrides.planets).length > 0 && (
          <button onClick={onResetAll} className="px-3 py-1.5 text-sm bg-bgElev hover:bg-bgElev/80 border border-border rounded-lg text-subtext hover:text-text">
            {resetAllLabel}
          </button>
        )}
      </div>
      <div className="mb-4">
        <PlanetPalette
          overrides={overrides}
          selectedPlanet={paletteSelectedPlanet}
          onSelectPlanet={setPaletteSelectedPlanet}
        />
      </div>
      <div className="w-full aspect-square bg-bgElev border border-border rounded-2xl p-4 relative">
        <WheelBuilder
          snapshot={freeBuild ? null : currentSnapshot}
          overrides={overrides}
          onOverrideChange={(planet, lonDeg) => onOverrideChange(planet, lonDeg)}
          isUpdating={isUpdating}
          constrainToHouse={constrainToHouse}
          freeBuild={freeBuild}
          ascendantOverrideDeg={ascendantOverrideDeg}
          showAspectLines={showAspectLines}
          selectedPlanetForPlacement={paletteSelectedPlanet}
          isBlankCanvas={isBlankCanvas}
        />
      </div>
      {previewSyncError ? (
        <p className="mt-3 text-xs text-red-400 border border-red-500/30 rounded-lg p-2.5 bg-red-500/5" role="alert">
          {previewSyncError}
        </p>
      ) : null}
      {synastryNotice === 'asteroids_excluded_v1' && (
        <p
          className="mt-3 text-xs text-amber-200/90 border border-amber-500/30 rounded-lg p-2.5 bg-amber-500/5"
          role="status"
        >
          Asteroid placements aren&apos;t included in relationship-aspect lines yet. Sun-Pluto positions drive those lines.
        </p>
      )}
    </div>
  );
}
