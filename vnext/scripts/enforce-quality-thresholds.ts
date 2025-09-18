// vnext/scripts/enforce-quality-thresholds.ts
// CI script to enforce quality thresholds based on environment

import { QUALITY_CONFIG, validateQualityConfig } from '../config/quality';

interface ThresholdEnforcement {
  environment: string;
  thresholds: any;
  validation: { valid: boolean; issues: string[] };
  enforcement: {
    passed: boolean;
    violations: string[];
    recommendations: string[];
  };
}

// Enforce minimum thresholds for different environments
function enforceEnvironmentThresholds(): ThresholdEnforcement {
  const environment = process.env.QUALITY_ENV || process.env.NODE_ENV || 'development';
  const thresholds = QUALITY_CONFIG.CURRENT;
  const validation = validateQualityConfig();
  
  const violations: string[] = [];
  const recommendations: string[] = [];
  
  // Environment-specific enforcement rules
  if (environment === 'production') {
    // Production must have high thresholds
    if (thresholds.MIN_QUALITY_THRESHOLD < 0.65) {
      violations.push(`Production MIN_QUALITY_THRESHOLD (${thresholds.MIN_QUALITY_THRESHOLD}) must be >= 0.65`);
      recommendations.push('Set QUALITY_ENV=production and update quality config');
    }
    
    if (thresholds.AUDITION_GATE_THRESHOLD < 0.65) {
      violations.push(`Production AUDITION_GATE_THRESHOLD (${thresholds.AUDITION_GATE_THRESHOLD}) must be >= 0.65`);
    }
    
    // Production rollback thresholds should be strict
    const rollback = thresholds.CANARY_ROLLBACK_THRESHOLDS;
    if (rollback.PASS_RATE_DROP > 0.03) {
      violations.push(`Production PASS_RATE_DROP threshold (${rollback.PASS_RATE_DROP}) should be <= 0.03`);
    }
    
    if (rollback.QUALITY_DROP > 0.02) {
      violations.push(`Production QUALITY_DROP threshold (${rollback.QUALITY_DROP}) should be <= 0.02`);
    }
    
  } else if (environment === 'pre-production' || environment === 'preprod') {
    // Pre-prod should have medium-high thresholds
    if (thresholds.MIN_QUALITY_THRESHOLD < 0.60) {
      violations.push(`Pre-production MIN_QUALITY_THRESHOLD (${thresholds.MIN_QUALITY_THRESHOLD}) must be >= 0.60`);
    }
    
  } else if (environment === 'development') {
    // Development should have reasonable minimums
    if (thresholds.MIN_QUALITY_THRESHOLD < 0.50) {
      violations.push(`Development MIN_QUALITY_THRESHOLD (${thresholds.MIN_QUALITY_THRESHOLD}) should be >= 0.50`);
      recommendations.push('Even in development, maintain minimum quality standards');
    }
    
    // Warn if dev thresholds are too high (might slow development)
    if (thresholds.MIN_QUALITY_THRESHOLD > 0.70) {
      recommendations.push(`Development threshold (${thresholds.MIN_QUALITY_THRESHOLD}) is very high - consider lowering for faster iteration`);
    }
  }
  
  // Cross-environment consistency checks
  if (thresholds.MIN_QUALITY_THRESHOLD !== thresholds.MIN_RULE_QUALITY) {
    recommendations.push(`MIN_QUALITY_THRESHOLD (${thresholds.MIN_QUALITY_THRESHOLD}) and MIN_RULE_QUALITY (${thresholds.MIN_RULE_QUALITY}) should be aligned`);
  }
  
  // CI-specific checks
  if (process.env.CI === 'true') {
    // CI should not allow undefined environment
    if (!process.env.QUALITY_ENV && !process.env.NODE_ENV) {
      violations.push('CI must define QUALITY_ENV or NODE_ENV for threshold enforcement');
    }
    
    // CI should have STRICT_ML enabled for consistency
    if (process.env.STRICT_ML !== 'true' && environment === 'production') {
      violations.push('Production CI must set STRICT_ML=true for backend consistency');
    }
  }
  
  const passed = violations.length === 0 && validation.valid;
  
  return {
    environment,
    thresholds,
    validation,
    enforcement: {
      passed,
      violations,
      recommendations
    }
  };
}

// Check threshold progression across environments
function checkThresholdProgression(): {
  valid: boolean;
  issues: string[];
} {
  const dev = QUALITY_CONFIG.DEVELOPMENT;
  const preprod = QUALITY_CONFIG.PRE_PRODUCTION;
  const prod = QUALITY_CONFIG.PRODUCTION;
  
  const issues: string[] = [];
  
  // Quality thresholds should increase: dev <= preprod <= prod
  if (dev.MIN_QUALITY_THRESHOLD > preprod.MIN_QUALITY_THRESHOLD) {
    issues.push(`Development threshold (${dev.MIN_QUALITY_THRESHOLD}) should not exceed pre-production (${preprod.MIN_QUALITY_THRESHOLD})`);
  }
  
  if (preprod.MIN_QUALITY_THRESHOLD > prod.MIN_QUALITY_THRESHOLD) {
    issues.push(`Pre-production threshold (${preprod.MIN_QUALITY_THRESHOLD}) should not exceed production (${prod.MIN_QUALITY_THRESHOLD})`);
  }
  
  // Rollback thresholds should decrease: dev >= preprod >= prod (more strict in prod)
  if (dev.CANARY_ROLLBACK_THRESHOLDS.PASS_RATE_DROP < prod.CANARY_ROLLBACK_THRESHOLDS.PASS_RATE_DROP) {
    issues.push(`Development rollback threshold should be more lenient than production`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// Main enforcement function
export function enforceQualityThresholds(): {
  passed: boolean;
  report: ThresholdEnforcement;
  progression: { valid: boolean; issues: string[] };
} {
  console.log('⚖️  Enforcing Quality Thresholds');
  console.log('=' .repeat(50));
  
  // Run enforcement checks
  const report = enforceEnvironmentThresholds();
  const progression = checkThresholdProgression();
  
  console.log(`📊 Environment: ${report.environment}`);
  console.log(`   MIN_QUALITY_THRESHOLD: ${report.thresholds.MIN_QUALITY_THRESHOLD}`);
  console.log(`   AUDITION_GATE_THRESHOLD: ${report.thresholds.AUDITION_GATE_THRESHOLD}`);
  console.log(`   Rollback Thresholds:`);
  console.log(`     Pass Rate Drop: ${report.thresholds.CANARY_ROLLBACK_THRESHOLDS.PASS_RATE_DROP}`);
  console.log(`     Quality Drop: ${report.thresholds.CANARY_ROLLBACK_THRESHOLDS.QUALITY_DROP}`);
  
  // Report validation issues
  if (!report.validation.valid) {
    console.log('\n❌ Configuration Validation Issues:');
    report.validation.issues.forEach(issue => console.log(`   • ${issue}`));
  }
  
  // Report enforcement violations
  if (report.enforcement.violations.length > 0) {
    console.log('\n❌ Threshold Enforcement Violations:');
    report.enforcement.violations.forEach(violation => console.log(`   • ${violation}`));
  }
  
  // Report recommendations
  if (report.enforcement.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.enforcement.recommendations.forEach(rec => console.log(`   • ${rec}`));
  }
  
  // Report progression issues
  if (!progression.valid) {
    console.log('\n⚠️  Threshold Progression Issues:');
    progression.issues.forEach(issue => console.log(`   • ${issue}`));
  }
  
  const overallPassed = report.enforcement.passed && progression.valid;
  
  console.log('\n' + '=' .repeat(50));
  console.log(`🎯 Threshold Enforcement: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!overallPassed) {
    console.log('\n🔧 To fix:');
    if (!report.enforcement.passed) {
      console.log('   1. Update quality config for current environment');
      console.log('   2. Set appropriate QUALITY_ENV or NODE_ENV');
    }
    if (!progression.valid) {
      console.log('   3. Ensure threshold progression: dev <= preprod <= prod');
    }
  }
  
  return {
    passed: overallPassed,
    report,
    progression
  };
}

// Generate environment-specific deployment config
export function generateDeploymentConfig(targetEnv: 'development' | 'pre-production' | 'production'): string {
  const config = QUALITY_CONFIG[targetEnv.toUpperCase().replace('-', '_') as keyof typeof QUALITY_CONFIG];
  
  const envVars = [
    `QUALITY_ENV=${targetEnv}`,
    `MIN_QUALITY_THRESHOLD=${config.MIN_QUALITY_THRESHOLD}`,
    `AUDITION_GATE_THRESHOLD=${config.AUDITION_GATE_THRESHOLD}`,
    `PASS_RATE_DROP_THRESHOLD=${config.CANARY_ROLLBACK_THRESHOLDS.PASS_RATE_DROP}`,
    `QUALITY_DROP_THRESHOLD=${config.CANARY_ROLLBACK_THRESHOLDS.QUALITY_DROP}`,
  ];
  
  if (targetEnv === 'production') {
    envVars.push('STRICT_ML=true');
    envVars.push('NODE_ENV=production');
  }
  
  return envVars.join('\n');
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'check' || !command) {
    const result = enforceQualityThresholds();
    process.exit(result.passed ? 0 : 1);
    
  } else if (command === 'generate-config') {
    const targetEnv = process.argv[3] as 'development' | 'pre-production' | 'production';
    
    if (!targetEnv || !['development', 'pre-production', 'production'].includes(targetEnv)) {
      console.error('Usage: npm run enforce-thresholds generate-config <development|pre-production|production>');
      process.exit(1);
    }
    
    console.log(`# Environment variables for ${targetEnv}`);
    console.log(generateDeploymentConfig(targetEnv));
    
  } else {
    console.log('Usage:');
    console.log('  npm run enforce-thresholds [check]                    - Check threshold enforcement');
    console.log('  npm run enforce-thresholds generate-config <env>      - Generate deployment config');
  }
}
