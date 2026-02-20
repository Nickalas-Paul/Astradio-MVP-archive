'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCompositionJob } from '../hooks/useCompositionJob';
import { useChartsStore } from '../store';
import { useUIStore } from '../store';
import type { GenerateCardProps, CompositionRequest } from '../types';

const genres = [
  { id: 'ambient', label: '🌙 Ambient', description: 'Atmospheric and ethereal' },
  { id: 'classical', label: '🎼 Classical', description: 'Orchestral and refined' },
  { id: 'jazz', label: '🎷 Jazz', description: 'Improvisational and soulful' },
  { id: 'electronic', label: '⚡ Electronic', description: 'Synthetic and energetic' },
  { id: 'lofi', label: '📻 Lo-Fi', description: 'Chill and nostalgic' },
  { id: 'house', label: '🏠 House', description: 'Rhythmic and danceable' },
] as const;

export function GenerateCard({
  selectedGenre,
  onGenreChange,
  onGenerate,
  isGenerating,
  className = '',
}: GenerateCardProps) {
  const { addToast } = useUIStore();
  const { stage, pct, error, start, cancel, isGenerating: jobGenerating } = useCompositionJob();
  const [showGenreDetails, setShowGenreDetails] = useState(false);

  const handleGenerate = async () => {
    try {
      const active = useChartsStore.getState().charts[0];
      const request = {
        chartA: active?.id || 'natal',
        genre: selectedGenre as CompositionRequest['genre'],
        durationSec: 30,
        seed: (window as any).__lastSeed || 'fixed-seed',
        controlHash: (window as any).__lastControlHash || undefined,
      } as CompositionRequest;

      await start(request);
      onGenerate(request);
      
      addToast({
        type: 'info',
        title: 'Composition started',
        message: 'Your 30-second track is being generated...',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Generation failed',
        message: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    }
  };

  const handleCancel = () => {
    cancel();
    addToast({
      type: 'info',
      title: 'Generation cancelled',
      message: 'Composition generation has been stopped.',
    });
  };

  const getStageMessage = () => {
    switch (stage) {
      case 'queued':
        return 'Queued for generation...';
      case 'preparing':
        return 'Preparing composition...';
      case 'generating':
        return 'Generating musical layers...';
      case 'mixing':
        return 'Mixing and mastering...';
      case 'ready':
        return 'Composition ready!';
      case 'error':
        return 'Generation failed';
      default:
        return 'Ready to generate';
    }
  };

  const isCurrentlyGenerating = isGenerating || jobGenerating;
  const canGenerate = !isCurrentlyGenerating && stage !== 'ready';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-surface-1/95 border border-border rounded-xl shadow-md p-6 ${className}`}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            Generate 30-Second Track
          </h3>
          <p className="text-sm text-text-secondary">
            Create a personalized musical composition based on your astrological chart
          </p>
        </div>

        {/* Genre Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-text">
            Musical Genre
          </label>
          
          <div className="grid grid-cols-2 gap-2">
            {genres.map((genre) => (
              <button
                key={genre.id}
                onClick={() => onGenreChange(genre.id)}
                className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                  selectedGenre === genre.id
                    ? 'border-emerald bg-emerald/10 text-emerald'
                    : 'border-border bg-bg hover:bg-bgElev hover:border-emerald/50'
                }`}
                disabled={isCurrentlyGenerating}
              >
                <div className="text-sm font-medium">{genre.label}</div>
                <div className="text-xs text-subtext mt-1">{genre.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generation Status */}
        {isCurrentlyGenerating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-text">{getStageMessage()}</span>
              <span className="text-sm text-subtext">{pct}%</span>
            </div>
            
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            
            {error && (
              <div className="p-3 bg-danger/10 border border-danger rounded-xl">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {isCurrentlyGenerating ? (
            <button
              onClick={handleCancel}
              className="btn-secondary flex-1"
            >
              Cancel Generation
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="btn-primary flex-1"
            >
              {stage === 'ready' ? 'Generate New Track' : 'Generate 30s Track'}
            </button>
          )}
          
          <button
            onClick={() => setShowGenreDetails(!showGenreDetails)}
            className="btn-ghost px-4"
            aria-label="Show genre details"
          >
            <svg 
              className={`w-5 h-5 transition-transform ${showGenreDetails ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Genre Details */}
        {showGenreDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-bg rounded-xl border border-border"
          >
            <h4 className="text-sm font-semibold text-text mb-3">
              How genres influence your composition:
            </h4>
            <ul className="space-y-2 text-xs text-subtext">
              <li>• <strong>Ambient:</strong> Slow tempo, atmospheric textures, minimal rhythm</li>
              <li>• <strong>Classical:</strong> Orchestral instruments, complex harmonies, dynamic range</li>
              <li>• <strong>Jazz:</strong> Improvisational elements, syncopated rhythms, rich harmonies</li>
              <li>• <strong>Electronic:</strong> Synthesized sounds, steady beats, modern production</li>
              <li>• <strong>Lo-Fi:</strong> Vintage textures, relaxed tempo, nostalgic atmosphere</li>
              <li>• <strong>House:</strong> Four-on-the-floor rhythm, uplifting energy, danceable</li>
            </ul>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
