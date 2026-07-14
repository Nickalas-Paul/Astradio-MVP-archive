'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export interface AuraModalProps {
  isOpen: boolean;
  onClose: () => void;
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

function PlaceholderContent() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <p className="text-text-muted text-lg font-medium">
        <span className="text-accent">Aura</span> Visualization
      </p>
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

export function AuraModal({ isOpen, onClose }: AuraModalProps) {
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
                <PlaceholderContent />
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
                <PlaceholderContent />
              </motion.div>
            )}
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
