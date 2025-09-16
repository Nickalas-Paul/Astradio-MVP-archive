// audition-runner.ts - Main orchestrator for Teacher Audition

import { ChartContext, AuditionCase, AuditionSummary, Vector6 } from './contracts';
import { Teacher } from './teacher';
import { Generator } from './generator';
import { QualityGates } from './quality-gates';
import { RenderClient } from './render-client';
import { Telemetry } from './telemetry';

export class AuditionRunner {
  private teacher: Teacher;
  private generator: Generator;
  private qualityGates: QualityGates;
  private renderClient: RenderClient;
  private telemetry: Telemetry;

  constructor() {
    this.teacher = new Teacher();
    this.generator = new Generator();
    this.qualityGates = new QualityGates();
    this.renderClient = new RenderClient();
    this.telemetry = new Telemetry();
  }

  async run(charts: ChartContext[]): Promise<AuditionSummary> {
    console.log(`[Audition] Starting Teacher Audition with ${charts.length} charts`);
    
    try {
      // Initialize teacher (loads scaler)
      await this.teacher.initialize();
      
      const cases: AuditionCase[] = [];
      const rawVectors: number[][] = [];
      
      // Process each chart
      for (let i = 0; i < charts.length; i++) {
        const chart = charts[i];
        console.log(`[Audition] Processing Chart ${i + 1}/${charts.length}`);
        
        try {
          // Predict vector
          const { raw, clamped } = await this.teacher.predictVector(chart, i);
          rawVectors.push(raw);
          
          // Generate composition
          const composition = this.generator.generate(chart, clamped);
          
          // Evaluate quality
          const quality = this.qualityGates.evaluate(composition);
          
          const auditionCase: AuditionCase = {
            chartIndex: i,
            chart,
            vector_raw: raw,
            vector: clamped,
            composition,
            quality
          };
          
          cases.push(auditionCase);
          
        } catch (error) {
          console.warn(`[Audition] Chart ${i + 1} failed: ${error.message}`);
          cases.push({
            chartIndex: i,
            chart,
            error: error.message
          });
        }
      }
      
      // Calculate pre-clamp variance
      const preClampVariance = this.telemetry.calculatePreClampVariance(rawVectors);
      
      // Check variance requirements
      const highVarianceDims = Object.values(preClampVariance).filter(v => v >= 0.05).length;
      if (highVarianceDims < 4) {
        console.warn(`[Audition] Model output variance insufficient after real scaling: failing audition`);
        console.warn(`[Audition] Pre-clamp variance by dim:`, preClampVariance);
      }
      
      // Log gate results
      const qualityResults = cases.filter(c => c.quality).map(c => c.quality!);
      this.telemetry.logGateResults(qualityResults);
      
      // Select winner
      const passingCases = cases.filter(c => c.quality?.passed);
      const winner = this.selectWinner(passingCases);
      
      // Render audio for winner
      let winnerIndex: number | undefined;
      if (winner) {
        try {
          const renderUrl = await this.renderClient.render(
            winner.composition!,
            winner.chart,
            winner.vector!,
            winner.composition!.meta.bpm
          );
          
          winner.renderUrl = renderUrl;
          winnerIndex = winner.chartIndex;
          
          this.telemetry.logWinnerSelection(winnerIndex, winner.quality!.score, renderUrl);
        } catch (error) {
          console.error(`[Audition] Failed to render winner: ${error.message}`);
        }
      } else {
        this.telemetry.logWinnerSelection(null, 0);
      }
      
      const summary: AuditionSummary = {
        total: cases.length,
        passed: passingCases.length,
        failed: cases.length - passingCases.length,
        preClampVariance,
        winnerIndex,
        cases
      };
      
      console.log(`[Audition] Audition complete: ${summary.passed}/${summary.total} passed`);
      return summary;
      
    } catch (error) {
      console.error(`[Audition] Audition failed: ${error.message}`);
      throw error;
    }
  }

  private selectWinner(passingCases: AuditionCase[]): AuditionCase | null {
    if (passingCases.length === 0) return null;
    
    // Select highest scoring case
    return passingCases.reduce((best, current) => {
      const bestScore = best.quality?.score || 0;
      const currentScore = current.quality?.score || 0;
      return currentScore > bestScore ? current : best;
    });
  }
}

// Integration function for existing UI
export async function initAuditionRunner(charts: ChartContext[]): Promise<AuditionSummary> {
  const runner = new AuditionRunner();
  return await runner.run(charts);
}
