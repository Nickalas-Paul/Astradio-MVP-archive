'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/shared/Card';

export interface LootRevealProps {
  item: {
    name: string;
    description: string;
    category: string;
    rarity: string;
    statModifiers: Record<string, number>;
    classAffinityBonus?: boolean;
  } | null;
  show: boolean;
}

function rarityBorder(rarity: string): string {
  const r = rarity.toLowerCase();
  if (r === 'legendary') return 'border-rarity-legendary';
  if (r === 'rare') return 'border-rarity-rare';
  if (r === 'uncommon') return 'border-rarity-uncommon';
  return 'border-rarity-common';
}

export function LootReveal({ item, show }: LootRevealProps) {
  return (
    <AnimatePresence>
      {show && item ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.35 }}
        >
          <Card
            elevation="floating"
            size="md"
            className={`space-y-3 border-2 ${rarityBorder(item.rarity)}`}
          >
            <p className="text-caption uppercase tracking-wide text-accent">Loot found</p>
            <h3 className="font-serif text-h3 text-text-primary">{item.name}</h3>
            <p className="text-body-sm text-text-muted">{item.description}</p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border px-2 py-0.5 text-caption capitalize text-text-secondary">
                {item.rarity}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-caption capitalize text-text-secondary">
                {item.category}
              </span>
              {Object.entries(item.statModifiers || {}).map(([stat, val]) => (
                <span
                  key={stat}
                  className="rounded-full bg-accent/10 px-2 py-0.5 text-caption text-accent"
                >
                  {val > 0 ? '+' : ''}
                  {val} {stat}
                </span>
              ))}
            </div>
            {item.classAffinityBonus ? (
              <p className="text-caption text-accent">Class affinity bonus applies to this piece.</p>
            ) : null}
            <p className="text-caption text-text-muted">Added to inventory</p>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
