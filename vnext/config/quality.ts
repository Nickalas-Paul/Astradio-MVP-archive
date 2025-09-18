// vnext/config/quality.ts
// Single source of truth for all quality thresholds and configuration
// Prevents threshold drift and ensures consistency across the system

export const QUALITY_CONFIG = {
  // Development thresholds (Phase 2A - current)
  DEVELOPMENT: {
    MIN_QUALITY_THRESHOLD: 0.55,
    MIN_RULE_QUALITY: 0.55,
    AUDITION_GATE_THRESHOLD: 0.55,
    CANARY_ROLLBACK_THRESHOLDS: {
      PASS_RATE_DROP: 0.05,
      QUALITY_DROP: 0.03,
      ERROR_RATE_INCREASE: 0.02,
      LATENCY_INCREASE: 100
    }
  },
  
  // Pre-production thresholds (Phase 2C - after V2 proves stable)
  PRE_PRODUCTION: {
    MIN_QUALITY_THRESHOLD: 0.60,
    MIN_RULE_QUALITY: 0.60,
    AUDITION_GATE_THRESHOLD: 0.60,
    CANARY_ROLLBACK_THRESHOLDS: {
      PASS_RATE_DROP: 0.04,
      QUALITY_DROP: 0.025,
      ERROR_RATE_INCREASE: 0.015,
      LATENCY_INCREASE: 80
    }
  },
  
  // Production thresholds (Phase 2C+ - final)
  PRODUCTION: {
    MIN_QUALITY_THRESHOLD: 0.65,
    MIN_RULE_QUALITY: 0.65,
    AUDITION_GATE_THRESHOLD: 0.65,
    CANARY_ROLLBACK_THRESHOLDS: {
      PASS_RATE_DROP: 0.03,
      QUALITY_DROP: 0.02,
      ERROR_RATE_INCREASE: 0.01,
      LATENCY_INCREASE: 50
    }
  },
  
  // Get current environment configuration
  get CURRENT() {
    const env = process.env.QUALITY_ENV || 'development';
    switch (env.toLowerCase()) {
      case 'production':
        return this.PRODUCTION;
      case 'pre-production':
      case 'preprod':
        return this.PRE_PRODUCTION;
      default:
        return this.DEVELOPMENT;
    }
  },
  
  // Current environment threshold
  get CURRENT_THRESHOLD() {
    return this.CURRENT.MIN_QUALITY_THRESHOLD;
  },
  
  get CURRENT_RULE_THRESHOLD() {
    return this.CURRENT.MIN_RULE_QUALITY;
  },
  
  get CURRENT_AUDITION_THRESHOLD() {
    return this.CURRENT.AUDITION_GATE_THRESHOLD;
  },
  
  get CURRENT_ROLLBACK_THRESHOLDS() {
    return this.CURRENT.CANARY_ROLLBACK_THRESHOLDS;
  }
};

// Export individual thresholds for convenience
export const MIN_QUALITY_THRESHOLD = QUALITY_CONFIG.CURRENT_THRESHOLD;
export const MIN_RULE_QUALITY = QUALITY_CONFIG.CURRENT_RULE_THRESHOLD;
export const AUDITION_GATE_THRESHOLD = QUALITY_CONFIG.CURRENT_AUDITION_THRESHOLD;

// Validation function to ensure all components use same thresholds
export function validateQualityConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const current = QUALITY_CONFIG.CURRENT;
  
  // Check thresholds are reasonable
  if (current.MIN_QUALITY_THRESHOLD < 0.5 || current.MIN_QUALITY_THRESHOLD > 0.9) {
    issues.push(`MIN_QUALITY_THRESHOLD ${current.MIN_QUALITY_THRESHOLD} is outside reasonable range [0.5, 0.9]`);
  }
  
  if (current.MIN_RULE_QUALITY < 0.5 || current.MIN_RULE_QUALITY > 0.9) {
    issues.push(`MIN_RULE_QUALITY ${current.MIN_RULE_QUALITY} is outside reasonable range [0.5, 0.9]`);
  }
  
  // Check rollback thresholds are reasonable
  const rollback = current.CANARY_ROLLBACK_THRESHOLDS;
  if (rollback.PASS_RATE_DROP < 0.01 || rollback.PASS_RATE_DROP > 0.1) {
    issues.push(`PASS_RATE_DROP ${rollback.PASS_RATE_DROP} is outside reasonable range [0.01, 0.1]`);
  }
  
  if (rollback.QUALITY_DROP < 0.01 || rollback.QUALITY_DROP > 0.1) {
    issues.push(`QUALITY_DROP ${rollback.QUALITY_DROP} is outside reasonable range [0.01, 0.1]`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// Log current configuration
export function logQualityConfig(): void {
  const current = QUALITY_CONFIG.CURRENT;
  const env = process.env.QUALITY_ENV || 'development';
  
  console.log(`[QualityConfig] Environment: ${env}`);
  console.log(`[QualityConfig] MIN_QUALITY_THRESHOLD: ${current.MIN_QUALITY_THRESHOLD}`);
  console.log(`[QualityConfig] MIN_RULE_QUALITY: ${current.MIN_RULE_QUALITY}`);
  console.log(`[QualityConfig] Rollback thresholds:`, current.CANARY_ROLLBACK_THRESHOLDS);
  
  const validation = validateQualityConfig();
  if (!validation.valid) {
    console.warn('[QualityConfig] Validation issues:');
    validation.issues.forEach(issue => console.warn(`  - ${issue}`));
  } else {
    console.log('[QualityConfig] ✅ Configuration valid');
  }
}
