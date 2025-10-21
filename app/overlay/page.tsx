'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { WheelCanvas } from '../../src/components/WheelCanvas';
import { GenerateCard } from '../../src/components/GenerateCard';
import { ComparisonSwitcher } from '../../src/components/ComparisonSwitcher';
import { CompatibilitySection } from '../../src/components/CompatibilitySection';
import { useChartsStore } from '../../src/store';
import { isFeatureEnabled } from '../../src/core/config/flags';
import type { ChartData, ChartSummary } from '../../src/types';

export default function OverlayPage() {
  const [selectedGenre, setSelectedGenre] = useState('ambient');
  const [chartA, setChartA] = useState<ChartSummary | null>(null);
  const [chartB, setChartB] = useState<ChartSummary | null>(null);
  const [combinedChartData, setCombinedChartData] = useState<ChartData | null>(null);
  const { charts, addChart } = useChartsStore();

  // Load default charts on mount
  useEffect(() => {
    const loadDefaultCharts = async () => {
      try {
        // Load "Today" chart
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toTimeString().slice(0, 5);
        
        const todayResponse = await fetch(`/api/chart?date=${date}&time=${time}&lat=-34.6037&lon=-58.3816`);
        
        if (todayResponse.ok) {
          const todayData = await todayResponse.json();
          const todayChart: ChartSummary = {
            id: 'today',
            label: 'Today',
            createdAt: now.toISOString(),
            positions: todayData.positions,
            houses: todayData.cusps,
          };
          ;(window as any).__lastSeed = todayData.seed;
          ;(window as any).__lastControlHash = todayData.controlHash;
          
          setChartA(todayChart);
          addChart(todayChart);
        }

        // Load "Natal" chart (using a sample birth date)
        const natalDate = '1990-06-15';
        const natalTime = '14:30';
        
        const natalResponse = await fetch(`/api/chart?date=${natalDate}&time=${natalTime}&lat=-34.6037&lon=-58.3816`);
        
        if (natalResponse.ok) {
          const natalData = await natalResponse.json();
          const natalChart: ChartSummary = {
            id: 'natal',
            label: 'My Natal',
            createdAt: new Date('1990-06-15T14:30:00Z').toISOString(),
            positions: natalData.positions,
            houses: natalData.cusps,
          };
          
          setChartB(natalChart);
          addChart(natalChart);
        }
      } catch (error) {
        console.error('Failed to load charts:', error);
      }
    };

    loadDefaultCharts();
  }, [addChart]);

  // Combine chart data for overlay display
  useEffect(() => {
    if (chartA && chartB) {
      // Create combined chart data showing both charts
      setCombinedChartData({
        positions: {
          ...chartA.positions,
          // Add prefix to distinguish between charts
          ...Object.fromEntries(
            Object.entries(chartB.positions).map(([key, value]) => [`${key}_natal`, value])
          ),
        },
        cusps: chartA.houses || [],
        aspects: [],
        moonPhase: 0,
        dominantElements: { fire: 0, earth: 0, air: 0, water: 0 },
      });
    }
  }, [chartA, chartB]);

  const handleChartChange = (chartId: string, position: 'A' | 'B') => {
    const chart = charts.find(c => c.id === chartId);
    if (chart) {
      if (position === 'A') {
        setChartA(chart);
      } else {
        setChartB(chart);
      }
    }
  };

  const handleGenerate = async (request: any) => {
    console.log('Generate overlay composition:', request);
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
            Chart Overlay
          </h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Compare two astrological charts and generate compositions that blend their energies. 
            Perfect for synastry analysis or comparing different time periods.
          </p>
        </motion.div>

        {/* Chart Comparison Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {chartA && (
            <ComparisonSwitcher
              chartA={chartA}
              chartB={chartB}
              onChartChange={handleChartChange}
            />
          )}
        </motion.div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Combined Wheel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="card">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-text">
                  Combined Chart View
                </h2>
                
                <WheelCanvas 
                  chartData={combinedChartData}
                  isLoading={!chartA || !chartB}
                  className="w-full"
                />
                
                {/* Chart Legend */}
                <div className="flex items-center justify-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-emerald rounded-full"></div>
                    <span className="text-text">{chartA?.label || 'Chart A'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-violet rounded-full"></div>
                    <span className="text-text">{chartB?.label || 'Chart B'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Aspect Analysis */}
            <div className="card">
              <h3 className="text-lg font-semibold text-text mb-4">
                Aspect Analysis
              </h3>
              
              <div className="space-y-3">
                <div className="p-3 bg-bgElev rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">Conjunctions</span>
                    <span className="text-sm text-emerald">3</span>
                  </div>
                </div>
                
                <div className="p-3 bg-bgElev rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">Oppositions</span>
                    <span className="text-sm text-warning">1</span>
                  </div>
                </div>
                
                <div className="p-3 bg-bgElev rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">Trines</span>
                    <span className="text-sm text-success">5</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column - Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-6"
          >
            {/* Generation Card */}
            <GenerateCard
              selectedGenre={selectedGenre}
              onGenreChange={setSelectedGenre}
              onGenerate={handleGenerate}
              isGenerating={false}
            />

            {/* Recent Compositions */}
            <div className="card">
              <h3 className="text-lg font-semibold text-text mb-4">
                Recent Compositions
              </h3>
              
              <div className="space-y-3">
                <div className="p-3 bg-bgElev rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text">Natal × Today</p>
                      <p className="text-xs text-subtext">Ambient • 2 min ago</p>
                    </div>
                    <button className="text-emerald hover:text-emeraldMuted">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="p-3 bg-bgElev rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-text">Today × Yesterday</p>
                      <p className="text-xs text-subtext">Jazz • 1 hour ago</p>
                    </div>
                    <button className="text-emerald hover:text-emeraldMuted">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Compatibility Section */}
            {isFeatureEnabled('ENABLE_COMPAT') && chartA && (
              <CompatibilitySection 
                chartId={chartA.id} 
                limit={3}
              />
            )}

            {/* Quick Actions */}
            <div className="card">
              <h3 className="text-sm font-semibold text-text mb-3">
                Quick Actions
              </h3>
              
              <div className="space-y-2">
                <button className="btn-secondary w-full text-sm">
                  Save Comparison
                </button>
                <button className="btn-secondary w-full text-sm">
                  Export Chart
                </button>
                <button className="btn-secondary w-full text-sm">
                  Share Composition
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
