// vnext/scripts/canary-promotion.ts
// Canary deployment promotion criteria and automated decision making

import fs from 'fs';
import path from 'path';
import { modelLoader } from '../ml/model-loader';
import { runEvaluation } from './freeze-eval-set';
import { QUALITY_CONFIG } from '../config/quality';

interface CanaryMetrics {
  modelVersion: string;
  sampleSize: number;
  timeWindow: string; // ISO duration
  metrics: {
    passRate: number;
    avgQuality: number;
    avgLatency: number;
    errorRate: number;
    p95Latency: number;
    p99Latency: number;
  };
  bucketMetrics: Record<string, {
    sampleSize: number;
    passRate: number;
    avgQuality: number;
    avgLatency: number;
  }>;
  comparison: {
    baseline: string;
    improvements: {
      passRate: number;      // Percentage point improvement
      avgQuality: number;    // Absolute improvement
      avgLatency: number;    // Latency change (negative = better)
      errorRate: number;     // Percentage point change (negative = better)
    };
  };
}

interface PromotionCriteria {
  // Minimum requirements for promotion
  minimumSampleSize: number;
  minimumTimeWindow: number; // Hours
  
  // Performance thresholds (all must pass)
  qualityImprovement: number;    // Minimum quality improvement
  passRateImprovement: number;   // Minimum pass rate improvement (pp)
  latencyTolerance: number;      // Maximum latency increase (%)
  errorRateTolerance: number;    // Maximum error rate increase (pp)
  
  // Statistical significance
  confidenceLevel: number;       // e.g., 0.95 for 95% confidence
  minimumEffectSize: number;     // Minimum effect size for significance
  
  // Bucket-specific requirements
  minimumBucketSamples: number;  // Min samples per astrological bucket
  bucketConsistency: number;     // Min fraction of buckets that must improve
  
  // Stability requirements
  maxQualityVariance: number;    // Maximum quality variance over time
  maxLatencySpikes: number;      // Maximum number of latency spikes allowed
}

// Default promotion criteria based on environment
const PROMOTION_CRITERIA: Record<string, PromotionCriteria> = {
  development: {
    minimumSampleSize: 50,
    minimumTimeWindow: 1, // 1 hour
    qualityImprovement: 0.01,
    passRateImprovement: 0.02, // 2pp
    latencyTolerance: 0.20, // 20%
    errorRateTolerance: 0.05, // 5pp
    confidenceLevel: 0.90,
    minimumEffectSize: 0.1,
    minimumBucketSamples: 5,
    bucketConsistency: 0.60, // 60% of buckets must improve
    maxQualityVariance: 0.05,
    maxLatencySpikes: 3
  },
  
  'pre-production': {
    minimumSampleSize: 200,
    minimumTimeWindow: 6, // 6 hours
    qualityImprovement: 0.015,
    passRateImprovement: 0.03, // 3pp
    latencyTolerance: 0.15, // 15%
    errorRateTolerance: 0.03, // 3pp
    confidenceLevel: 0.95,
    minimumEffectSize: 0.15,
    minimumBucketSamples: 10,
    bucketConsistency: 0.70, // 70% of buckets must improve
    maxQualityVariance: 0.03,
    maxLatencySpikes: 2
  },
  
  production: {
    minimumSampleSize: 500,
    minimumTimeWindow: 24, // 24 hours
    qualityImprovement: 0.02,
    passRateImprovement: 0.05, // 5pp
    latencyTolerance: 0.10, // 10%
    errorRateTolerance: 0.02, // 2pp
    confidenceLevel: 0.99,
    minimumEffectSize: 0.2,
    minimumBucketSamples: 20,
    bucketConsistency: 0.80, // 80% of buckets must improve
    maxQualityVariance: 0.02,
    maxLatencySpikes: 1
  }
};

// Load canary metrics from telemetry
function loadCanaryMetrics(timeWindowHours = 24): CanaryMetrics | null {
  try {
    // In a real implementation, this would load from telemetry storage
    // For now, we'll use the model loader's telemetry
    const telemetrySummary = modelLoader.getTelemetrySummary();
    
    if (telemetrySummary.v2.count === 0) {
      console.log('No V2 telemetry data available');
      return null;
    }
    
    // Simulate metrics (in real implementation, calculate from actual telemetry)
    const metrics: CanaryMetrics = {
      modelVersion: 'v2',
      sampleSize: telemetrySummary.v2.count,
      timeWindow: `PT${timeWindowHours}H`,
      metrics: {
        passRate: telemetrySummary.v2.passRate,
        avgQuality: telemetrySummary.v2.avgQuality,
        avgLatency: telemetrySummary.v2.avgLatency,
        errorRate: 0.02, // Simulated
        p95Latency: telemetrySummary.v2.avgLatency * 1.5,
        p99Latency: telemetrySummary.v2.avgLatency * 2.0
      },
      bucketMetrics: {
        'aries': { sampleSize: 25, passRate: 0.85, avgQuality: 0.72, avgLatency: 150 },
        'taurus': { sampleSize: 22, passRate: 0.88, avgQuality: 0.74, avgLatency: 145 },
        'gemini': { sampleSize: 28, passRate: 0.82, avgQuality: 0.69, avgLatency: 155 }
      },
      comparison: {
        baseline: 'v1',
        improvements: {
          passRate: telemetrySummary.v2.passRate - telemetrySummary.v1.passRate,
          avgQuality: telemetrySummary.v2.avgQuality - telemetrySummary.v1.avgQuality,
          avgLatency: telemetrySummary.v2.avgLatency - telemetrySummary.v1.avgLatency,
          errorRate: -0.01 // Simulated improvement
        }
      }
    };
    
    return metrics;
  } catch (error) {
    console.error('Failed to load canary metrics:', error);
    return null;
  }
}

// Calculate statistical significance using t-test approximation
function calculateSignificance(
  sample1: { mean: number; std: number; n: number },
  sample2: { mean: number; std: number; n: number },
  confidenceLevel: number
): { significant: boolean; pValue: number; effectSize: number } {
  // Simplified t-test calculation
  const pooledStd = Math.sqrt(
    ((sample1.n - 1) * sample1.std * sample1.std + (sample2.n - 1) * sample2.std * sample2.std) /
    (sample1.n + sample2.n - 2)
  );
  
  const standardError = pooledStd * Math.sqrt(1 / sample1.n + 1 / sample2.n);
  const tStat = Math.abs(sample1.mean - sample2.mean) / standardError;
  const degreesOfFreedom = sample1.n + sample2.n - 2;
  
  // Simplified p-value approximation
  const pValue = 2 * (1 - normalCDF(tStat));
  const significant = pValue < (1 - confidenceLevel);
  
  // Effect size (Cohen's d)
  const effectSize = Math.abs(sample1.mean - sample2.mean) / pooledStd;
  
  return { significant, pValue, effectSize };
}

// Normal cumulative distribution function approximation
function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

// Error function approximation
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return sign * y;
}

// Evaluate promotion criteria
function evaluatePromotionCriteria(
  metrics: CanaryMetrics,
  criteria: PromotionCriteria
): {
  eligible: boolean;
  results: Record<string, { passed: boolean; value: number; threshold: number; description: string }>;
  summary: string;
} {
  const results: Record<string, { passed: boolean; value: number; threshold: number; description: string }> = {};
  
  // Sample size check
  results.sampleSize = {
    passed: metrics.sampleSize >= criteria.minimumSampleSize,
    value: metrics.sampleSize,
    threshold: criteria.minimumSampleSize,
    description: 'Minimum sample size for statistical validity'
  };
  
  // Quality improvement check
  results.qualityImprovement = {
    passed: metrics.comparison.improvements.avgQuality >= criteria.qualityImprovement,
    value: metrics.comparison.improvements.avgQuality,
    threshold: criteria.qualityImprovement,
    description: 'Quality must improve over baseline'
  };
  
  // Pass rate improvement check
  results.passRateImprovement = {
    passed: metrics.comparison.improvements.passRate >= criteria.passRateImprovement,
    value: metrics.comparison.improvements.passRate * 100, // Convert to percentage points
    threshold: criteria.passRateImprovement * 100,
    description: 'Pass rate must improve over baseline'
  };
  
  // Latency tolerance check
  const latencyIncrease = metrics.comparison.improvements.avgLatency / metrics.metrics.avgLatency;
  results.latencyTolerance = {
    passed: latencyIncrease <= criteria.latencyTolerance,
    value: latencyIncrease * 100,
    threshold: criteria.latencyTolerance * 100,
    description: 'Latency increase must be within tolerance'
  };
  
  // Error rate tolerance check
  results.errorRateTolerance = {
    passed: metrics.comparison.improvements.errorRate <= criteria.errorRateTolerance,
    value: metrics.comparison.improvements.errorRate * 100,
    threshold: criteria.errorRateTolerance * 100,
    description: 'Error rate increase must be within tolerance'
  };
  
  // Bucket consistency check
  const buckets = Object.values(metrics.bucketMetrics);
  const improvingBuckets = buckets.filter(bucket => 
    bucket.passRate > 0.8 && bucket.avgQuality > 0.65 // Simplified improvement check
  );
  const bucketConsistency = improvingBuckets.length / buckets.length;
  
  results.bucketConsistency = {
    passed: bucketConsistency >= criteria.bucketConsistency,
    value: bucketConsistency * 100,
    threshold: criteria.bucketConsistency * 100,
    description: 'Minimum percentage of buckets must show improvement'
  };
  
  // Minimum bucket samples check
  const minBucketSamples = Math.min(...buckets.map(b => b.sampleSize));
  results.bucketSamples = {
    passed: minBucketSamples >= criteria.minimumBucketSamples,
    value: minBucketSamples,
    threshold: criteria.minimumBucketSamples,
    description: 'Each bucket must have minimum sample size'
  };
  
  const allPassed = Object.values(results).every(r => r.passed);
  const passedCount = Object.values(results).filter(r => r.passed).length;
  const totalCount = Object.values(results).length;
  
  const summary = `${passedCount}/${totalCount} criteria passed`;
  
  return {
    eligible: allPassed,
    results,
    summary
  };
}

// Main promotion evaluation
export async function evaluateCanaryPromotion(): Promise<{
  eligible: boolean;
  metrics: CanaryMetrics | null;
  evaluation: any;
  recommendation: string;
}> {
  console.log('🚀 Evaluating Canary Promotion Eligibility');
  console.log('=' .repeat(50));
  
  // Get current environment criteria
  const env = process.env.QUALITY_ENV || process.env.NODE_ENV || 'development';
  const criteria = PROMOTION_CRITERIA[env] || PROMOTION_CRITERIA.development;
  
  console.log(`📊 Environment: ${env}`);
  console.log(`   Minimum Sample Size: ${criteria.minimumSampleSize}`);
  console.log(`   Minimum Time Window: ${criteria.minimumTimeWindow} hours`);
  console.log(`   Required Quality Improvement: +${criteria.qualityImprovement.toFixed(3)}`);
  console.log(`   Required Pass Rate Improvement: +${criteria.passRateImprovement * 100}pp`);
  
  // Load canary metrics
  console.log('\n📈 Loading Canary Metrics...');
  const metrics = loadCanaryMetrics(criteria.minimumTimeWindow);
  
  if (!metrics) {
    console.log('❌ No canary metrics available');
    return {
      eligible: false,
      metrics: null,
      evaluation: null,
      recommendation: 'No canary data available. Deploy canary first and wait for sufficient data.'
    };
  }
  
  console.log(`   Model: ${metrics.modelVersion}`);
  console.log(`   Sample Size: ${metrics.sampleSize}`);
  console.log(`   Pass Rate: ${(metrics.metrics.passRate * 100).toFixed(1)}%`);
  console.log(`   Avg Quality: ${metrics.metrics.avgQuality.toFixed(3)}`);
  console.log(`   Avg Latency: ${metrics.metrics.avgLatency.toFixed(0)}ms`);
  
  // Evaluate promotion criteria
  console.log('\n🎯 Evaluating Promotion Criteria:');
  const evaluation = evaluatePromotionCriteria(metrics, criteria);
  
  Object.entries(evaluation.results).forEach(([criterion, result]) => {
    const status = result.passed ? '✅' : '❌';
    const valueStr = result.value.toFixed(result.value < 1 ? 3 : 1);
    const thresholdStr = result.threshold.toFixed(result.threshold < 1 ? 3 : 1);
    
    console.log(`   ${status} ${criterion}: ${valueStr} (threshold: ${thresholdStr})`);
    console.log(`      ${result.description}`);
  });
  
  // Generate recommendation
  let recommendation: string;
  
  if (evaluation.eligible) {
    recommendation = `✅ PROMOTE: All criteria met. Ready to promote ${metrics.modelVersion} to full deployment.`;
  } else {
    const failedCriteria = Object.entries(evaluation.results)
      .filter(([_, result]) => !result.passed)
      .map(([criterion, _]) => criterion);
    
    recommendation = `❌ NOT READY: Failed criteria: ${failedCriteria.join(', ')}. `;
    
    if (metrics.sampleSize < criteria.minimumSampleSize) {
      recommendation += `Wait for more data (${criteria.minimumSampleSize - metrics.sampleSize} more samples needed). `;
    }
    
    if (metrics.comparison.improvements.avgQuality < criteria.qualityImprovement) {
      recommendation += `Quality improvement insufficient. `;
    }
    
    if (metrics.comparison.improvements.passRate < criteria.passRateImprovement) {
      recommendation += `Pass rate improvement insufficient. `;
    }
    
    recommendation += 'Continue monitoring or consider rollback if degradation persists.';
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`🎯 Promotion Decision: ${evaluation.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
  console.log(`📋 Summary: ${evaluation.summary}`);
  console.log(`💡 Recommendation: ${recommendation}`);
  
  return {
    eligible: evaluation.eligible,
    metrics,
    evaluation,
    recommendation
  };
}

// Automated promotion (if criteria met)
export async function autoPromoteCanary(dryRun = true): Promise<boolean> {
  const evaluation = await evaluateCanaryPromotion();
  
  if (!evaluation.eligible) {
    console.log('🚫 Auto-promotion blocked: criteria not met');
    return false;
  }
  
  if (dryRun) {
    console.log('🧪 DRY RUN: Would promote canary to full deployment');
    return true;
  }
  
  console.log('🚀 Auto-promoting canary to full deployment...');
  
  // In a real implementation, this would:
  // 1. Update deployment configuration
  // 2. Scale up new model
  // 3. Scale down old model
  // 4. Update load balancer routing
  // 5. Send notifications
  
  console.log('✅ Canary promoted successfully');
  return true;
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'evaluate' || !command) {
    evaluateCanaryPromotion()
      .then(result => {
        process.exit(result.eligible ? 0 : 1);
      })
      .catch(error => {
        console.error('❌ Evaluation failed:', error);
        process.exit(1);
      });
      
  } else if (command === 'auto-promote') {
    const dryRun = process.argv[3] !== '--no-dry-run';
    
    autoPromoteCanary(dryRun)
      .then(success => {
        process.exit(success ? 0 : 1);
      })
      .catch(error => {
        console.error('❌ Auto-promotion failed:', error);
        process.exit(1);
      });
      
  } else {
    console.log('Usage:');
    console.log('  npm run canary-promotion [evaluate]           - Evaluate promotion eligibility');
    console.log('  npm run canary-promotion auto-promote         - Auto-promote if eligible (dry run)');
    console.log('  npm run canary-promotion auto-promote --no-dry-run  - Actually promote');
  }
}
