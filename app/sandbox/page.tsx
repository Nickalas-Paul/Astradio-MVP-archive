'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { WheelCanvas } from '../../src/components/WheelCanvas';
import { GenerateCard } from '../../src/components/GenerateCard';
import { LayerMixer } from '../../src/components/LayerMixer';
import { VizCanvas } from '../../src/components/VizCanvas';
import { useCompositionJob } from '../../src/hooks/useCompositionJob';
import type { ChartData, LayerMeta } from '../../src/types';

export default function SandboxPage() {
  const [selectedGenre, setSelectedGenre] = useState('ambient');
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [hasValidInputs, setHasValidInputs] = useState(false);
  const [vizPayload, setVizPayload] = useState<any>(null);
  const { stage, audioUrl, layers: jobLayers, start } = useCompositionJob();

  // Update layers when job completes
  useState(() => {
    if (jobLayers && jobLayers.length > 0) {
      setLayers(jobLayers);
    }
  }, [jobLayers]);

  const handleGenerate = async (request: any) => {
    try {
      // Check if we have valid inputs for composition
      if (!hasValidInputs) {
        // First valid input - compose audio+text+viz
        const compositionRequest = {
          mode: 'sandbox',
          controls: {
            arc_shape: 0.5,
            density_level: 0.6,
            tempo_norm: 0.7,
            step_bias: 0.7,
            leap_cap: 5,
            rhythm_template_id: 3,
            syncopation_bias: 0.3,
            motif_rate: 0.6
          },
          seed: Date.now()
        };
        
        const response = await fetch('/api/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(compositionRequest)
        });
        
        const composition = await response.json();
        console.log('Sandbox composition generated:', composition);
        setVizPayload(composition.viz);
        setHasValidInputs(true);
      }
      
      await start(request);
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

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
                  chartData={chartData}
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
                <li>• Select a genre and generate a 60-second composition</li>
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
