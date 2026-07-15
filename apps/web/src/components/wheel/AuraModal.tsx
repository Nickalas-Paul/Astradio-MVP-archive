'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import {
  dominantElementLabel,
  type AuraRawSnapshot,
} from './aura-raw-snapshot';

export interface AuraModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawSnapshot?: AuraRawSnapshot;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close Aura visualization"
      className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:text-white transition-colors"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function PlaceholderContent({ rawSnapshot }: { rawSnapshot?: AuraRawSnapshot }) {
  const dominant = rawSnapshot ? dominantElementLabel(rawSnapshot.dominantElements) : null;
  const elements = rawSnapshot?.dominantElements;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <p className="text-text-muted text-lg font-medium">
        <span className="text-accent">Aura</span> Visualization
      </p>
      {rawSnapshot ? (
        <div className="w-full max-w-sm rounded-xl border border-border/80 bg-bg/40 px-4 py-3 text-left text-sm">
          <p className="text-text-secondary">
            Planets: <span className="text-text-primary">{rawSnapshot.planets.length}</span>
          </p>
          <p className="text-text-secondary mt-1">
            Aspects: <span className="text-text-primary">{rawSnapshot.aspects.length}</span>
          </p>
          <p className="text-text-secondary mt-1">
            Dominant:{' '}
            <span className="text-accent capitalize">{dominant}</span>
            {elements ? (
              <span className="text-text-muted text-xs block mt-1">
                fire {Math.round(elements.fire * 100)}% · earth {Math.round(elements.earth * 100)}% · air{' '}
                {Math.round(elements.air * 100)}% · water {Math.round(elements.water * 100)}%
              </span>
            ) : null}
          </p>
        </div>
      ) : (
        <p className="text-text-muted text-sm">No snapshot data available</p>
      )}
    </div>
  );
}

function DragHandle() {
  return (
    <div className="flex justify-center pt-3 pb-1" aria-hidden>
      <div className="h-1 w-10 rounded-full bg-white/20" />
    </div>
  );
}

export function AuraModal({ isOpen, onClose, rawSnapshot }: AuraModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !rawSnapshot) return;
    console.log('[AuraModal] rawSnapshot', {
      planets: rawSnapshot.planets.map((planet) => ({ name: planet.name, lon: planet.lon })),
      aspectCount: rawSnapshot.aspects.length,
      dominantElements: rawSnapshot.dominantElements,
      dominantElement: dominantElementLabel(rawSnapshot.dominantElements),
      moonPhase: rawSnapshot.moonPhase,
    });
  }, [isOpen, rawSnapshot]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div key="aura-modal-root" className="fixed inset-0 z-50">
          <motion.div
            key="aura-modal-backdrop"
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <div
            className={`absolute inset-0 flex ${isDesktop ? 'items-center justify-center p-4' : 'items-end'}`}
          >
            {isDesktop ? (
              <motion.div
                key="aura-modal-desktop"
                role="dialog"
                aria-modal="true"
                aria-label="Aura visualization"
                className="relative flex w-full max-w-2xl aspect-square flex-col overflow-hidden rounded-2xl bg-surface border border-border shadow-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              >
                <CloseButton onClose={onClose} />
                <PlaceholderContent rawSnapshot={rawSnapshot} />
              </motion.div>
            ) : (
              <motion.div
                key="aura-modal-mobile"
                role="dialog"
                aria-modal="true"
                aria-label="Aura visualization"
                className="relative flex h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface border border-border border-b-0 shadow-xl"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              >
                <DragHandle />
                <CloseButton onClose={onClose} />
                <PlaceholderContent rawSnapshot={rawSnapshot} />
              </motion.div>
            )}
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
