'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/shared/Card';
import { HPBar } from './HPBar';
import type { CharacterHP, CombatResolutionPayload } from '@/lib/game-api';

export interface OutcomePanelProps {
  narration: string;
  combat: CombatResolutionPayload;
  hp: CharacterHP;
  previousHp?: number;
}

export function OutcomePanel({ narration, combat, hp, previousHp }: OutcomePanelProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card elevation="raised" size="lg" className="space-y-5 border-accent/30">
        <div>
          <p className="text-caption uppercase tracking-wide text-accent">Outcome</p>
          <p className="mt-3 font-serif text-lg leading-relaxed text-text-secondary">{narration}</p>
        </div>

        <div className="grid gap-3 text-body-sm text-text-secondary sm:grid-cols-2">
          {combat.damageDealt > 0 ? <p>Damage taken: {combat.damageDealt}</p> : null}
          {combat.healAmount > 0 ? <p>Healed: {combat.healAmount}</p> : null}
          <p>
            HP: {combat.hpBefore} → {combat.hpAfter}
          </p>
          {combat.woundedTriggered ? (
            <p className="font-medium text-danger">You have fallen — wounded.</p>
          ) : null}
          {combat.streakSaved ? (
            <p className="font-medium text-accent">Streak save! You barely held on.</p>
          ) : null}
        </div>

        <HPBar
          current={hp.current}
          max={hp.max}
          wounded={hp.wounded}
          woundedDaysRemaining={hp.woundedDaysRemaining}
          previousValue={previousHp}
          size="lg"
        />
      </Card>
    </motion.div>
  );
}
