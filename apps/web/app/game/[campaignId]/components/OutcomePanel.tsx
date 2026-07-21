'use client';

import type { ReactNode } from 'react';
import { HPBar } from './HPBar';
import { LootReveal } from './LootReveal';
import { StreakMilestone } from './StreakMilestone';
import type { CharacterHP, CombatResolutionPayload } from '@/lib/game-api';

export interface OutcomePanelProps {
  narration: string;
  combat: CombatResolutionPayload;
  hp: CharacterHP;
  previousHp?: number;
  primaryStat: string;
  dc: number;
  streak?: number;
  milestones?: string[];
  onOpenInventory?: () => void;
  onOpenCharacter?: () => void;
}

const OUTCOME_COLORS: Record<string, string> = {
  success: '#10B981',
  partial: '#F59E0B',
  failure: '#EF4444',
  critical_success: '#D4AF37',
  critical_failure: '#991B1B',
};

function Step({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <div style={{ animation: `outcomeFadeIn .5s ease ${delay}ms both` }}>{children}</div>
  );
}

/** Dramatic stepped reveal of the encounter result. */
export function OutcomePanel({
  narration,
  combat,
  hp,
  previousHp,
  primaryStat,
  dc,
  streak,
  milestones = [],
  onOpenInventory,
  onOpenCharacter,
}: OutcomePanelProps) {
  const outcome = (combat.outcome || 'unknown').toLowerCase();
  const color = OUTCOME_COLORS[outcome] ?? '#F8FAFC';
  const die = combat.dieRoll;
  const isCrit = outcome === 'critical_success';

  return (
    <div className="mx-auto max-w-2xl space-y-5 py-6">
      <style>{`
        @keyframes outcomeFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes outcomeScaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <Step delay={0}>
        <div className="text-center">
          <p className="text-xl font-bold uppercase tracking-[3px]" style={{ color }}>
            {(combat.outcome || 'resolved').replace(/_/g, ' ')}
          </p>
          {die ? (
            <p className="mt-1.5 text-[13px] text-text-muted">
              Rolled {die.raw}
              {die.modifier >= 0 ? ' + ' : ' − '}
              {Math.abs(die.modifier ?? 0)} <span className="capitalize">({primaryStat})</span> ={' '}
              {die.total} vs DC {dc}
            </p>
          ) : null}
        </div>
      </Step>

      {narration ? (
        <Step delay={200}>
          <p className="text-center font-serif text-xl leading-relaxed text-text-primary">
            {narration}
          </p>
        </Step>
      ) : null}

      {combat.damageDealt > 0 ? (
        <Step delay={400}>
          <div
            className="space-y-1 rounded-xl p-4 text-center"
            style={{ background: 'rgba(239,68,68,.06)', border: '1px solid #EF4444' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-danger">
              Damage Taken
            </p>
            <p className="text-[28px] font-bold text-danger">−{combat.damageDealt}</p>
            {combat.woundedTriggered ? (
              <p className="text-xs font-medium text-danger">You have fallen. Wounded.</p>
            ) : null}
            {combat.streakSaved ? (
              <p className="text-xs font-medium text-accent">Streak save. You barely held on.</p>
            ) : null}
          </div>
        </Step>
      ) : null}

      {isCrit && combat.healAmount > 0 ? (
        <Step delay={400}>
          <div
            className="space-y-1 rounded-xl p-4 text-center"
            style={{ background: 'rgba(16,185,129,.06)', border: '1px solid #10B981' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-success">
              Critical Recovery
            </p>
            <p className="text-[28px] font-bold text-success">+{combat.healAmount}</p>
          </div>
        </Step>
      ) : null}

      {combat.loot?.dropped && combat.loot.item ? (
        <div style={{ animation: 'outcomeScaleIn .45s ease 600ms both' }}>
          <LootReveal
            show
            item={{ ...combat.loot.item, classAffinityBonus: false }}
          />
        </div>
      ) : null}

      {milestones.length > 0 ? (
        <Step delay={700}>
          <StreakMilestone show messages={milestones} />
        </Step>
      ) : null}

      <Step delay={800}>
        <HPBar
          current={hp.current}
          max={hp.max}
          wounded={hp.wounded}
          woundedDaysRemaining={hp.woundedDaysRemaining}
          previousValue={previousHp}
          size="lg"
        />
      </Step>

      <Step delay={1000}>
        <div className="space-y-3 pt-2 text-center">
          <p className="text-sm font-bold text-text-primary">Encounter resolved</p>
          <p className="text-xs text-text-muted">
            Your next encounter appears tomorrow. Keep the streak alive
            {typeof streak === 'number' ? ` (${streak})` : ''}.
          </p>
          <div className="flex justify-center gap-3">
            {onOpenInventory ? (
              <button
                type="button"
                onClick={onOpenInventory}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
              >
                Manage Inventory
              </button>
            ) : null}
            {onOpenCharacter ? (
              <button
                type="button"
                onClick={onOpenCharacter}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
              >
                View Character
              </button>
            ) : null}
          </div>
        </div>
      </Step>
    </div>
  );
}
