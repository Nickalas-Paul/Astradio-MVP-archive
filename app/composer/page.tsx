'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { GenerateCard } from '../../src/components/GenerateCard';
import { LayerMixer } from '../../src/components/LayerMixer';
import { useCompositionJob } from '../../src/hooks/useCompositionJob';
import { useUIStore } from '../../src/store';
import type { LayerMeta } from '../../src/types';

const genreTabs = [
  { id: 'ambient', label: '🌙 Ambient', description: 'Atmospheric and ethereal' },
  { id: 'classical', label: '🎼 Classical', description: 'Orchestral and refined' },
  { id: 'jazz', label: '🎷 Jazz', description: 'Improvisational and soulful' },
  { id: 'electronic', label: '⚡ Electronic', description: 'Synthetic and energetic' },
  { id: 'lofi', label: '📻 Lo-Fi', description: 'Chill and nostalgic' },
  { id: 'house', label: '🏠 House', description: 'Rhythmic and danceable' },
] as const;

export default function ComposerPage() {
  const [selectedGenre, setSelectedGenre] = useState('ambient');
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [activeTab, setActiveTab] = useState('ambient');
  const { addToast } = useUIStore();
  const { stage, pct, audioUrl, layers: jobLayers, start, cancel, isGenerating } = useCompositionJob();

  // Update layers when job completes
  useEffect(() => {
    if (jobLayers && jobLayers.length > 0) {
      setLayers(jobLayers);
    }
  }, [jobLayers]);

  const handleGenerate = async (request: any) => {
    try {
      await start(request);
      addToast({
        type: 'info',
        title: 'Composition started',
        message: 'Your 60-second track is being generated...',
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Generation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleLayerChange = (key: string, changes: Partial<LayerMeta>) => {
    setLayers(prev => prev.map(layer => 
      layer.key === key ? { ...layer, ...changes } : layer
    ));
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

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold text-text">
            Composer
          </h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Create and refine your astrological musical compositions with full control over every layer and element.
          </p>
        </motion.div>

        {/* Genre Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-text">
              Select Genre
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {genreTabs.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => {
                    setActiveTab(genre.id);
                    setSelectedGenre(genre.id);
                  }}
                  className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                    activeTab === genre.id
                      ? 'border-emerald bg-emerald/10 text-emerald'
                      : 'border-border bg-bg hover:bg-bgElev hover:border-emerald/50'
                  }`}
                  disabled={isGenerating}
                >
                  <div className="text-lg mb-1">{genre.label}</div>
                  <div className="text-xs text-subtext">{genre.description}</div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Generation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            <GenerateCard
              selectedGenre={selectedGenre}
              onGenreChange={setSelectedGenre}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />

            {/* Generation Status */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="card"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-text">
                      Generation Progress
                    </h3>
                    <button
                      onClick={cancel}
                      className="text-sm text-danger hover:text-danger/80"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <div className="space-y-3">
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
                  </div>
                </div>
              </motion.div>
            )}

            {/* Timeline Events (Phase B feature) */}
            <div className="card">
              <h3 className="text-lg font-semibold text-text mb-4">
                Timeline Events
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald rounded-full"></div>
                  <span className="text-sm text-text">0:00 - Opening chord progression</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-violet rounded-full"></div>
                  <span className="text-sm text-text">0:15 - Melody introduction</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-warning rounded-full"></div>
                  <span className="text-sm text-text">0:30 - Rhythm section enters</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span className="text-sm text-text">0:45 - Texture layers build</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-emerald rounded-full"></div>
                  <span className="text-sm text-text">1:00 - Final cadence</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Layer Mixer */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <LayerMixer
              layers={layers}
              onLayerChange={handleLayerChange}
            />

            {/* Composition Actions */}
            {layers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="card mt-6"
              >
                <h3 className="text-lg font-semibold text-text mb-4">
                  Composition Actions
                </h3>
                
                <div className="space-y-3">
                  <button className="btn-primary w-full">
                    Save Composition
                  </button>
                  <button className="btn-secondary w-full">
                    Export Audio
                  </button>
                  <button className="btn-secondary w-full">
                    Share Composition
                  </button>
                  <button className="btn-ghost w-full">
                    Create Variation
                  </button>
                </div>
              </motion.div>
            )}

            {/* Tips */}
            <div className="card bg-bgElev/50 mt-6">
              <h3 className="text-sm font-semibold text-text mb-3">
                Composer Tips
              </h3>
              
              <ul className="space-y-2 text-xs text-subtext">
                <li>• Use the layer mixer to balance different musical elements</li>
                <li>• Try soloing individual layers to hear their contribution</li>
                <li>• Adjust volume levels to create dynamic contrast</li>
                <li>• Save your favorite combinations for future use</li>
                <li>• Experiment with different genres to find your style</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
