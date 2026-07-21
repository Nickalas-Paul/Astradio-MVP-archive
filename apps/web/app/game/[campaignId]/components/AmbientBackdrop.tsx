'use client';

import { getElementColors, type GameElement } from '@/lib/class-display';

export interface AmbientBackdropProps {
  element: GameElement;
}

const BASE_GRADIENTS: Record<GameElement, string> = {
  Earth: 'linear-gradient(135deg, #0C1320 0%, #0a1520 35%, #0d1a18 65%, #0C1320 100%)',
  Fire: 'linear-gradient(135deg, #0C1320 0%, #1a0a0a 35%, #1a1008 65%, #0C1320 100%)',
  Water: 'linear-gradient(135deg, #0C1320 0%, #080c1a 35%, #0a0d1a 65%, #0C1320 100%)',
  Air: 'linear-gradient(135deg, #0C1320 0%, #0f1318 35%, #0d1015 65%, #0C1320 100%)',
};

/**
 * Full-viewport layered ambient background for the Campaign surface.
 * Sits behind DungeonLayout; shifts palette with the encounter element.
 */
export function AmbientBackdrop({ element }: AmbientBackdropProps) {
  const colors = getElementColors(element);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <style>{`
        @keyframes ambientDrift {
          0% { transform: translate(0,0) scale(1); }
          33% { transform: translate(30px,-20px) scale(1.1); }
          66% { transform: translate(-20px,10px) scale(0.95); }
          100% { transform: translate(0,0) scale(1); }
        }
      `}</style>

      <div
        className="absolute inset-0 transition-[background] duration-1000"
        style={{ background: BASE_GRADIENTS[element] ?? BASE_GRADIENTS.Earth }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 55% 25%, ${colors.glowColor}, transparent 55%)`,
          animation: 'ambientDrift 25s ease-in-out infinite',
          opacity: 0.7,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 30% 70%, ${colors.orbColor}, transparent 40%)`,
          animation: 'ambientDrift 18s ease-in-out infinite reverse',
          opacity: 0.4,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(14,150,150,.015) 0px, rgba(14,150,150,.015) 1px, transparent 1px, transparent 60px),' +
            'repeating-linear-gradient(90deg, rgba(14,150,150,.015) 0px, rgba(14,150,150,.015) 1px, transparent 1px, transparent 60px)',
          opacity: 0.5,
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
