'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

export interface ChapterTransitionProps {
  oldChapter: { house: number; domain: string; label: string };
  newChapter: { house: number; domain: string; label: string };
  relicReward?: {
    name: string;
    description: string;
    rarity?: string;
    statModifiers?: Record<string, number>;
  } | null;
  show: boolean;
  onDismiss: () => void;
}

export function ChapterTransition({
  oldChapter,
  newChapter,
  relicReward,
  show,
  onDismiss,
}: ChapterTransitionProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-full max-w-lg space-y-8 text-center">
            <motion.p
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="font-serif text-h2 text-text-muted"
            >
              {oldChapter.label}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              className="font-serif text-display text-text-primary"
            >
              {newChapter.label}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="text-body-sm text-text-secondary"
            >
              A new chapter begins in house {newChapter.house} — the domain of {newChapter.domain}.
            </motion.p>
            {relicReward ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6 }}>
                <Card elevation="floating" size="md" className="border-rarity-legendary border-2 text-left">
                  <p className="text-caption uppercase text-accent">Chapter relic</p>
                  <h3 className="mt-1 font-serif text-h4">{relicReward.name}</h3>
                  <p className="mt-2 text-body-sm text-text-muted">{relicReward.description}</p>
                </Card>
              </motion.div>
            ) : null}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
              <Button variant="primary" onClick={onDismiss}>
                Continue
              </Button>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
