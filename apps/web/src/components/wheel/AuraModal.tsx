'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ComposeVisualControls } from '../../core/compose-visual-controls';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useAudioPlayerStore } from '../../store/audio-player';
import type { AuraRawSnapshot } from './aura-raw-snapshot';

const HarmonicLandscape = dynamic(
  () => import('./HarmonicLandscape').then((m) => ({ default: m.HarmonicLandscape })),
  { ssr: false, loading: () => null },
);

export interface AuraModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawSnapshot?: AuraRawSnapshot;
  composeControls?: ComposeVisualControls | null;
  linkedExportId?: string | null;
  onWebGLError?: () => void;
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

function WebGLFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#0d0618] px-6 text-center">
      <p className="max-w-sm text-sm text-white/70">
        Your browser doesn&apos;t support 3D visualization
      </p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
      >
        Close
      </button>
    </div>
  );
}

function SceneContent({
  rawSnapshot,
  composeControls,
  linkedExportId,
  isOpen,
  clearSelectionSignal,
  onSelectionChange,
  onWebGLError,
  webglFailed,
  onClose,
}: {
  rawSnapshot?: AuraRawSnapshot;
  composeControls?: ComposeVisualControls | null;
  linkedExportId?: string | null;
  isOpen: boolean;
  clearSelectionSignal: number;
  onSelectionChange: (hasSelection: boolean) => void;
  onWebGLError?: () => void;
  webglFailed: boolean;
  onClose: () => void;
}) {
  if (!rawSnapshot) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="text-text-muted text-sm">No snapshot data available</p>
      </div>
    );
  }

  if (webglFailed) {
    return <WebGLFallback onClose={onClose} />;
  }

  return (
    <HarmonicLandscape
      snapshot={rawSnapshot}
      composeControls={composeControls}
      linkedExportId={linkedExportId}
      active={isOpen}
      clearSelectionSignal={clearSelectionSignal}
      onSelectionChange={onSelectionChange}
      onWebGLError={onWebGLError}
    />
  );
}

function DragHandle() {
  return (
    <div className="flex justify-center pt-3 pb-1" aria-hidden>
      <div className="h-1 w-10 rounded-full bg-white/20" />
    </div>
  );
}

export function AuraModal({
  isOpen,
  onClose,
  rawSnapshot,
  composeControls = null,
  linkedExportId = null,
  onWebGLError,
}: AuraModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [hasPlanetSelection, setHasPlanetSelection] = useState(false);
  const [clearSelectionSignal, setClearSelectionSignal] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setHasPlanetSelection(false);
      setWebglFailed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void useAudioPlayerStore.getState().resumeAnalyserContext();
  }, [isOpen]);

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
      if (event.key !== 'Escape') return;
      if (hasPlanetSelection) {
        event.preventDefault();
        setClearSelectionSignal((value) => value + 1);
        setHasPlanetSelection(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasPlanetSelection, isOpen, onClose]);

  const handleWebGLError = () => {
    setWebglFailed(true);
    onWebGLError?.();
  };

  const sceneProps = {
    rawSnapshot,
    composeControls,
    linkedExportId,
    isOpen,
    clearSelectionSignal,
    onSelectionChange: setHasPlanetSelection,
    onWebGLError: handleWebGLError,
    webglFailed,
    onClose,
  };

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
                className="relative flex h-[min(80vh,40rem)] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0618] shadow-xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              >
                <CloseButton onClose={onClose} />
                <div className="relative min-h-0 flex-1 overflow-hidden p-0">
                  <SceneContent {...sceneProps} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="aura-modal-mobile"
                role="dialog"
                aria-modal="true"
                aria-label="Aura visualization"
                className="relative flex h-[60vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 border-b-0 bg-[#0d0618] shadow-xl"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              >
                <DragHandle />
                <CloseButton onClose={onClose} />
                <div className="relative min-h-0 flex-1 overflow-hidden p-0">
                  <SceneContent {...sceneProps} />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
