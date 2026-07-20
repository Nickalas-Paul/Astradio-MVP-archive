'use client';

import { BODY_LABELS, type BodyKey } from '../../../../../../vnext/canonical-bodies';
import { lonToSignDegMin, SIGN_NAMES } from '../../../lib/zodiac-degrees';
import { useAudioPlayerStore } from '../../../store/audio-player';
import type { HarmonicAspectArc, HarmonicElement, HarmonicPlanetSource } from './types';

const ELEMENT_LABEL: Record<HarmonicElement, string> = {
  fire: 'Fire',
  earth: 'Earth',
  air: 'Air',
  water: 'Water',
};

const MUSICAL_VOICE: Record<string, string> = {
  sun: 'Melodic Lead',
  moon: 'Lyrical Pad',
  mercury: 'Articulated Motif',
  venus: 'Harmonic Color',
  mars: 'Rhythmic Drive',
  jupiter: 'Bass Foundation',
  saturn: 'Structural Pulse',
  uranus: 'Timbral Accent',
  neptune: 'Atmospheric Wash',
  pluto: 'Deep Undertone',
};

type HarmonicOverlayProps = {
  sources: HarmonicPlanetSource[];
  arcs: HarmonicAspectArc[];
  selectedIndex: number | null;
  selectedAspectKey: string | null;
  onSelect: (index: number) => void;
  onSelectAspect: (key: string) => void;
  subtitle?: string;
  linkedExportId?: string | null;
};

function displayName(key: string, fallback: string): string {
  return BODY_LABELS[key as BodyKey] ?? fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

function capitalizeAspectType(type: string): string {
  const t = type.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatOrb(orb: number): string {
  return `${Math.round(orb)}°`;
}

function planetPosition(source: HarmonicPlanetSource): { name: string; sign: string; degree: number } {
  const { signIndex, degree } = lonToSignDegMin(source.lon);
  return {
    name: displayName(source.key, source.name),
    sign: SIGN_NAMES[signIndex] ?? '',
    degree: Math.round(degree),
  };
}

export function HarmonicOverlay({
  sources,
  arcs,
  selectedIndex,
  selectedAspectKey,
  onSelect,
  onSelectAspect,
  subtitle = 'Chart resonance',
  linkedExportId = null,
}: HarmonicOverlayProps) {
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack);
  const currentTime = useAudioPlayerStore((s) => s.currentTime);
  const duration = useAudioPlayerStore((s) => s.duration);
  const seek = useAudioPlayerStore((s) => s.seek);

  const live =
    isPlaying &&
    (!linkedExportId || currentTrack?.exportId === linkedExportId);
  const selected = selectedIndex !== null ? sources[selectedIndex] : null;
  const selectedAspect =
    selectedAspectKey !== null
      ? arcs.find((arc) => arc.key === selectedAspectKey) ?? null
      : null;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const selectedMeta = selected
    ? (() => {
        const position = planetPosition(selected);
        return {
          name: position.name,
          sign: position.sign,
          degree: position.degree,
          element: ELEMENT_LABEL[selected.element],
          voice: MUSICAL_VOICE[selected.key] ?? 'Harmonic Voice',
          color: selected.color,
        };
      })()
    : null;

  const incidentArcs =
    selectedIndex !== null
      ? arcs.filter(
          (arc) => arc.fromIdx === selectedIndex || arc.toIdx === selectedIndex,
        )
      : [];

  const aspectFrom = selectedAspect !== null ? sources[selectedAspect.fromIdx] : undefined;
  const aspectTo = selectedAspect !== null ? sources[selectedAspect.toIdx] : undefined;
  const aspectFromMeta = aspectFrom ? planetPosition(aspectFrom) : null;
  const aspectToMeta = aspectTo ? planetPosition(aspectTo) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between overflow-hidden p-3 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className="text-[1.15rem] sm:text-[1.6rem] font-medium tracking-wide text-[#e8c56d]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Harmonic Landscape
          </h2>
          <p className="mt-0.5 text-[10px] sm:text-xs text-white/45">{subtitle}</p>
        </div>
        {live ? (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#ffd4a0] backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff8c42] opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ff8c42]" />
            </span>
            Live
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 items-start justify-end pt-4 sm:pt-8">
        {selectedAspect && aspectFromMeta && aspectToMeta ? (
          <button
            type="button"
            onClick={() => onSelectAspect(selectedAspect.key)}
            className="pointer-events-auto w-[min(100%,15.5rem)] rounded-2xl border border-white/10 bg-black/45 p-3 sm:p-4 shadow-xl backdrop-blur-md text-left"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: aspectFrom?.color }}
              />
              <p className="text-sm text-white/90">
                <span style={{ color: aspectFrom?.color }}>{aspectFromMeta.name}</span>
                {' in '}
                {aspectFromMeta.sign}
                {' · '}
                {aspectFromMeta.degree}
                {'°'}
              </p>
            </div>
            <p className="mt-2 text-sm font-medium text-[#e8c56d]">
              {capitalizeAspectType(selectedAspect.type)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: aspectTo?.color }}
              />
              <p className="text-sm text-white/90">
                <span style={{ color: aspectTo?.color }}>{aspectToMeta.name}</span>
                {' in '}
                {aspectToMeta.sign}
                {' · '}
                {aspectToMeta.degree}
                {'°'}
              </p>
            </div>
            <p className="mt-2 text-sm text-white/55">
              Orb: {formatOrb(selectedAspect.orb)}
            </p>
          </button>
        ) : selectedMeta ? (
          <div className="pointer-events-auto w-[min(100%,15.5rem)] rounded-2xl border border-white/10 bg-black/45 p-3 sm:p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedMeta.color }}
              />
              <p className="text-base sm:text-lg font-medium text-white/95">{selectedMeta.name}</p>
            </div>
            <p className="mt-1 text-sm text-white/55">
              {selectedMeta.sign}
              {' · '}
              {selectedMeta.degree}
              {'°'}
            </p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-white/35">
              Element · {selectedMeta.element}
            </p>
            <p className="mt-1 text-sm text-[#e8c56d]">{selectedMeta.voice}</p>

            {incidentArcs.length > 0 ? (
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/35">Aspects</p>
                <ul className="mt-1.5 space-y-1">
                  {incidentArcs.map((arc) => {
                    const otherIdx =
                      arc.fromIdx === selectedIndex ? arc.toIdx : arc.fromIdx;
                    const other = sources[otherIdx];
                    const otherMeta = other ? planetPosition(other) : null;
                    const otherLabel = otherMeta
                      ? `${otherMeta.name} in ${otherMeta.sign}`
                      : arc.fromIdx === selectedIndex
                        ? arc.toName
                        : arc.fromName;
                    return (
                      <li key={arc.key}>
                        <button
                          type="button"
                          onClick={() => onSelectAspect(arc.key)}
                          className="w-full rounded-md px-1 py-0.5 text-left text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white/80"
                        >
                          <span className="text-white/70">
                            {capitalizeAspectType(arc.type)} {otherLabel}
                          </span>
                          <span className="font-light text-white/40">
                            {' · '}
                            {formatOrb(arc.orb)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 sm:space-y-3">
        <div className="pointer-events-auto flex max-w-full flex-wrap justify-center gap-1.5 overflow-visible px-0.5">
          {sources.map((source) => {
            const active = selectedIndex === source.index;
            const pillClass = active
              ? 'border-[#e8c56d] bg-white/10 text-white'
              : 'border-white/10 bg-black/35 text-white/70 hover:border-white/25';
            return (
              <button
                key={source.key}
                type="button"
                onClick={() => onSelect(source.index)}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors min-[480px]:gap-1.5 min-[480px]:px-2.5 min-[480px]:py-1.5 min-[480px]:text-xs ${pillClass}`}
              >
                <span
                  className="h-1 w-1 rounded-full min-[480px]:h-2 min-[480px]:w-2"
                  style={{ backgroundColor: source.color }}
                />
                {displayName(source.key, source.name)}
              </button>
            );
          })}
        </div>

        <div className="pointer-events-auto space-y-1.5 sm:space-y-2">
          <div className="relative h-1.5 rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[#e8c56d]"
              style={{ width: `${progress * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.001)}
              step={0.01}
              value={currentTime}
              aria-label="Playback position"
              disabled={!duration}
              onChange={(event) => seek(Number(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
            />
            <span
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-[#0d0618] bg-[#e8c56d]"
              style={{ left: `calc(${progress * 100}% - 6px)` }}
            />
          </div>
          <p className="text-center text-[10px] text-white/35 sm:text-[11px]">
            Click planets or aspects · Scroll to zoom · Drag to orbit
          </p>
        </div>
      </div>
    </div>
  );
}
