'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/shared/Card';

export interface StreakMilestoneProps {
  messages: string[];
  show: boolean;
}

export function StreakMilestone({ messages, show }: StreakMilestoneProps) {
  return (
    <AnimatePresence>
      {show && messages.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <Card elevation="raised" size="sm" highlighted className="space-y-1">
            <p className="text-caption uppercase tracking-wide text-accent">Milestone</p>
            {messages.map((m) => (
              <p key={m} className="text-body-sm text-text-primary">
                {m}
              </p>
            ))}
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
