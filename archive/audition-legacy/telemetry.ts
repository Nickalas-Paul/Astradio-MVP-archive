// telemetry.ts - Structured logging and variance diagnostics

export class Telemetry {
  private featureStats: { min: number[]; max: number[]; sum: number[]; count: number } | null = null;
  private modelOutputStats: { min: number[]; max: number[]; sum: number[]; count: number } | null = null;

  logFeatureDiversity(features: number[], chartIndex: number): void {
    if (!this.featureStats) {
      this.featureStats = { min: [...features], max: [...features], sum: [...features], count: 1 };
    } else {
      features.forEach((val, i) => {
        this.featureStats!.min[i] = Math.min(this.featureStats!.min[i], val);
        this.featureStats!.max[i] = Math.max(this.featureStats!.max[i], val);
        this.featureStats!.sum[i] += val;
      });
      this.featureStats.count++;
    }

    // Log summary every 10 charts
    if (chartIndex % 10 === 0) {
      const mean = this.featureStats.sum.map(s => s / this.featureStats.count);
      const variance = features.map((val, i) => {
        const meanVal = mean[i];
        return Math.pow(val - meanVal, 2);
      });
      
      const highVarianceFeatures = variance.filter(v => v > 0.01).length;
      const totalFeatures = features.length;
      
      console.log(`[Audition] Feature diversity: ${highVarianceFeatures}/${totalFeatures} features with variance > 0.01 (${(highVarianceFeatures/totalFeatures*100).toFixed(1)}%)`);
      
      if (highVarianceFeatures < totalFeatures * 0.7) {
        console.warn(`[Audition] LOW FEATURE DIVERSITY: Only ${highVarianceFeatures}/${totalFeatures} features vary significantly`);
      }
    }
  }

  logModelOutputDiversity(rawVector: number[], chartIndex: number): void {
    if (!this.modelOutputStats) {
      this.modelOutputStats = { min: [...rawVector], max: [...rawVector], sum: [...rawVector], count: 1 };
    } else {
      rawVector.forEach((val, i) => {
        this.modelOutputStats!.min[i] = Math.min(this.modelOutputStats!.min[i], val);
        this.modelOutputStats!.max[i] = Math.max(this.modelOutputStats!.max[i], val);
        this.modelOutputStats!.sum[i] += val;
      });
      this.modelOutputStats.count++;
    }

    // Log summary every 10 charts
    if (chartIndex % 10 === 0) {
      const mean = this.modelOutputStats.sum.map(s => s / this.modelOutputStats.count);
      const variance = rawVector.map((val, i) => {
        const meanVal = mean[i];
        return Math.pow(val - meanVal, 2);
      });
      
      const highVarianceDims = variance.filter(v => v > 0.05).length;
      const totalDims = rawVector.length;
      
      console.log(`[Audition] Model output diversity: ${highVarianceDims}/${totalDims} dimensions with variance > 0.05 (${(highVarianceDims/totalDims*100).toFixed(1)}%)`);
      
      if (highVarianceDims < 4) {
        console.warn(`[Audition] LOW MODEL DIVERSITY: Only ${highVarianceDims}/${totalDims} dimensions vary significantly`);
      }
    }
  }

  logGateResults(results: Array<{ passed: boolean; failedGates: string[] }>): void {
    const gateCounts: Record<string, number> = {};
    const passedCount = results.filter(r => r.passed).length;
    
    results.forEach(result => {
      result.failedGates.forEach(gate => {
        gateCounts[gate] = (gateCounts[gate] || 0) + 1;
      });
    });

    console.log(`[Audition] Gate results: ${passedCount}/${results.length} passed`);
    
    if (Object.keys(gateCounts).length > 0) {
      console.log(`[Audition] Gate failures:`, gateCounts);
    }
  }

  logWinnerSelection(winnerIndex: number | null, score: number, renderUrl?: string): void {
    if (winnerIndex !== null) {
      console.log(`[Audition] Winner selected: Chart ${winnerIndex}, Score: ${score.toFixed(1)}`);
      if (renderUrl) {
        console.log(`[Audition] Audio rendered: ${renderUrl}`);
      }
    } else {
      console.log(`[Audition] No winner: No compositions passed quality gates`);
    }
  }

  calculatePreClampVariance(rawVectors: number[][]): Record<string, number> {
    if (rawVectors.length === 0) return {};

    const dims = ['tempo_energy', 'rhythm_density', 'harmonic_tension', 'brightness', 'texture_space', 'melodic_activity'];
    const variance: Record<string, number> = {};

    dims.forEach((dim, i) => {
      const values = rawVectors.map(v => v[i] || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const varianceVal = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      variance[dim] = varianceVal;
    });

    return variance;
  }
}
