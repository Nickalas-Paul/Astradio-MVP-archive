'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ComparisonSwitcherProps } from '../types';

export function ComparisonSwitcher({
  chartA,
  chartB,
  onChartChange,
  className = '',
}: ComparisonSwitcherProps) {
  const [isSwapping, setIsSwapping] = useState(false);

  const handleSwap = () => {
    if (chartA && chartB) {
      setIsSwapping(true);
      // Simulate swap animation
      setTimeout(() => {
        onChartChange(chartA.id, 'B');
        onChartChange(chartB.id, 'A');
        setIsSwapping(false);
      }, 300);
    }
  };

  return (
    <div className={`card ${className}`}>
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-text">
          Chart Comparison
        </h2>
        
        <div className="flex items-center justify-between">
          {/* Chart A */}
          <div className="flex-1">
            <div className="p-4 bg-bgElev rounded-xl border border-accent/20">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-3 h-3 bg-accent rounded-full"></div>
                <span className="text-sm font-medium text-accent-light">Chart A</span>
              </div>
              <h3 className="text-text font-semibold">
                {chartA?.label || 'No chart selected'}
              </h3>
              <p className="text-xs text-subtext">
                {chartA?.createdAt ? new Date(chartA.createdAt).toLocaleDateString() : ''}
              </p>
            </div>
          </div>

          {/* Swap Button */}
          <div className="px-4">
            <button
              onClick={handleSwap}
              disabled={!chartA || !chartB || isSwapping}
              className="w-10 h-10 bg-bgElev border border-border rounded-full flex items-center justify-center hover:bg-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Swap charts"
            >
              <motion.svg
                className="w-5 h-5 text-subtext"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={{ rotate: isSwapping ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </motion.svg>
            </button>
          </div>

          {/* Chart B */}
          <div className="flex-1">
            <div className="p-4 bg-bgElev rounded-xl border border-violet/20">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-3 h-3 bg-violet rounded-full"></div>
                <span className="text-sm font-medium text-violet">Chart B</span>
              </div>
              <h3 className="text-text font-semibold">
                {chartB?.label || 'No chart selected'}
              </h3>
              <p className="text-xs text-subtext">
                {chartB?.createdAt ? new Date(chartB.createdAt).toLocaleDateString() : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Chart Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-text mb-2 block">
              Select Chart A
            </label>
            <select
              value={chartA?.id || ''}
              onChange={(e) => onChartChange(e.target.value, 'A')}
              className="input w-full"
            >
              <option value="">Choose chart...</option>
              <option value="natal">My Natal</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium text-text mb-2 block">
              Select Chart B
            </label>
            <select
              value={chartB?.id || ''}
              onChange={(e) => onChartChange(e.target.value, 'B')}
              className="input w-full"
            >
              <option value="">Choose chart...</option>
              <option value="natal">My Natal</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
            </select>
          </div>
        </div>

        {/* Comparison Info */}
        {chartA && chartB && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 bg-bg rounded-lg border border-border"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-text">Comparison ready</span>
              <span className="text-accent-light">✓</span>
            </div>
            <p className="text-xs text-subtext mt-1">
              Generate a composition that blends the energies of both charts
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
