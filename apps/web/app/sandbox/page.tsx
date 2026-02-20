'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '../../src/core/api-base';
import { sha256Hex, stableStringify } from '../../src/core/hash';
import { AppShell } from '../../src/components/AppShell';
import WheelCanvas from '../../src/components/WheelCanvas';
import { GenerateCard } from '../../src/components/GenerateCard';
import { LayerMixer } from '../../src/components/LayerMixer';
import VizCanvas from '../../src/components/VizCanvas';
import { useCompositionJob } from '../../src/hooks/useCompositionJob';
import type { ChartData, LayerMeta } from '../../src/types';

const DEFAULT_SANDBOX_BIRTH = {
  date: '2000-01-01',
  time: '12:00',
  lat: 40.7128,
  lon: -74.006,
  tz: 'UTC',
  houseSystem: 'placidus',
};

export default function SandboxPage() {
  const [selectedGenre, setSelectedGenre] = useState('ambient');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [hasValidInputs, setHasValidInputs] = useState(false);
  const [vizPayload, setVizPayload] = useState<any>(null);
  const [lastComposition, setLastComposition] = useState<{ export_id?: string; hashes?: { control?: string }; duration_s?: number } | null>(null);
  const [sandboxCombinedHash, setSandboxCombinedHash] = useState<string | null>(null);
  const { stage, audioUrl, layers: jobLayers, start } = useCompositionJob();

  // Obtain sandbox snapshot on mount so we have combinedHash for seed (chart → unique composition)
  useEffect(() => {
    let cancelled = false;
    const base = getApiBaseUrl();
    fetch(`${base || ''}/api/sandbox/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birth: DEFAULT_SANDBOX_BIRTH, overrides: { planets: {} } }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.meta?.combinedHash) setSandboxCombinedHash(data.meta.combinedHash);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Update layers when job completes
  useEffect(() => {
    if (jobLayers && jobLayers.length > 0) {
      setLayers(jobLayers as LayerMeta[]);
    }
  }, [jobLayers]);

  const handleGenerate = useCallback(async (request: any) => {
    try {
      if (!hasValidInputs) {
        const controls = {
          arc_shape: 0.5,
          density_level: 0.6,
          tempo_norm: 0.7,
          step_bias: 0.7,
          leap_cap: 5,
          rhythm_template_id: 3,
          syncopation_bias: 0.3,
          motif_rate: 0.6,
        };
        const combinedHash = sandboxCombinedHash || '';
        const controlsHash = await sha256Hex(stableStringify(controls));
        const seed = combinedHash ? `${combinedHash}:${controlsHash}` : controlsHash;
        const compositionRequest = {
          mode: 'sandbox',
          controls,
          seed,
        };
        const base = getApiBaseUrl();
        const response = await fetch(`${base || ''}/api/compose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(compositionRequest),
        });
        const composition = await response.json();
        console.log('Sandbox composition generated:', composition);
        setVizPayload(composition.viz);
        setLastComposition(composition);
        setHasValidInputs(true);
      }
      await start(request);
    } catch (error) {
      console.error('Generation failed:', error);
    }
  }, [hasValidInputs, sandboxCombinedHash, start]);

  const handleLayerChange = (key: string, changes: Partial<LayerMeta>) => {
    setLayers(prev => prev.map(layer => 
      layer.key === key ? { ...layer, ...changes } : layer
    ));
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
            Sandbox
          </h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Experiment with blank charts and create compositions from scratch. 
            Add planets and signs to build your custom astrological wheel.
          </p>
        </motion.div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Wheel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="card">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-text">
                  Astrological Wheel
                </h2>
                
                <WheelCanvas 
                  chartData={chartData ?? undefined}
                  isLoading={false}
                  className="w-full"
                />
                
                {!hasValidInputs && (
                  <div className="text-center py-8 text-subtext">
                    <p className="text-sm">Start by adding elements to the wheel or generating a composition</p>
                  </div>
                )}
                
                {/* Add Elements Controls */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-text">
                    Add Elements
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button className="btn-secondary text-sm py-2">
                      + Add Planet
                    </button>
                    <button className="btn-secondary text-sm py-2">
                      + Add Sign
                    </button>
                  </div>
                  
                  <div className="text-xs text-subtext">
                    Click on the wheel to add planets and signs at specific positions
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-6"
          >
            {/* Generation Card */}
            <GenerateCard
              selectedGenre={selectedGenre}
              onGenreChange={setSelectedGenre}
              onGenerate={handleGenerate}
              isGenerating={stage === 'generating' || stage === 'preparing' || stage === 'mixing'}
            />

            {/* Layer Mixer */}
            {layers.length > 0 && (
              <LayerMixer
                layers={layers}
                onLayerChange={handleLayerChange}
              />
            )}

            {/* Visualization */}
            {vizPayload && (
              <div className="card">
                <h3 className="text-lg font-semibold text-text mb-4">
                  Visualization
                </h3>
                <VizCanvas payload={vizPayload} className="h-48" />
              </div>
            )}

            {/* Download WAV */}
            {lastComposition?.export_id && (
              <div className="card">
                <h3 className="text-lg font-semibold text-text mb-4">
                  Export
                </h3>
                <a
                  href={`${getApiBaseUrl() || ''}/api/exports/${lastComposition.export_id}`}
                  download={`${lastComposition.export_id}-30s.wav`}
                  className="btn-primary w-full inline-flex items-center justify-center gap-2"
                >
                  Download WAV (30s)
                </a>
              </div>
            )}

            {/* Quick Actions */}
            <div className="card">
              <h3 className="text-lg font-semibold text-text mb-4">
                Quick Actions
              </h3>
              
              <div className="space-y-3">
                <button className="btn-secondary w-full">
                  Load Sample Chart
                </button>
                <button className="btn-secondary w-full">
                  Clear All Elements
                </button>
                <button className="btn-secondary w-full">
                  Save Current Chart
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="card bg-bgElev/50">
              <h3 className="text-sm font-semibold text-text mb-3">
                How to use the Sandbox
              </h3>
              
              <ul className="space-y-2 text-xs text-subtext">
                <li>• Click on the wheel to add planets at specific degrees</li>
                <li>• Use the "Add Planet" button for quick planet placement</li>
                <li>• Select a genre and generate a 30-second composition</li>
                <li>• Use the layer mixer to control individual audio elements</li>
                <li>• Save your custom charts for future use</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
