'use client';

import { motion } from 'framer-motion';

export interface HPBarProps {
  current: number;
  max: number;
  wounded: boolean;
  woundedDaysRemaining?: number;
  animate?: boolean;
  previousValue?: number;
  size?: 'sm' | 'md' | 'lg';
}

function hpColor(ratio: number, wounded: boolean): string {
  if (wounded) return 'bg-hp-wounded';
  if (ratio < 0.25) return 'bg-hp-low';
  if (ratio < 0.5) return 'bg-hp-mid';
  return 'bg-hp-full';
}

const HEIGHT: Record<NonNullable<HPBarProps['size']>, string> = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

export function HPBar({
  current,
  max,
  wounded,
  woundedDaysRemaining = 0,
  animate = true,
  size = 'md',
}: HPBarProps) {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, current / safeMax));
  const pct = Math.round(ratio * 100);

  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between gap-2 text-body-sm">
        <span className="text-text-secondary">
          {current} / {max} HP
        </span>
        {wounded ? (
          <span className="rounded-full bg-hp-wounded/30 px-2 py-0.5 text-caption font-medium text-red-200 animate-pulse">
            WOUNDED
            {woundedDaysRemaining > 0 ? ` · ${woundedDaysRemaining}d` : ''}
          </span>
        ) : null}
      </div>
      <div className={`w-full overflow-hidden rounded-full bg-white/10 ${HEIGHT[size]}`}>
        <motion.div
          className={`h-full rounded-full ${hpColor(ratio, wounded)} ${wounded ? 'opacity-80 animate-pulse' : ''}`}
          initial={animate ? { width: 0 } : false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
