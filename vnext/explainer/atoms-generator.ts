/**
 * Explainer Atoms Generator v1.1 + V1-B
 * Deterministic generation of semantic facts from control-surface payload (Unified Spec v1.1)
 */

import { ControlSurfacePayload, ExplainerAtoms, AstroSummary, GateReport } from './contracts';
import { MappingTable } from './contracts';
import type { PlanSummary } from './plan-summary';
import type { GuidanceSummary } from './guidance-atoms';
import * as fs from 'fs';
import * as path from 'path';

export interface AtomsGeneratorOptions {
  planSummary?: PlanSummary;
  guidanceSummary?: GuidanceSummary;
  gateReport?: GateReport;
}

export class AtomsGenerator {
  private mappingTable: MappingTable;
  private seed: string = "";

  constructor(mappingTablePath?: string) {
    const chosenPath = this.resolveMappingTablePath(mappingTablePath);
    this.mappingTable = JSON.parse(fs.readFileSync(chosenPath, 'utf8'));
  }

  private resolveMappingTablePath(mappingTablePath?: string): string {
    if (mappingTablePath) return path.resolve(mappingTablePath);
    const v2Built = path.resolve(__dirname, 'mapping-tables-v2.json');
    const v2Source = path.resolve(__dirname, '../../../vnext/explainer/mapping-tables-v2.json');
    const v2 = fs.existsSync(v2Built) ? v2Built : (fs.existsSync(v2Source) ? v2Source : null);
    if (v2) return v2;
    const v1Built = path.resolve(__dirname, 'mapping-tables-v1.json');
    const v1Source = path.resolve(__dirname, '../../../vnext/explainer/mapping-tables-v1.json');
    return fs.existsSync(v1Built) ? v1Built : v1Source;
  }

  /**
   * Generate explainer atoms from control-surface payload and optional astro / plan / guidance
   */
  generateAtoms(
    payload: ControlSurfacePayload,
    astro?: AstroSummary,
    options?: AtomsGeneratorOptions
  ): ExplainerAtoms {
    this.seed = payload.hash;

    const astroSummary = astro || {
      elements: {
        fire: payload.element_dominance === 'fire' ? 0.6 : 0.1,
        earth: payload.element_dominance === 'earth' ? 0.6 : 0.1,
        air: payload.element_dominance === 'air' ? 0.6 : 0.1,
        water: payload.element_dominance === 'water' ? 0.6 : 0.1
      },
      dominant_planets: [],
      modality: {
        cardinal: payload.modality === 'cardinal' ? 0.6 : 0.1,
        fixed: payload.modality === 'fixed' ? 0.6 : 0.1,
        mutable: payload.modality === 'mutable' ? 0.6 : 0.1
      },
      ts: ''
    };

    const base: ExplainerAtoms = {
      arc_desc: this.generateArcDescription(payload.arc_shape, astroSummary.elements),
      movement: this.generateMovementDescription(payload.step_bias, payload.leap_cap, astroSummary.dominant_planets),
      rhythm_feel: this.generateRhythmFeeling(payload.rhythm_template_id, payload.syncopation_bias, astroSummary.dominant_planets),
      density_desc: this.generateDensityDescription(payload.density_level, astroSummary.dominant_planets),
      motif_desc: this.generateMotifDescription(payload.motif_rate),
      astro_color: this.generateAstroColor(astroSummary.elements, astroSummary.dominant_planets)
    };

    if (options?.guidanceSummary || options?.planSummary || options?.gateReport) {
      if (options.guidanceSummary) {
        base.psych_tone = this.buildPsychTone(astroSummary.elements, options.guidanceSummary);
        base.motion_profile_line = this.buildMotionProfileLine(options.guidanceSummary);
      }
      if (options.planSummary) {
        base.music_facts_line = this.buildMusicFactsLine(options.planSummary);
      }
      base.phase_story_lines = this.buildPhaseStoryLines();
      if (options.gateReport && !options.gateReport.calibrated?.overall) {
        base.gate_line = this.buildGateLine(options.gateReport);
      }
    }

    return base;
  }

  private buildPsychTone(elements: AstroSummary['elements'], g: GuidanceSummary): string {
    let top = 'balanced';
    let max = 0;
    for (const [el, v] of Object.entries(elements)) {
      if ((v as number) > max) {
        max = v as number;
        top = el;
      }
    }
    const adj = (this.mappingTable.astro_colors?.element_adjectives as Record<string, string>)?.[top] ?? top;
    const tensionPhrase = g.tension === 'high' ? ' with noticeable tension' : g.tension === 'low' ? ' with low tension' : '';
    return `Temperament leans ${adj}${tensionPhrase}.`;
  }

  private buildMotionProfileLine(g: GuidanceSummary): string {
    const parts: string[] = [];
    if (g.motion !== 'med') parts.push(`Motion ${g.motion}`);
    if (g.gravity !== 'med') parts.push(`gravity ${g.gravity}`);
    if (g.flow !== 'med') parts.push(`flow ${g.flow}`);
    if (g.shimmer !== 'med') parts.push(`shimmer ${g.shimmer}`);
    if (parts.length === 0) return 'Motion and weight are moderate.';
    return parts.join(', ') + '.';
  }

  private buildPhaseStoryLines(): [string, string, string] {
    const encounter = [
      'Encounter: the opening establishes a clear harmonic center.',
      'Encounter: the start grounds the listener in one tonal space.'
    ];
    const recognition = [
      'Recognition: the middle section introduces melodic movement and contrast.',
      'Recognition: the middle opens up motion and variety.'
    ];
    const integration = [
      'Integration: the close settles back toward the tonic.',
      'Integration: the end resolves with a pull to home.'
    ];
    return [
      this.selectBySeed(encounter, 'phase_enc'),
      this.selectBySeed(recognition, 'phase_rec'),
      this.selectBySeed(integration, 'phase_int')
    ];
  }

  private buildMusicFactsLine(ps: PlanSummary): string {
    const tempoBucket = ps.bpm < 90 ? 'a slow range' : ps.bpm > 120 ? 'a brisk range' : 'a moderate range';
    const density = ps.densityBucket;
    let register = 'mid register';
    if (ps.registerMax != null && ps.registerMin != null) {
      const mid = (ps.registerMax + ps.registerMin) / 2;
      if (mid < 70) register = 'low register';
      else if (mid > 78) register = 'high register';
    }
    return `Tempo sits in ${tempoBucket}, density is ${density}, register leans ${register}.`;
  }

  private buildGateLine(gateReport: GateReport): string {
    const failed: string[] = [];
    if (!gateReport.calibrated?.melody_arc) failed.push('instability');
    if (!gateReport.calibrated?.melody_step_leap || !gateReport.calibrated?.rhythm_diversity) failed.push('repetition');
    if (!gateReport.calibrated?.melody_narrative) failed.push('sparsity');
    if (failed.length === 0) return 'Some gates did not pass.';
    return `Quality gates suggest: ${[...new Set(failed)].join(' and ')}.`;
  }

  /**
   * Generate arc description from arc_shape + element tint (Section B1)
   */
  private generateArcDescription(arcShape: number, elements: any): string {
    // Shape detection based on arc_shape value (Unified Spec v1.1)
    let shapeType: string;
    if (arcShape >= 0.6) {
      shapeType = 'rise_peak_release';
    } else if (arcShape >= 0.4 && arcShape < 0.6) {
      shapeType = 'gentle_wave';
    } else if (arcShape >= 0.2 && arcShape < 0.4) {
      shapeType = 'plateau_hold';
    } else {
      shapeType = 'mixed_rise_release';
    }
    
    // Element tint (add phrase)
    let elementTint = this.getElementTint(elements);
    
    // Select template by seed
    const templates = this.mappingTable.arc_descriptions[shapeType].templates || this.mappingTable.arc_descriptions[shapeType].phrases;
    const template = this.selectBySeed(templates, 'arc');
    
    return template.replace('{tint}', elementTint);
  }

  /**
   * Generate movement description from step_bias, leap_cap, planet tint (Section B2)
   */
  private generateMovementDescription(stepBias: number, leapCap: number, dominantPlanets: string[]): string {
    // Primary bucket by step_bias (exact cutoffs per Unified Spec v1.1)
    let primary: string = this.mappingTable.movement_descriptions.balanced.primary || this.mappingTable.movement_descriptions.balanced.phrases?.[0] || "balanced movement.";
    
    if (stepBias >= 0.70) {
      primary = this.mappingTable.movement_descriptions.stepwise_heavy.primary || this.mappingTable.movement_descriptions.stepwise_heavy.phrases?.[0] || primary;
    } else if (stepBias >= 0.40 && stepBias <= 0.69) {
      primary = this.mappingTable.movement_descriptions.balanced.primary || this.mappingTable.movement_descriptions.balanced.phrases?.[0] || primary;
    } else {
      primary = this.mappingTable.movement_descriptions.leaping_lead.primary || this.mappingTable.movement_descriptions.leaping_lead.phrases?.[0] || primary;
    }
    
    // Modifier by leap_cap (exact cutoffs)
    let modifier = '';
    if (leapCap >= 5) {
      modifier = this.mappingTable.leap_modifiers?.wide_reaches?.modifier || '';
    } else if (leapCap <= 2) {
      modifier = this.mappingTable.leap_modifiers?.close_careful?.modifier || '';
    }
    
    // Planet tint (if present in dominant_planets)
    let planetTint = '';
    for (const planet of dominantPlanets) {
      const planetPhrase = this.mappingTable.planet_tints?.[planet];
      if (planetPhrase) {
        planetTint = ` — ${planetPhrase}`;
        break; // Use first matching planet
      }
    }
    
    return `${primary}${modifier}${planetTint}.`;
  }

  /**
   * Generate rhythm feeling from rhythm_template_id, syncopation_bias, planet tint (Section B3)
   */
  private generateRhythmFeeling(templateId: number, syncopationBias: number, dominantPlanets: string[]): string {
    // Template class
    let rhythmClass: string;
    
    if (templateId >= 0 && templateId <= 2) {
      rhythmClass = this.mappingTable.rhythm_classes.simple_even.class;
    } else if (templateId >= 3 && templateId <= 4) {
      rhythmClass = this.mappingTable.rhythm_classes.lightly_shifting.class;
    } else if (templateId >= 5 && templateId <= 6) {
      rhythmClass = this.mappingTable.rhythm_classes.strong_accented.class;
    } else {
      rhythmClass = this.mappingTable.rhythm_classes.fluid_open.class;
    }
    
    // Syncopation (exact cutoffs per Unified Spec v1.1)
    let syncopation: string;
    if (syncopationBias >= 0.60) {
      syncopation = this.mappingTable.syncopation_descriptions.pronounced.description;
    } else if (syncopationBias >= 0.30 && syncopationBias <= 0.59) {
      syncopation = this.mappingTable.syncopation_descriptions.subtle.description;
    } else {
      syncopation = this.mappingTable.syncopation_descriptions.straight.description;
    }
    
    return `${rhythmClass}, ${syncopation}.`;
  }

  /**
   * Generate density description from density_level, stellium check (Section B4)
   */
  private generateDensityDescription(densityLevel: number, dominantPlanets: string[]): string {
    let baseDescription: string = this.mappingTable.density_descriptions.balanced.description || 'balanced texture.';
    
    if (densityLevel >= 0.0 && densityLevel <= 0.3) {
      baseDescription = this.mappingTable.density_descriptions.sparse.description || baseDescription;
    } else if (densityLevel >= 0.4 && densityLevel <= 0.6) {
      baseDescription = this.mappingTable.density_descriptions.balanced.description || baseDescription;
    } else {
      baseDescription = this.mappingTable.density_descriptions.dense.description || baseDescription;
    }
    
    // Stellium check (≥3 planets clustered)
    const stelliumSuffix = dominantPlanets.length >= 3 ? 
      ((this.mappingTable.density_descriptions as any).stellium_suffix?.suffix || '') : '';
    
    return baseDescription + stelliumSuffix;
  }

  /**
   * Generate motif description from motif_rate (Section B6)
   */
  private generateMotifDescription(motifRate: number): string {
    if (motifRate > 0.7) {
      return this.mappingTable.motif_descriptions.frequent.description || 'frequent motifs.';
    } else if (motifRate >= 0.4 && motifRate <= 0.7) {
      return this.mappingTable.motif_descriptions.moderate.description || 'moderate motifs.';
    } else {
      return this.mappingTable.motif_descriptions.sparse.description || 'sparse motifs.';
    }
  }

  /**
   * Generate astro color from elements and dominant planets (Section B7)
   */
  private generateAstroColor(elements: any, dominantPlanets: string[]): string {
    // Find top element
    let topElement = '';
    let maxElementValue = 0;
    
    for (const [element, value] of Object.entries(elements)) {
      if ((value as number) > maxElementValue) {
        maxElementValue = value as number;
        topElement = element;
      }
    }
    
    const elementAdj = this.mappingTable.astro_colors.element_adjectives[topElement] || 'balanced';
    
    // Find first matching planet adjective
    let planetAdj = '';
    for (const planet of dominantPlanets) {
      const adj = this.mappingTable.astro_colors.planet_adjectives[planet];
      if (adj) {
        planetAdj = adj;
        break;
      }
    }
    
    if (!planetAdj) {
      planetAdj = 'balanced';
    }
    
    return `Tone: ${elementAdj}, ${planetAdj}.`;
  }

  /**
   * Get element tint phrase
   */
  private getElementTint(elements: any): string {
    for (const [element, value] of Object.entries(elements)) {
      if ((value as number) > 0.4) {
        return this.mappingTable.element_tints[element].phrase;
      }
    }
    return this.mappingTable.element_tints.none.phrase;
  }

  /**
   * Select by seed for deterministic variation
   */
  private selectBySeed(options: string[], context: string): string {
    if (options.length === 0) return `default ${context}`;
    if (options.length === 1) return options[0];
    
    const hashValue = this.hashString(this.seed + context);
    const index = hashValue % options.length;
    
    return options[index];
  }

  /**
   * Simple hash function for deterministic selection
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}