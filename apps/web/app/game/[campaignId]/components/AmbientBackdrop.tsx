'use client';

import type { DungeonTheme } from '@/lib/game/dungeonThemes';

export interface AmbientBackdropProps {
  dungeon: DungeonTheme;
}

/**
 * Full-viewport layered ambient background for the Campaign surface.
 * Atmosphere is driven by Mars dungeon house (not character element).
 */
export function AmbientBackdrop({ dungeon }: AmbientBackdropProps) {
  const { bg, accent } = dungeon;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes ambientDrift {
          0% { transform: translate(0,0) scale(1); }
          33% { transform: translate(30px,-20px) scale(1.1); }
          66% { transform: translate(-20px,10px) scale(0.95); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes particleTwinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.55; }
        }
      `}</style>

      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{ background: bg.gradient }}
      />

      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{
          background: bg.radial,
          animation: 'ambientDrift 25s ease-in-out infinite',
          opacity: 0.9,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 30% 70%, ${accent.primaryAlpha(0.06)}, transparent 40%)`,
          animation: 'ambientDrift 18s ease-in-out infinite reverse',
          opacity: 0.5,
        }}
      />

      {/* Soft particle field */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            `radial-gradient(1.5px 1.5px at 18% 22%, ${bg.particleColor}, transparent)`,
            `radial-gradient(1px 1px at 42% 68%, ${bg.particleColor}, transparent)`,
            `radial-gradient(1.5px 1.5px at 72% 18%, ${bg.particleColor}, transparent)`,
            `radial-gradient(1px 1px at 84% 54%, ${bg.particleColor}, transparent)`,
            `radial-gradient(1.5px 1.5px at 28% 82%, ${bg.particleColor}, transparent)`,
            `radial-gradient(1px 1px at 58% 36%, ${bg.particleColor}, transparent)`,
          ].join(','),
          animation: 'particleTwinkle 8s ease-in-out infinite',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,.5) 100%)',
        }}
      />
    </div>
  );
}
