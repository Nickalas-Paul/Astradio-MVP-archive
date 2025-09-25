/**
 * Explainer Atoms Generator v1.1
 * Deterministic generation of semantic facts from control-surface payload (Unified Spec v1.1)
 */

import { ControlSurfacePayload, ExplainerAtoms, AstroSummary } from './contracts';
import { MappingTable } from './contracts';
import * as fs from 'fs';
import * as path from 'path';

export class AtomsGenerator {
  private mappingTable: MappingTable;
  private seed: string = "";

  constructor(mappingTablePath?: string) {
    const builtPath = path.resolve(__dirname, 'mapping-tables-v1.json');
    const sourcePath = path.resolve(__dirname, '../../../vnext/explainer/mapping-tables-v1.json');
    const chosenPath = mappingTablePath || (fs.existsSync(builtPath) ? builtPath : sourcePath);
    this.mappingTable = JSON.parse(fs.readFileSync(chosenPath, 'utf8'));
  }

  /**
   * Generate explainer atoms from control-surface payload and astro summary
   */
  generateAtoms(payload: ControlSurfacePayload, astro?: AstroSummary): ExplainerAtoms {
    this.seed = payload.hash;
    
    // Create default astro summary if not provided
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
      ts: new Date().toISOString()
    };
    
    return {
      arc_desc: this.generateArcDescription(payload.arc_shape, astroSummary.elements),
      movement: this.generateMovementDescription(payload.step_bias, payload.leap_cap, astroSummary.dominant_planets),
      rhythm_feel: this.generateRhythmFeeling(payload.rhythm_template_id, payload.syncopation_bias, astroSummary.dominant_planets),
      density_desc: this.generateDensityDescription(payload.density_level, astroSummary.dominant_planets),
      motif_desc: this.generateMotifDescription(payload.motif_rate),
      astro_color: this.generateAstroColor(astroSummary.elements, astroSummary.dominant_planets)
    };
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