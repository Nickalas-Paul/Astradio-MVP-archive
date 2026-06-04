'use client';

import type { SandboxOverrides, PlanetKey, SandboxSlotEntryMode } from '../../types/sandbox';
import { BODY_DISPLAY_ORDER, BODY_LABELS } from '../../../../../vnext/canonical-bodies';
import { lonToSignDeg, roundZodiacDegree, SIGN_NAMES, signDegToLon } from '../../lib/zodiac-degrees';

const PLANET_ORDER: PlanetKey[] = [...BODY_DISPLAY_ORDER] as PlanetKey[];
const PLANET_LABELS: Record<PlanetKey, string> = { ...BODY_LABELS } as Record<PlanetKey, string>;

function houseIndexForLongitude(lonDeg: number, cusps: number[]): number {
  if (cusps.length < 12) return 0;
  const lon = ((lonDeg % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const inRange = end > start ? lon >= start && lon < end : lon >= start || lon < end;
    if (inRange) return i;
  }
  return 0;
}

export interface DegreePanelProps {
  overrides: SandboxOverrides;
  basePositions?: Record<string, number>;
  /** Cusps (12 numbers) for house number display */
  cusps?: number[];
  onOverrideChange: (planet: PlanetKey, lonDeg: number | null) => void;
  onResetPlanet?: (planet: PlanetKey) => void;
  /** Ascendant row: editable in free-build, read-only when birth chart cusps exist */
  ascendantLon?: number;
  ascendantEditable?: boolean;
  onAscendantChange?: (lonDeg: number) => void;
  /** Active slot workflow — drives Clear vs Restore labels. */
  entryMode?: SandboxSlotEntryMode | null;
}

function planetResetCopy(entryMode?: SandboxSlotEntryMode | null) {
  const isBlankCanvas = entryMode === 'blank_canvas';
  return {
    button: isBlankCanvas ? 'Clear' : 'Restore',
    title: isBlankCanvas ? 'Clear placement' : 'Restore to original position',
  };
}

function DegreeInputs({
  label,
  lonDeg,
  disabled,
  onLonChange,
  houseNum,
}: {
  label: string;
  lonDeg: number;
  disabled?: boolean;
  onLonChange: (lon: number) => void;
  houseNum: number | null;
}) {
  const { signIdx, deg, min } = lonToSignDeg(lonDeg);
  const inputClass = disabled
    ? 'px-2 py-1 bg-bg/50 border border-border/60 rounded text-text-secondary text-sm min-w-[7rem] cursor-not-allowed'
    : 'px-2 py-1 bg-bg border border-border rounded text-text-primary text-sm min-w-[7rem]';
  const numClass = disabled
    ? 'w-12 px-2 py-1 bg-bg/50 border border-border/60 rounded text-text-secondary text-sm cursor-not-allowed'
    : 'w-12 px-2 py-1 bg-bg border border-border rounded text-text-primary text-sm';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`${label} sign`}
        value={signIdx}
        disabled={disabled}
        onChange={(e) => {
          const nextIdx = parseInt(e.target.value, 10);
          if (!Number.isFinite(nextIdx) || nextIdx < 0 || nextIdx > 11) return;
          const { deg: d, min: m } = lonToSignDeg(lonDeg);
          onLonChange(roundZodiacDegree(signDegToLon(nextIdx, d, m)));
        }}
        className={inputClass}
      >
        {SIGN_NAMES.map((name, i) => (
          <option key={name} value={i}>
            {name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={0}
        max={29}
        step={1}
        aria-label={`${label} degree in sign`}
        value={deg}
        disabled={disabled}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!Number.isFinite(val) || val < 0 || val > 29) return;
          const { signIdx: si, min: m } = lonToSignDeg(lonDeg);
          onLonChange(roundZodiacDegree(signDegToLon(si, val, m)));
        }}
        className={numClass}
      />
      <span className="text-xs text-text-secondary">°</span>
      <input
        type="number"
        min={0}
        max={59}
        step={1}
        aria-label={`${label} minutes`}
        value={min}
        disabled={disabled}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!Number.isFinite(val) || val < 0 || val > 59) return;
          const { signIdx: si, deg: d } = lonToSignDeg(lonDeg);
          onLonChange(roundZodiacDegree(signDegToLon(si, d, val)));
        }}
        className={numClass}
      />
      <span className="text-xs text-text-secondary">′</span>
      {houseNum != null && <span className="text-xs text-text-secondary/80">· House {houseNum}</span>}
    </div>
  );
}

/**
 * Planet degree editor. Internal state: canonical longitude 0–360°.
 * User-facing: sign + 0–29° within sign + minutes. Conversion at boundary only.
 */
export function DegreePanel({
  overrides,
  basePositions,
  cusps,
  onOverrideChange,
  onResetPlanet,
  ascendantLon,
  ascendantEditable = false,
  onAscendantChange,
  entryMode,
}: DegreePanelProps) {
  const resetCopy = planetResetCopy(entryMode);
  const showAscRow = ascendantLon != null && Number.isFinite(ascendantLon);
  const ascHouseNum =
    showAscRow && cusps && cusps.length === 12 ? houseIndexForLongitude(ascendantLon!, cusps) + 1 : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Planet Degrees</h3>
      <p className="text-xs text-text-secondary mb-2">Sign, degree in sign (0–29°), and minutes. Values stored as longitude 0–360°.</p>

      {showAscRow ? (
        <div
          className={`flex items-center gap-3 p-2 rounded-lg border ${
            ascendantEditable ? 'bg-bgElev border-border' : 'bg-bgElev/60 border-border/60'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-text-primary w-20">Ascendant</span>
              {!ascendantEditable && <span className="text-xs text-text-secondary">(from birth chart)</span>}
            </div>
            <DegreeInputs
              label="Ascendant"
              lonDeg={ascendantLon!}
              disabled={!ascendantEditable}
              onLonChange={(lon) => onAscendantChange?.(lon)}
              houseNum={ascHouseNum}
            />
          </div>
        </div>
      ) : null}

      {PLANET_ORDER.filter((p) => p !== 'northNode').map((planet) => {
        const override = overrides.planets[planet];
        const baseLon = basePositions?.[planet];
        const currentLon = override?.lonDeg ?? baseLon ?? 0;
        const hasOverride = override !== undefined;
        const houseNum = cusps && cusps.length === 12 ? houseIndexForLongitude(currentLon, cusps) + 1 : null;

        return (
          <div key={planet} className="flex items-center gap-3 p-2 bg-bgElev rounded-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-text-primary w-20">{PLANET_LABELS[planet]}</span>
              </div>
              <DegreeInputs
                label={PLANET_LABELS[planet]}
                lonDeg={currentLon}
                onLonChange={(lon) => onOverrideChange(planet, lon)}
                houseNum={houseNum}
              />
            </div>
            {hasOverride && (
              <button
                onClick={() => {
                  if (onResetPlanet) onResetPlanet(planet);
                  else onOverrideChange(planet, null);
                }}
                className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded"
                title={resetCopy.title}
              >
                {resetCopy.button}
              </button>
            )}
          </div>
        );
      })}

      {(() => {
        const nnOverride = overrides.planets.northNode;
        const nnBase = basePositions?.northNode;
        const nnLon = nnOverride?.lonDeg ?? nnBase;
        if (nnLon == null || !Number.isFinite(nnLon)) return null;
        const hasOverride = nnOverride !== undefined;
        const houseNum = cusps && cusps.length === 12 ? houseIndexForLongitude(nnLon, cusps) + 1 : null;
        const southLon = (nnLon + 180) % 360;
        const south = lonToSignDeg(southLon);

        return (
          <div className="p-2 bg-bgElev rounded-lg space-y-2 border border-border/60">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text-primary w-20">North Node</span>
                </div>
                <DegreeInputs
                  label="North Node"
                  lonDeg={nnLon}
                  onLonChange={(lon) => onOverrideChange('northNode', lon)}
                  houseNum={houseNum}
                />
              </div>
              {hasOverride && (
                <button
                  onClick={() => {
                    if (onResetPlanet) onResetPlanet('northNode');
                    else onOverrideChange('northNode', null);
                  }}
                  className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded"
                  title={resetCopy.title}
                >
                  {resetCopy.button}
                </button>
              )}
            </div>
            <p className="text-xs text-text-secondary pl-0.5">
              South Node (derived): {south.sign} {south.deg}°{south.min}′
            </p>
          </div>
        );
      })()}
    </div>
  );
}
