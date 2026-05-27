'use client';

import { motion } from 'framer-motion';
import type { LayerMixerProps, LayerMeta } from '../types';

const layerConfig = {
  melody: { label: 'Melody', icon: '🎵', color: 'accent' },
  harmony: { label: 'Harmony', icon: '🎼', color: 'violet' },
  rhythm: { label: 'Rhythm', icon: '🥁', color: 'warning' },
  texture: { label: 'Texture', icon: '🌊', color: 'success' },
} as const;

export function LayerMixer({ layers, onLayerChange, className = '' }: LayerMixerProps) {
  if (!layers || layers.length === 0) {
    return (
      <div className={`card ${className}`}>
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text mb-2">No Layers Available</h3>
          <p className="text-sm text-subtext">
            Generate a composition to see and control individual audio layers
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`card ${className}`}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-text mb-2">
            Layer Mixer
          </h3>
          <p className="text-sm text-subtext">
            Control individual audio layers in your composition
          </p>
        </div>

        {/* Layer Controls */}
        <div className="space-y-4">
          {layers.map((layer) => {
            const config = layerConfig[layer.key];
            const colorClass = `text-${config.color}`;
            const bgColorClass = `bg-${config.color}/10`;
            const borderColorClass = `border-${config.color}/20`;

            return (
              <motion.div
                key={layer.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: layers.indexOf(layer) * 0.1 }}
                className={`p-4 rounded-xl border ${borderColorClass} ${bgColorClass}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-text">
                        {config.label}
                      </h4>
                      <p className="text-xs text-subtext">
                        {Math.round(layer.gain * 100)}% volume
                      </p>
                    </div>
                  </div>

                  {/* Mute/Solo Controls */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onLayerChange(layer.key, { solo: !layer.solo })}
                      className={`w-8 h-8 rounded-lg border transition-colors ${
                        layer.solo
                          ? 'bg-warning border-warning text-bg'
                          : 'bg-transparent border-border text-subtext hover:text-text'
                      }`}
                      aria-label={`${layer.solo ? 'Un-solo' : 'Solo'} ${config.label}`}
                    >
                      <span className="text-xs font-bold">S</span>
                    </button>
                    
                    <button
                      onClick={() => onLayerChange(layer.key, { muted: !layer.muted })}
                      className={`w-8 h-8 rounded-lg border transition-colors ${
                        layer.muted
                          ? 'bg-danger border-danger text-bg'
                          : 'bg-transparent border-border text-subtext hover:text-text'
                      }`}
                      aria-label={`${layer.muted ? 'Unmute' : 'Mute'} ${config.label}`}
                    >
                      <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {layer.muted ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M6.343 6.343a1 1 0 011.414 0L12 10.586l4.243-4.243a1 1 0 111.414 1.414L13.414 12l4.243 4.243a1 1 0 01-1.414 1.414L12 13.414l-4.243 4.243a1 1 0 01-1.414-1.414L10.586 12 6.343 7.757a1 1 0 010-1.414z" />
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Gain Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-subtext">Volume</span>
                    <span className="text-xs font-mono text-text">
                      {Math.round(layer.gain * 100)}%
                    </span>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={layer.gain}
                      onChange={(e) => onLayerChange(layer.key, { gain: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, theme('colors.${config.color}') 0%, theme('colors.${config.color}') ${layer.gain * 100}%, theme('colors.border') ${layer.gain * 100}%, theme('colors.border') 100%)`
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Master Controls */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Master Controls</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  layers.forEach(layer => {
                    if (!layer.solo) {
                      onLayerChange(layer.key, { muted: true });
                    }
                  });
                }}
                className="text-xs px-3 py-1 bg-bgElev border border-border rounded-lg text-subtext hover:text-text transition-colors"
              >
                Mute All
              </button>
              <button
                onClick={() => {
                  layers.forEach(layer => {
                    onLayerChange(layer.key, { muted: false, solo: false });
                  });
                }}
                className="text-xs px-3 py-1 bg-bgElev border border-border rounded-lg text-subtext hover:text-text transition-colors"
              >
                Unmute All
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: theme('colors.accent.DEFAULT');
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: theme('colors.accent.DEFAULT');
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </motion.div>
  );
}
