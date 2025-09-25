/**
 * Text Explainer v1.0
 * Main orchestrator for generating text explanations from control-surface payload
 */

import { 
  ControlSurfacePayload, 
  TextExplainer as TextExplainerContract, 
  GateReport, 
  ExplainerConfig,
  ExplainerMetrics,
  ExplainerContext 
} from './contracts';
import { AtomsGenerator } from './atoms-generator';
import { TextRealizer } from './text-realizer';

export class TextExplainerEngine {
  private atomsGenerator: AtomsGenerator;
  private textRealizer: TextRealizer;
  private config: ExplainerConfig;

  constructor(config: ExplainerConfig = {
    style: 'concise',
    maxLength: { short: 120, long: 300 },
    failMode: 'hints',
    deterministic: true
  }) {
    this.config = config;
    this.atomsGenerator = new AtomsGenerator();
    this.textRealizer = new TextRealizer();
  }

  /**
   * Generate complete text explanation from control-surface payload
   */
  generateExplanation(
    payload: ControlSurfacePayload,
    gateReport: GateReport,
    context: ExplainerContext
  ): { text: TextExplainerContract; metrics: ExplainerMetrics } {
    const startTime = process.hrtime.bigint();
    
    // Generate atoms (deterministic semantic facts)
    const atomsStartTime = process.hrtime.bigint();
    const atoms = this.atomsGenerator.generateAtoms(payload);
    const atomsEndTime = process.hrtime.bigint();
    const atomsMs = Number(atomsEndTime - atomsStartTime) / 1000000;
    
    // Generate text from atoms
    const realizerStartTime = process.hrtime.bigint();
    const text = this.textRealizer.generateText(atoms, gateReport, payload.hash) as any;
    const realizerEndTime = process.hrtime.bigint();
    const realizerMs = Number(realizerEndTime - realizerStartTime) / 1000000;
    
    const totalEndTime = process.hrtime.bigint();
    const totalMs = Number(totalEndTime - startTime) / 1000000;
    
    // Extract adjectives used
    const adjectivesUsed = this.extractAdjectives(text);
    
    // Determine gate status
    // Spec v1.1: fail-closed uses calibrated gates
    const gateStatus = gateReport.calibrated.overall ? 'pass' : 'fail';
    const failReason = gateStatus === 'fail' ? this.getFailReason(gateReport) : undefined;
    
    const metrics: ExplainerMetrics = {
      atoms_generation_ms: atomsMs,
      realizer_ms: realizerMs,
      total_ms: totalMs,
      template_id: text.template_id,
      atoms_count: Object.keys(atoms).length,
      adjectives_used: adjectivesUsed,
      gate_status: gateStatus,
      fail_reason: failReason
    };
    
    // Attach seed for determinism in response contract
    (text as any).seed = payload.hash;

    // Log observability data (Unified Spec v1.1)
    const calibratedPass = !!gateReport?.calibrated?.overall;
    console.log(`[TEXT_EXPLAINER] controls.hash=${payload.hash}, template_id=${text.template_id}, ` +
      `gate_scores=${JSON.stringify(gateReport.scores)}, latency_ms.text_total=${totalMs.toFixed(2)}, ` +
      `fail_closed_text=${!calibratedPass}`);
    
    return { text: text as unknown as TextExplainerContract, metrics };
  }

  /**
   * Generate overlay explanation comparing two control surfaces
   */
  generateOverlayExplanation(
    natalPayload: ControlSurfacePayload,
    currentPayload: ControlSurfacePayload,
    natalGateReport: GateReport,
    currentGateReport: GateReport,
    context: ExplainerContext
  ): { text: TextExplainerContract; metrics: ExplainerMetrics } {
    // Calculate delta between natal and current
    const deltaPayload = this.calculateDelta(natalPayload, currentPayload);
    
    // Generate base explanation for current
    const baseResult = this.generateExplanation(currentPayload, currentGateReport, context);
    
    // Modify text to include overlay context
    const overlayText = this.addOverlayContext(baseResult.text, deltaPayload, natalGateReport, currentGateReport);
    
    return {
      text: overlayText,
      metrics: baseResult.metrics
    };
  }

  /**
   * Generate sandbox explanation with user control hints
   */
  generateSandboxExplanation(
    userPayload: Partial<ControlSurfacePayload>,
    defaultPayload: ControlSurfacePayload,
    gateReport: GateReport,
    context: ExplainerContext
  ): { text: TextExplainerContract; metrics: ExplainerMetrics } {
    // Merge user controls with defaults
    const mergedPayload = { ...defaultPayload, ...userPayload };
    
    // Generate base explanation
    const baseResult = this.generateExplanation(mergedPayload, gateReport, context);
    
    // Add sandbox-specific hints
    const sandboxText = this.addSandboxHints(baseResult.text, userPayload, gateReport);
    
    return {
      text: sandboxText,
      metrics: baseResult.metrics
    };
  }

  /**
   * Calculate delta between two control surfaces
   */
  private calculateDelta(natal: ControlSurfacePayload, current: ControlSurfacePayload): Partial<ControlSurfacePayload> {
    const delta: Partial<ControlSurfacePayload> = {};
    
    // Calculate differences for numeric values
    const numericFields = ['arc_shape', 'density_level', 'tempo_norm', 'step_bias', 'leap_cap', 'syncopation_bias', 'motif_rate'];
    
    numericFields.forEach(field => {
      const natalValue = natal[field as keyof ControlSurfacePayload] as number;
      const currentValue = current[field as keyof ControlSurfacePayload] as number;
      
      if (Math.abs(currentValue - natalValue) > 0.1) {
        (delta as any)[field] = currentValue - natalValue;
      }
    });
    
    // Check for categorical changes
    if (natal.rhythm_template_id !== current.rhythm_template_id) {
      delta.rhythm_template_id = current.rhythm_template_id;
    }
    
    if (natal.element_dominance !== current.element_dominance) {
      delta.element_dominance = current.element_dominance;
    }
    
    return delta;
  }

  /**
   * Add overlay context to text
   */
  private addOverlayContext(
    text: TextExplainerContract,
    delta: Partial<ControlSurfacePayload>,
    natalGateReport: GateReport,
    currentGateReport: GateReport
  ): TextExplainerContract {
    if (Object.keys(delta).length === 0) {
      return text;
    }
    
    // Add overlay prefix
    const overlayPrefix = "Compared to your natal chart, today's transits add ";
    const deltaDescriptions = this.describeDeltas(delta);
    
    const modifiedText = {
      ...text,
      short: overlayPrefix + deltaDescriptions + ". " + text.short,
      long: overlayPrefix + deltaDescriptions + ". " + text.long,
      bullets: [
        `• ${deltaDescriptions} compared to natal`,
        ...text.bullets
      ]
    };
    
    return modifiedText;
  }

  /**
   * Add sandbox hints to text
   */
  private addSandboxHints(
    text: TextExplainerContract,
    userPayload: Partial<ControlSurfacePayload>,
    gateReport: GateReport
  ): TextExplainerContract {
    if (gateReport.strict.overall) {
      return text;
    }
    
    // Add sandbox-specific suggestions
    const suggestions = this.generateSandboxSuggestions(userPayload, gateReport);
    
    const modifiedText = {
      ...text,
      bullets: [
        ...text.bullets,
        "• Sandbox suggestions:",
        ...suggestions.map(s => `  - ${s}`)
      ]
    };
    
    return modifiedText;
  }

  /**
   * Describe deltas in human-readable terms
   */
  private describeDeltas(delta: Partial<ControlSurfacePayload>): string {
    const descriptions: string[] = [];
    
    // Thresholds per v1.1: step_bias ≥ 0.10
    if (delta.step_bias !== undefined && Math.abs(delta.step_bias) >= 0.10) {
      if (delta.step_bias > 0) {
        descriptions.push("more stepwise motion");
      } else {
        descriptions.push("more leaping motion");
      }
    }
    
    // Thresholds per v1.1: syncopation_bias ≥ 0.15
    if (delta.syncopation_bias !== undefined && Math.abs(delta.syncopation_bias) >= 0.15) {
      if (delta.syncopation_bias > 0) {
        descriptions.push("increased syncopation");
      } else {
        descriptions.push("reduced syncopation");
      }
    }
    
    // Thresholds per v1.1: density_level ≥ 0.20
    if (delta.density_level !== undefined && Math.abs(delta.density_level) >= 0.20) {
      if (delta.density_level > 0) {
        descriptions.push("richer texture");
      } else {
        descriptions.push("sparser texture");
      }
    }
    
    if (delta.element_dominance !== undefined) {
      descriptions.push(`${delta.element_dominance} influence`);
    }
    
    return descriptions.join(", ");
  }

  /**
   * Generate sandbox suggestions for failed gates
   */
  private generateSandboxSuggestions(userPayload: Partial<ControlSurfacePayload>, gateReport: GateReport): string[] {
    const suggestions: string[] = [];
    
    if (!gateReport.strict.melody_step_leap) {
      if (gateReport.scores.melody_step_leap < 0.2) {
        suggestions.push("Try increasing step_bias (more stepwise motion)");
        suggestions.push("Try decreasing leap_cap (smaller leaps)");
      } else {
        suggestions.push("Try decreasing step_bias (more leaping motion)");
        suggestions.push("Try increasing leap_cap (larger leaps)");
      }
    }
    
    if (!gateReport.strict.rhythm_diversity) {
      suggestions.push("Try different rhythm_template_id (0-7)");
      suggestions.push("Try adjusting syncopation_bias (0-1)");
    }
    
    if (!gateReport.strict.melody_arc) {
      suggestions.push("Try different arc_shape values");
    }
    
    return suggestions;
  }

  /**
   * Extract adjectives used in text
   */
  private extractAdjectives(text: TextExplainerContract): string[] {
    const allText = text.short + ' ' + text.long + ' ' + text.bullets.join(' ');
    const adjectives = allText.match(/\b(gentle|soft|smooth|gradual|steady|moderate|clear|confident|dramatic|bold|powerful|sharp|complex|intricate|layered|nuanced|balanced|harmonious|well-proportioned|controlled|restrained|measured|disciplined|wide|expansive|broad|extended|light|airy|floating|rich|full|lush|satisfying|dense|thick|layered|frequent|occasional|sparse|cohesive|unifying|binding|connecting)\b/gi);
    
    return [...new Set(adjectives || [])];
  }

  /**
   * Get fail reason for metrics
   */
  private getFailReason(gateReport: GateReport): string {
    const failedGates = Object.entries(gateReport.strict)
      .filter(([gate, passed]) => !passed && gate !== 'overall')
      .map(([gate]) => gate);
    
    return failedGates.join(', ');
  }
}
