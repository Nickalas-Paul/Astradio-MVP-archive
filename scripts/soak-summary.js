#!/usr/bin/env node

/**
 * Soak Summary Generator
 * 
 * Aggregates 24-hour soak evidence and generates reports
 */

const fs = require('fs');
const path = require('path');

const EVIDENCE_FILE = 'artifacts/soak/soak-evidence.jsonl';
const REPORT_FILE = 'artifacts/soak/SOAK-REPORT.md';

class SoakSummary {
  constructor() {
    this.evidence = [];
    this.loadEvidence();
  }

  loadEvidence() {
    if (!fs.existsSync(EVIDENCE_FILE)) {
      console.log('No evidence file found, creating empty report');
      return;
    }

    try {
      const content = fs.readFileSync(EVIDENCE_FILE, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const parts = line.split(' ', 2);
          if (parts.length === 2) {
            const timestamp = parts[0];
            const data = JSON.parse(parts[1]);
            this.evidence.push({ timestamp, ...data });
          }
        } catch (error) {
          console.warn(`Failed to parse line: ${line}`);
        }
      }
      
      console.log(`Loaded ${this.evidence.length} evidence entries`);
    } catch (error) {
      console.error(`Failed to load evidence: ${error.message}`);
    }
  }

  generateHourlySummary() {
    const runId = process.env.GITHUB_RUN_ID || 'unknown';
    const runNumber = process.env.GITHUB_RUN_NUMBER || 'unknown';
    
    const recent = this.evidence.filter(e => {
      const time = new Date(e.timestamp);
      const now = new Date();
      return (now - time) < 3600000; // Last hour
    });

    const results = recent.filter(e => !e.isDeterminismTest);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;
    const errorRate = results.length > 0 ? (errorCount / results.length) : 0;

    const fallbacks = results.filter(r => r.fallbackUsed);
    const fallbackRate = results.length > 0 ? (fallbacks.length / results.length) : 0;

    const composeLatencies = results
      .map(r => r.composeLatencyMs)
      .filter(l => l !== null && l !== undefined)
      .sort((a, b) => a - b);
    
    const audioLatencies = results
      .map(r => r.audioStartupMs)
      .filter(l => l !== null && l !== undefined)
      .sort((a, b) => a - b);

    const composeP95 = composeLatencies.length > 0 ? 
      composeLatencies[Math.ceil(composeLatencies.length * 0.95) - 1] : 0;
    
    const audioP95 = audioLatencies.length > 0 ?
      audioLatencies[Math.ceil(audioLatencies.length * 0.95) - 1] : 0;

    const deterministic = recent.filter(e => e.isDeterminismTest).every(e => e.deterministic);

    return {
      runId,
      runNumber,
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      successCount,
      errorCount,
      errorRate: (errorRate * 100).toFixed(2),
      fallbackRate: (fallbackRate * 100).toFixed(2),
      composeP95,
      audioP95,
      deterministic: deterministic ? 'PASS' : 'FAIL'
    };
  }

  generateJobSummary() {
    const summary = this.generateHourlySummary();
    
    const jobSummary = `
## 🕐 Soak Hourly Summary (Run #${summary.runNumber})

**Tests:** ${summary.totalTests} total, ${summary.successCount} passed, ${summary.errorCount} failed
**Error Rate:** ${summary.errorRate}%
**Fallback Rate:** ${summary.fallbackRate}%
**Compose P95:** ${summary.composeP95}ms
**Audio P95:** ${summary.audioP95}ms
**Determinism:** ${summary.deterministic}

**Status:** ${summary.errorCount === 0 && summary.deterministic === 'PASS' ? '✅ PASS' : '❌ FAIL'}
`.trim();

    // Write to GitHub Actions summary if available
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
      fs.appendFileSync(summaryFile, jobSummary + '\n\n');
      console.log('Posted job summary to GitHub Actions');
    }

    console.log(jobSummary);
  }

  generateFullReport() {
    if (this.evidence.length === 0) {
      return '# Soak Report\n\nNo evidence data available.';
    }

    // Group by hour
    const hourlyData = {};
    
    for (const entry of this.evidence) {
      const hour = new Date(entry.timestamp).toISOString().slice(0, 13) + ':00:00Z';
      if (!hourlyData[hour]) {
        hourlyData[hour] = [];
      }
      hourlyData[hour].push(entry);
    }

    const hours = Object.keys(hourlyData).sort();
    const firstHour = hours[0];
    const lastHour = hours[hours.length - 1];

    // Calculate overall metrics
    const allResults = this.evidence.filter(e => !e.isDeterminismTest);
    const totalTests = allResults.length;
    const successCount = allResults.filter(r => r.success).length;
    const errorCount = totalTests - successCount;
    const errorRate = totalTests > 0 ? (errorCount / totalTests) : 0;

    const fallbacks = allResults.filter(r => r.fallbackUsed);
    const fallbackRate = totalTests > 0 ? (fallbacks.length / totalTests) : 0;

    const composeLatencies = allResults
      .map(r => r.composeLatencyMs)
      .filter(l => l !== null && l !== undefined)
      .sort((a, b) => a - b);
    
    const audioLatencies = allResults
      .map(r => r.audioStartupMs)
      .filter(l => l !== null && l !== undefined)
      .sort((a, b) => a - b);

    const composeP50 = composeLatencies.length > 0 ? 
      composeLatencies[Math.ceil(composeLatencies.length * 0.5) - 1] : 0;
    const composeP95 = composeLatencies.length > 0 ? 
      composeLatencies[Math.ceil(composeLatencies.length * 0.95) - 1] : 0;
    
    const audioP50 = audioLatencies.length > 0 ?
      audioLatencies[Math.ceil(audioLatencies.length * 0.5) - 1] : 0;
    const audioP95 = audioLatencies.length > 0 ?
      audioLatencies[Math.ceil(audioLatencies.length * 0.95) - 1] : 0;

    const determinismTests = this.evidence.filter(e => e.isDeterminismTest);
    const determinismPassed = determinismTests.filter(e => e.deterministic).length;
    const determinismRate = determinismTests.length > 0 ? (determinismPassed / determinismTests.length) : 0;

    // Generate hourly breakdown
    let hourlyTable = '| Hour | Tests | Success | Error Rate | Fallback Rate | Compose P95 | Audio P95 | Determinism |\n';
    hourlyTable += '|------|-------|---------|------------|---------------|-------------|-----------|-------------|\n';

    for (const hour of hours) {
      const hourResults = hourlyData[hour].filter(e => !e.isDeterminismTest);
      const hourSuccess = hourResults.filter(r => r.success).length;
      const hourErrorRate = hourResults.length > 0 ? ((hourResults.length - hourSuccess) / hourResults.length * 100).toFixed(1) : '0.0';
      
      const hourFallbacks = hourResults.filter(r => r.fallbackUsed);
      const hourFallbackRate = hourResults.length > 0 ? ((hourFallbacks.length / hourResults.length) * 100).toFixed(1) : '0.0';

      const hourComposeLatencies = hourResults
        .map(r => r.composeLatencyMs)
        .filter(l => l !== null && l !== undefined)
        .sort((a, b) => a - b);
      const hourComposeP95 = hourComposeLatencies.length > 0 ? 
        hourComposeLatencies[Math.ceil(hourComposeLatencies.length * 0.95) - 1] : 0;

      const hourAudioLatencies = hourResults
        .map(r => r.audioStartupMs)
        .filter(l => l !== null && l !== undefined)
        .sort((a, b) => a - b);
      const hourAudioP95 = hourAudioLatencies.length > 0 ?
        hourAudioLatencies[Math.ceil(hourAudioLatencies.length * 0.95) - 1] : 0;

      const hourDeterminism = hourlyData[hour].filter(e => e.isDeterminismTest);
      const hourDeterministic = hourDeterminism.length > 0 ? 
        (hourDeterminism.every(e => e.deterministic) ? 'PASS' : 'FAIL') : 'N/A';

      hourlyTable += `| ${hour.slice(11, 16)} | ${hourResults.length} | ${hourSuccess} | ${hourErrorRate}% | ${hourFallbackRate}% | ${hourComposeP95}ms | ${hourAudioP95}ms | ${hourDeterministic} |\n`;
    }

    // Generate ASCII trend for key metrics
    const trends = this.generateTrends(hours, hourlyData);

    const report = `# 24-Hour Staging Soak Report

**Period:** ${firstHour} to ${lastHour}  
**Generated:** ${new Date().toISOString()}

## Summary

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| **Total Tests** | ${totalTests} | - | - |
| **Success Rate** | ${((successCount / totalTests) * 100).toFixed(1)}% | ≥99% | ${errorRate <= 0.01 ? '✅' : '❌'} |
| **Error Rate** | ${(errorRate * 100).toFixed(2)}% | ≤1% | ${errorRate <= 0.01 ? '✅' : '❌'} |
| **Fallback Rate** | ${(fallbackRate * 100).toFixed(2)}% | ≤2% | ${fallbackRate <= 0.02 ? '✅' : '❌'} |
| **Compose P50** | ${composeP50}ms | - | - |
| **Compose P95** | ${composeP95}ms | ≤1800ms | ${composeP95 <= 1800 ? '✅' : '❌'} |
| **Audio P50** | ${audioP50}ms | - | - |
| **Audio P95** | ${audioP95}ms | ≤2500ms | ${audioP95 <= 2500 ? '✅' : '❌'} |
| **Determinism** | ${(determinismRate * 100).toFixed(1)}% | 100% | ${determinismRate >= 1.0 ? '✅' : '❌'} |

## Hourly Breakdown

${hourlyTable}

## Trends

### Compose Latency P95 (ms)
\`\`\`
${trends.composeP95}
\`\`\`

### Audio Startup P95 (ms)
\`\`\`
${trends.audioP95}
\`\`\`

### Fallback Rate (%)
\`\`\`
${trends.fallbackRate}
\`\`\`

## Threshold Analysis

${this.generateThresholdAnalysis(errorRate, fallbackRate, composeP95, audioP95, determinismRate)}

## Recommendations

${this.generateRecommendations(errorRate, fallbackRate, composeP95, audioP95, determinismRate)}

---

*Report generated by Soak Summary Generator v1.0*
`;

    return report;
  }

  generateTrends(hours, hourlyData) {
    const maxHours = 24;
    const scale = 20;
    
    const composeP95Values = hours.map(hour => {
      const hourResults = hourlyData[hour].filter(e => !e.isDeterminismTest);
      const latencies = hourResults
        .map(r => r.composeLatencyMs)
        .filter(l => l !== null && l !== undefined)
        .sort((a, b) => a - b);
      return latencies.length > 0 ? latencies[Math.ceil(latencies.length * 0.95) - 1] : 0;
    });

    const audioP95Values = hours.map(hour => {
      const hourResults = hourlyData[hour].filter(e => !e.isDeterminismTest);
      const latencies = hourResults
        .map(r => r.audioStartupMs)
        .filter(l => l !== null && l !== undefined)
        .sort((a, b) => a - b);
      return latencies.length > 0 ? latencies[Math.ceil(latencies.length * 0.95) - 1] : 0;
    });

    const fallbackValues = hours.map(hour => {
      const hourResults = hourlyData[hour].filter(e => !e.isDeterminismTest);
      const fallbacks = hourResults.filter(r => r.fallbackUsed);
      return hourResults.length > 0 ? (fallbacks.length / hourResults.length) * 100 : 0;
    });

    const maxCompose = Math.max(...composeP95Values, 1800);
    const maxAudio = Math.max(...audioP95Values, 2500);
    const maxFallback = Math.max(...fallbackValues, 2);

    const trends = {
      composeP95: this.generateAsciiChart(composeP95Values, maxCompose, scale, 'ms'),
      audioP95: this.generateAsciiChart(audioP95Values, maxAudio, scale, 'ms'),
      fallbackRate: this.generateAsciiChart(fallbackValues, maxFallback, scale, '%')
    };

    return trends;
  }

  generateAsciiChart(values, max, scale, unit) {
    let chart = '';
    const threshold = unit === 'ms' ? (unit === 'ms' && max > 1800 ? 1800 : 2500) : 2;
    
    for (let i = 0; i < Math.min(values.length, scale); i++) {
      const value = values[i] || 0;
      const height = Math.round((value / max) * 10);
      const bar = '█'.repeat(height) + '░'.repeat(10 - height);
      const hour = i.toString().padStart(2, '0');
      const status = value > threshold ? '❌' : '✅';
      chart += `${hour}: ${bar} ${value.toFixed(0)}${unit} ${status}\n`;
    }
    
    return chart.trim();
  }

  generateThresholdAnalysis(errorRate, fallbackRate, composeP95, audioP95, determinismRate) {
    const issues = [];
    
    if (errorRate > 0.01) {
      issues.push(`- **Error rate ${(errorRate * 100).toFixed(2)}% exceeds 1% threshold**`);
    }
    
    if (fallbackRate > 0.02) {
      issues.push(`- **Fallback rate ${(fallbackRate * 100).toFixed(2)}% exceeds 2% threshold**`);
    }
    
    if (composeP95 > 1800) {
      issues.push(`- **Compose P95 ${composeP95}ms exceeds 1800ms threshold**`);
    }
    
    if (audioP95 > 2500) {
      issues.push(`- **Audio P95 ${audioP95}ms exceeds 2500ms threshold**`);
    }
    
    if (determinismRate < 1.0) {
      issues.push(`- **Determinism ${(determinismRate * 100).toFixed(1)}% below 100% requirement**`);
    }

    if (issues.length === 0) {
      return '✅ **All thresholds met** - staging environment is performing within acceptable limits.';
    }

    return `❌ **Threshold violations detected:**\n\n${issues.join('\n')}`;
  }

  generateRecommendations(errorRate, fallbackRate, composeP95, audioP95, determinismRate) {
    const recommendations = [];

    if (errorRate > 0.01) {
      recommendations.push('- Investigate error patterns and staging environment stability');
    }

    if (fallbackRate > 0.02) {
      recommendations.push('- Review audio generation pipeline and fallback triggers');
    }

    if (composeP95 > 1800) {
      recommendations.push('- Optimize compose API performance and caching');
    }

    if (audioP95 > 2500) {
      recommendations.push('- Review audio generation and delivery pipeline');
    }

    if (determinismRate < 1.0) {
      recommendations.push('- Investigate non-deterministic behavior in compose pipeline');
    }

    if (recommendations.length === 0) {
      recommendations.push('- ✅ Staging environment is ready for beta handoff');
      recommendations.push('- Continue monitoring during beta phase');
    }

    return recommendations.join('\n');
  }

  async saveReport() {
    const report = this.generateFullReport();
    
    // Ensure directory exists
    const dir = path.dirname(REPORT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(REPORT_FILE, report);
    console.log(`📊 Saved full report to ${REPORT_FILE}`);
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const summary = new SoakSummary();
  
  if (args.includes('--hourly')) {
    const hourly = summary.generateHourlySummary();
    console.log('Hourly summary:', hourly);
  } else if (args.includes('--job-summary')) {
    summary.generateJobSummary();
  } else {
    summary.saveReport();
    console.log('Generated full 24-hour soak report');
  }
}

module.exports = SoakSummary;

