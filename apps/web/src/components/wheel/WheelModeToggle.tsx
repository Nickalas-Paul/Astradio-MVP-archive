'use client';

import { useWheelRenderMode, type WheelRenderMode } from '../../hooks/useWheelRenderMode';

const MODES: { id: WheelRenderMode; label: string; title: string }[] = [
  { id: 'classic', label: 'Chart', title: 'Classic chart' },
  { id: 'cinematic', label: 'Viz', title: 'Artistic visualization' },
];

export function WheelModeToggle() {
  const { mode, setMode } = useWheelRenderMode();

  return (
    <div
      className="flex rounded-lg bg-bg/80 border border-border/80 p-0.5 gap-0.5 backdrop-blur-sm opacity-80 hover:opacity-100 transition-opacity"
      role="group"
      aria-label="Wheel display mode"
    >
      {MODES.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => setMode(option.id)}
            className={`min-h-[28px] min-w-[36px] px-2 py-0.5 rounded-md text-[10px] font-medium leading-none transition-colors ${
              active
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-bgElev/80'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
