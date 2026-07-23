'use client';

import { useEffect, useRef, useState } from 'react';

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
  choiceLabel?: string;
  loading: boolean;
  /** Fires after the full reveal sequence finishes (min ~3s on the result). */
  onComplete?: () => void;
}

type RevealPhase = 'idle' | 'rolling' | 'landed' | 'modifier' | 'outcome';

const OUTCOME_COLORS: Record<string, string> = {
  success: '#10B981',
  partial: '#F59E0B',
  failure: '#EF4444',
  critical_success: '#D4AF37',
  critical_failure: '#991B1B',
};

/** Minimum time the outcome breakdown stays visible before auto-continue. */
const RESULT_HOLD_MS = 3000;

function outcomeColor(outcome: string): string {
  return OUTCOME_COLORS[outcome.toLowerCase()] ?? '#F8FAFC';
}

function outcomeLabel(outcome: string): string {
  return outcome.replace(/_/g, ' ').toUpperCase();
}

export function DieRollWidget({
  onRoll,
  result,
  primaryStat,
  choiceLabel,
  loading,
  onComplete,
}: DieRollWidgetProps) {
  const [phase, setPhase] = useState<RevealPhase>('idle');
  const [displayNum, setDisplayNum] = useState(20);
  const iterations = useRef(0);
  const completed = useRef(false);

  // Number cycling: 70ms ticks, land on the real roll once we have the result
  // and at least 18 iterations have played.
  useEffect(() => {
    if (phase !== 'rolling') return undefined;
    const id = window.setInterval(() => {
      iterations.current += 1;
      if (iterations.current >= 18 && result) {
        window.clearInterval(id);
        setDisplayNum(result.raw);
        setPhase('landed');
      } else {
        setDisplayNum(Math.floor(Math.random() * 20) + 1);
      }
    }, 70);
    return () => window.clearInterval(id);
  }, [phase, result]);

  // Stepped reveal after landing: modifier → outcome → hold ≥3s (or Continue) → complete.
  useEffect(() => {
    if (phase === 'landed') {
      const t = window.setTimeout(() => setPhase('modifier'), 400);
      return () => window.clearTimeout(t);
    }
    if (phase === 'modifier') {
      const t = window.setTimeout(() => setPhase('outcome'), 500);
      return () => window.clearTimeout(t);
    }
    if (phase === 'outcome' && !completed.current) {
      const t = window.setTimeout(() => {
        if (completed.current) return;
        completed.current = true;
        onComplete?.();
      }, RESULT_HOLD_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, onComplete]);

  const handleRoll = () => {
    if (loading || phase !== 'idle') return;
    iterations.current = 0;
    setPhase('rolling');
    onRoll();
  };

  const handleContinue = () => {
    if (phase !== 'outcome' || completed.current) return;
    completed.current = true;
    onComplete?.();
  };

  const modColor =
    result && result.modifier > 0 ? '#10B981' : result && result.modifier < 0 ? '#EF4444' : '#94A3B8';
  const modSign = result && result.modifier < 0 ? '−' : '+';

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <style>{`
        @keyframes d20Tumble {
          0% { transform: rotateX(0) rotateY(0) rotateZ(0) scale(1); }
          30% { transform: rotateX(200deg) rotateY(120deg) rotateZ(60deg) scale(1.08); }
          60% { transform: rotateX(340deg) rotateY(280deg) rotateZ(160deg) scale(0.96); }
          100% { transform: rotateX(360deg) rotateY(360deg) rotateZ(360deg) scale(1); }
        }
        @keyframes d20Glow {
          0%, 100% { box-shadow: 0 0 20px rgba(14,150,150,.35); }
          50% { box-shadow: 0 0 60px rgba(14,150,150,.6); }
        }
        @keyframes dieFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes outcomePop {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {choiceLabel ? (
        <p className="text-center text-sm text-text-muted">
          You chose: <span className="font-semibold text-text-secondary">{choiceLabel}</span>{' '}
          <span className="capitalize">({primaryStat})</span>
        </p>
      ) : null}

      <div
        className="flex items-center justify-center"
        style={{
          width: 140,
          height: 140,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #0e9696, #00674f)',
          animation:
            phase === 'rolling'
              ? 'd20Tumble 1.2s cubic-bezier(.2,.8,.3,1) infinite, d20Glow 1.2s ease-in-out infinite'
              : undefined,
          boxShadow: phase !== 'rolling' ? '0 0 24px rgba(14,150,150,.25)' : undefined,
          transition: 'transform .3s ease',
        }}
      >
        <span className="text-[48px] font-extrabold text-white">
          {phase === 'idle' ? '20' : displayNum}
        </span>
      </div>

      {phase === 'idle' ? (
        <button
          type="button"
          onClick={handleRoll}
          disabled={loading}
          className="rounded-[10px] px-8 py-3 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.04] disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, #0e9696, #00674f)',
            boxShadow: '0 4px 16px rgba(14,150,150,.3)',
          }}
        >
          {loading ? 'Resolving…' : 'Roll d20'}
        </button>
      ) : null}

      {phase === 'rolling' && !result ? (
        <p className="text-xs text-text-muted">The die tumbles…</p>
      ) : null}

      {(phase === 'modifier' || phase === 'outcome') && result ? (
        <div
          className="flex flex-col items-center gap-1.5 text-center"
          style={{ animation: 'dieFadeIn .4s ease both' }}
        >
          <p className="text-sm text-text-secondary">
            <span style={{ color: modColor }}>
              {modSign} {Math.abs(result.modifier)}{' '}
              <span className="capitalize">({primaryStat})</span>
            </span>
          </p>
          <p className="text-lg font-bold text-text-primary">= {result.total}</p>
          <p className="text-sm text-text-muted">vs DC {result.dc}</p>
        </div>
      ) : null}

      {phase === 'outcome' && result ? (
        <div className="flex flex-col items-center gap-4">
          <p
            className="text-center text-xl font-bold uppercase tracking-[3px]"
            style={{ color: outcomeColor(result.outcome), animation: 'outcomePop .35s ease both' }}
          >
            {outcomeLabel(result.outcome)}
          </p>
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary"
          >
            Continue
          </button>
        </div>
      ) : null}
    </div>
  );
}
