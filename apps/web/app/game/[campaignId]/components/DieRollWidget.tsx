'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/shared/Button';

export interface DieRollResult {
  raw: number;
  modifier: number;
  total: number;
  dc: number;
  outcome: string;
}

export interface DieRollWidgetProps {
  onRoll: () => void;
  result?: DieRollResult | null;
  primaryStat: string;
  loading: boolean;
  autoStart?: boolean;
}

function outcomeStyle(outcome: string): string {
  const o = outcome.toLowerCase();
  if (o === 'critical_success') return 'text-amber-300';
  if (o === 'success') return 'text-success';
  if (o === 'partial') return 'text-warning';
  if (o === 'failure') return 'text-danger';
  if (o === 'critical_failure') return 'text-hp-wounded';
  return 'text-text-primary';
}

function outcomeLabel(outcome: string): string {
  return outcome.replace(/_/g, ' ').toUpperCase();
}

export function DieRollWidget({
  onRoll,
  result,
  primaryStat,
  loading,
  autoStart = false,
}: DieRollWidgetProps) {
  const [displayNum, setDisplayNum] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'landed'>('idle');

  useEffect(() => {
    if (autoStart && phase === 'idle' && !result) {
      setPhase('rolling');
      onRoll();
    }
  }, [autoStart, phase, result, onRoll]);

  useEffect(() => {
    if (!loading && result) {
      setPhase('rolling');
      let ticks = 0;
      const id = window.setInterval(() => {
        ticks += 1;
        setDisplayNum(Math.floor(Math.random() * 20) + 1);
        if (ticks >= 10) {
          window.clearInterval(id);
          setDisplayNum(result.raw);
          setPhase('landed');
        }
      }, 150);
      return () => window.clearInterval(id);
    }
    return undefined;
  }, [loading, result]);

  const handleRoll = () => {
    if (loading || phase === 'rolling') return;
    setPhase('rolling');
    onRoll();
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-accent/50 bg-surface-2 shadow-glow"
      >
        <motion.span
          key={displayNum}
          initial={phase === 'rolling' ? { scale: 0.7, opacity: 0.5 } : false}
          animate={{ scale: phase === 'landed' ? [1.2, 1] : 1, opacity: 1 }}
          className="font-serif text-4xl font-bold text-text-primary"
        >
          {displayNum}
        </motion.span>
      </motion.div>

      {!result && phase !== 'rolling' ? (
        <Button variant="primary" onClick={handleRoll} loading={loading} className="min-w-[120px]">
          Roll
        </Button>
      ) : null}

      {loading && !result ? (
        <p className="text-body-sm text-text-secondary">Resolving…</p>
      ) : null}

      <AnimatePresence>
        {phase === 'landed' && result ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 text-center"
          >
            <p className="text-body-sm text-text-secondary">
              Rolled {result.raw}
              {result.modifier >= 0 ? ' + ' : ' − '}
              {Math.abs(result.modifier)} ({primaryStat}) ={' '}
              <span className="font-medium text-text-primary">{result.total}</span> vs DC {result.dc}
            </p>
            <p className={`font-serif text-h3 font-semibold ${outcomeStyle(result.outcome)}`}>
              {outcomeLabel(result.outcome)}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
