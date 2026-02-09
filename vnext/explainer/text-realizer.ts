/**
 * Text Realizer v1.1
 * Converts explainer atoms into formatted text using templated approaches (Unified Spec v1.1)
 */

import { ExplainerAtoms, AstroSummary } from './contracts';
import { MappingTable } from './contracts';
import { shouldContrast } from './overlay-delta';
import * as fs from 'fs';
import * as path from 'path';

export class TextRealizer {
  private mappingTable: MappingTable;
  private seed: string = "";

  constructor(mappingTablePath?: string) {
    const chosenPath = mappingTablePath || this.resolveMappingTablePath();
    this.mappingTable = JSON.parse(fs.readFileSync(chosenPath, 'utf8'));
  }

  /** Load v2 by default, fallback to v1 if v2 missing. */
  private resolveMappingTablePath(): string {
    const v2Built = path.resolve(__dirname, 'mapping-tables-v2.json');
    const v2Source = path.resolve(__dirname, '../../../vnext/explainer/mapping-tables-v2.json');
    const v2 = fs.existsSync(v2Built) ? v2Built : (fs.existsSync(v2Source) ? v2Source : null);
    if (v2) return v2;
    const v1Built = path.resolve(__dirname, 'mapping-tables-v1.json');
    const v1Source = path.resolve(__dirname, '../../../vnext/explainer/mapping-tables-v1.json');
    return fs.existsSync(v1Built) ? v1Built : v1Source;
  }

  /** Banned filler phrases (replace or drop unless paired with concrete meaning) */
  private static readonly BANNED_FILLER = /cosmic forces|celestial dance|stellar (forces|weight)|planetary energies (flow|move)|cosmic (clarity|weight|motifs)/gi;

  /**
   * Generate complete text explainer from atoms (Section C).
   * When gate passes, also produces structured sections: signatures, significance, musicalParagraph, musicalBullets.
   */
  generateText(
    atoms: ExplainerAtoms,
    gateReport: any,
    seed: string
  ): {
    short: string;
    long: string;
    bullets: string[];
    template_id: string;
    signatures?: string;
    significance?: string;
    musicalParagraph?: string;
    musicalBullets?: string[];
  } {
    this.seed = seed;
    const gatePassed = gateReport.calibrated?.overall || false;
    const templateId = gatePassed ? this.generateTemplateId() : "v1.fail.00";
    const variedAtoms = this.applySynonymVariations(atoms);

    const short = this.generateShort(variedAtoms, gatePassed, gateReport);
    const long = this.generateLong(variedAtoms, gatePassed, gateReport);
    const bullets = this.generateBullets(variedAtoms, gatePassed, gateReport);

    if (!gatePassed) {
      return { short, long, bullets, template_id: templateId };
    }

    let signatures = this.generateSignatures(variedAtoms);
    let significance = this.generateSignificance(variedAtoms);
    const musical = this.generateMusicalSection(variedAtoms, gateReport);
    let musicalParagraph = musical.paragraph;
    let musicalBullets = musical.bullets;

    const deduped = this.dedupeAndClean(signatures, significance, musicalParagraph, musicalBullets);
    signatures = deduped.signatures;
    significance = deduped.significance;
    musicalParagraph = deduped.musicalParagraph;
    musicalBullets = deduped.musicalBullets;

    return {
      short: signatures,
      long: significance + (musicalParagraph ? "\n\n" + musicalParagraph : ""),
      bullets: musicalBullets,
      template_id: templateId,
      signatures,
      significance,
      musicalParagraph,
      musicalBullets
    };
  }

  /** Astrological Signatures: 2–4 sentences. Tone once (max 3 adjectives), then movement and arc; no repetition. */
  private generateSignatures(atoms: ExplainerAtoms): string {
    const toneLine = atoms.psych_tone ?? atoms.astro_color;
    const capped = this.capToneAdjectives(toneLine, 3);
    const sentences: string[] = [capped];
    sentences.push(atoms.movement.endsWith('.') ? atoms.movement : atoms.movement + '.');
    sentences.push(atoms.arc_desc.endsWith('.') ? atoms.arc_desc : atoms.arc_desc + '.');
    let out = sentences.slice(0, 4).join(' ');
    return this.stripBannedFiller(out);
  }

  /** Personal Significance: 1–2 paragraphs, temperament/motivation/relating, one "because" link. */
  private generateSignificance(atoms: ExplainerAtoms): string {
    const rhythm = atoms.rhythm_feel.replace(/\.+$/, '').toLowerCase();
    const density = atoms.density_desc.replace(/\.+$/, '').toLowerCase();
    const motif = atoms.motif_desc.replace(/\.+$/, '').toLowerCase();
    const p1 = `The chart points to a particular style of attention and pacing: ${rhythm}, with ${density}.`;
    const p2 = `Because the elemental and planetary mix shapes how we hold tension and repetition, this shows up as ${motif}.`;
    const disclaimer = 'This is a personality-style reading mapped into musical decisions, not a prediction.';
    let out = p1 + ' ' + p2 + '\n\n' + disclaimer;
    return this.stripBannedFiller(out);
  }

  /** Musical Identity and Flow: 1 paragraph + 3–6 unique listening-anchor bullets (no "•"). */
  private generateMusicalSection(atoms: ExplainerAtoms, gateReport: any): { paragraph: string; bullets: string[] } {
    const tempoFragment = this.generateTempoFragment();
    const sentences: string[] = [];
    if (atoms.music_facts_line) sentences.push(atoms.music_facts_line);
    sentences.push(`${atoms.rhythm_feel} ${tempoFragment}`);
    if (atoms.motion_profile_line) sentences.push(atoms.motion_profile_line);
    if (atoms.phase_story_lines?.length === 3) {
      sentences.push(atoms.phase_story_lines.join(' '));
    }
    const paragraph = this.stripBannedFiller(sentences.join('. ').replace(/\s*\.\s*\./g, '.'));

    const bulletCandidates = [
      atoms.movement,
      atoms.arc_desc,
      atoms.rhythm_feel,
      atoms.density_desc,
      atoms.motif_desc
    ].filter(Boolean);
    if (atoms.motion_profile_line) bulletCandidates.push(atoms.motion_profile_line);
    if (atoms.music_facts_line) bulletCandidates.push(atoms.music_facts_line);
    const bullets: string[] = [];
    const seen = new Set<string>();
    for (const b of bulletCandidates) {
      const clean = (b.replace(/^\s*[•·]\s*/, '').trim() || b).replace(/\.+$/, '');
      const key = clean.toLowerCase().slice(0, 40);
      if (clean && !seen.has(key) && bullets.length < 6) {
        seen.add(key);
        bullets.push(clean.endsWith('.') ? clean : clean + '.');
      }
    }
    return { paragraph, bullets: bullets.slice(0, 6) };
  }

  private capToneAdjectives(toneLine: string, max: number): string {
    const match = toneLine.match(/^Tone:\s*(.+)$/i);
    if (!match) return toneLine;
    const rest = match[1].trim();
    const words = rest.split(/\s*,\s*|\s+and\s+|\s+/);
    const adjectives: string[] = [];
    for (const w of words) {
      if (/\b(energetic|curious|grounded|structured|expressive|sensitive|balanced|driven|relating|adaptive|steady)\b/i.test(w)) {
        adjectives.push(w);
        if (adjectives.length >= max) break;
      }
    }
    const adjStr = adjectives.length ? adjectives.join(', ') : rest.split(',')[0] || rest;
    return `Tone: ${adjStr}.`;
  }

  private stripBannedFiller(text: string): string {
    return text.replace(TextRealizer.BANNED_FILLER, (m) => {
      const lower = m.toLowerCase();
      if (lower.includes('cosmic')) return 'the chart';
      if (lower.includes('celestial') || lower.includes('stellar')) return 'planetary';
      if (lower.includes('planetary energies')) return 'the blend';
      return 'it';
    }).replace(/\s*[—–]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
  }

  /** Remove duplicate sentences across sections; keep Tone only in signatures. */
  private dedupeAndClean(
    signatures: string,
    significance: string,
    musicalParagraph: string,
    musicalBullets: string[]
  ): { signatures: string; significance: string; musicalParagraph: string; musicalBullets: string[] } {
    const toSentences = (t: string) => t.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    const sigS = toSentences(signatures);
    const sigSet = new Set(sigS.map(s => s.toLowerCase().slice(0, 60)));
    let signText = significance;
    for (const s of toSentences(significance)) {
      const key = s.toLowerCase().slice(0, 60);
      if (sigSet.has(key) || (s.startsWith('Tone:') && sigS.some(x => x.startsWith('Tone:')))) {
        signText = signText.replace(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '').replace(/\s{2,}/g, ' ').trim();
      }
    }
    let musText = musicalParagraph;
    for (const s of toSentences(musicalParagraph)) {
      const key = s.toLowerCase().slice(0, 60);
      if (sigSet.has(key)) musText = musText.replace(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '').replace(/\s{2,}/g, ' ').trim();
    }
    const bulletSet = new Set(toSentences(musText).map(s => s.toLowerCase().slice(0, 50)));
    const musicalBulletsDeduped = musicalBullets.filter(b => {
      const key = b.toLowerCase().slice(0, 50);
      return !bulletSet.has(key) && !sigSet.has(key);
    });
    return {
      signatures,
      significance: signText.replace(/^\.\s*/, ''),
      musicalParagraph: musText.replace(/^\.\s*/, ''),
      musicalBullets: musicalBulletsDeduped.length >= 3 ? musicalBulletsDeduped : musicalBullets
    };
  }

  /**
   * Generate short form text (Section C). When psych_tone present, use as psychology-tone lead.
   */
  private generateShort(atoms: ExplainerAtoms, gatePassed: boolean, gateReport: any): string {
    if (!gatePassed) {
      return "";
    }

    const toneLine = atoms.psych_tone ?? atoms.astro_color;
    let short = `${toneLine} ${atoms.movement} ${atoms.arc_desc}`;
    if (short.length < 80) {
      short += ` ${atoms.rhythm_feel}`;
    }
    const maxLength = this.mappingTable.template_structures?.short?.max_length ?? 120;
    if (short.length > maxLength) {
      short = this.truncateText(short, maxLength);
    }
    return short;
  }

  /**
   * Generate long form text (Section C). Adds phase_story + music_facts when present; disclaimer once.
   */
  private generateLong(atoms: ExplainerAtoms, gatePassed: boolean, gateReport: any): string {
    if (!gatePassed) {
      return this.generateFailHint(gateReport);
    }

    const sentences: string[] = [];
    const toneLine = atoms.psych_tone ?? atoms.astro_color;
    sentences.push(toneLine);
    sentences.push(atoms.movement);
    const tempoFragment = this.generateTempoFragment();
    sentences.push(`${atoms.rhythm_feel} ${tempoFragment}`);
    sentences.push(atoms.density_desc);
    sentences.push(atoms.motif_desc);

    if (atoms.phase_story_lines?.length === 3) {
      sentences.push(atoms.phase_story_lines.join(' '));
    }
    if (atoms.music_facts_line) {
      sentences.push(atoms.music_facts_line);
    }
    const main = sentences.slice(0, -1).join('. ').replace(/\s*\.\s*\./g, '.');
    const disclaimer = 'This is a personality-style reading mapped into musical decisions, not a prediction.';
    let long = main ? `${main}.\n\n${disclaimer}` : disclaimer;
    const maxLength = this.mappingTable.template_structures?.long?.max_length ?? 300;
    if (long.length > maxLength) {
      long = this.truncateText(long, maxLength);
    }
    return long;
  }

  /**
   * Generate bullet points (Section C). Adds motion_profile + music_facts when present; gate_line when fail.
   */
  private generateBullets(atoms: ExplainerAtoms, gatePassed: boolean, gateReport?: any): string[] {
    if (!gatePassed) {
      const failBullet = atoms.gate_line
        ? `• ${atoms.gate_line} ${this.generateFailHint(gateReport)}`
        : `• ${this.generateFailHint(gateReport)}`;
      return [failBullet];
    }

    const bullets: string[] = [];
    bullets.push(`• ${atoms.movement}`);
    bullets.push(`• ${atoms.arc_desc}`);
    bullets.push(`• ${atoms.rhythm_feel}`);
    bullets.push(`• ${atoms.density_desc}`);
    bullets.push(`• ${atoms.motif_desc}`);
    if (atoms.motion_profile_line) {
      bullets.push(`• ${atoms.motion_profile_line}`);
    }
    if (atoms.music_facts_line) {
      bullets.push(`• ${atoms.music_facts_line}`);
    }
    return bullets.slice(0, 8);
  }

  /**
   * Generate overlay text with delta descriptions (Section D)
   */
  generateOverlayText(
    atoms: ExplainerAtoms,
    deltaControls: any,
    seed: string,
    gatePassed: boolean = true
  ): {
    short: string;
    long: string;
    bullets: string[];
    template_id: string;
  } {
    const baseText = this.generateText(atoms, {} as any, seed);
    
    if (!gatePassed) {
      return baseText;
    }
    
    // Build delta descriptions
    const deltaDescriptions = this.buildDeltaDescriptions(deltaControls);
    
    if (deltaDescriptions.length === 0) {
      return baseText;
    }
    
    const deltaText = deltaDescriptions.join(', ');
    const overlayPrefix = `Compared to your natal chart, today's transits add ${deltaText}.`;
    
    return {
      short: `${overlayPrefix} ${baseText.short}`,
      long: `${overlayPrefix} ${baseText.long}`,
      bullets: [
        `• ${deltaText} compared to natal`,
        ...baseText.bullets
      ],
      template_id: baseText.template_id
    };
  }

  /**
   * Generate sandbox text with actionable hints (Section D)
   */
  generateSandboxText(
    atoms: ExplainerAtoms,
    failedGates: string[],
    seed: string,
    gatePassed: boolean = true
  ): {
    short: string;
    long: string;
    bullets: string[];
    template_id: string;
  } {
    const baseText = this.generateText(atoms, {} as any, seed);
    
    if (gatePassed) {
      return baseText;
    }
    
    // Add sandbox-specific suggestions
    const suggestions = this.generateSandboxSuggestions(failedGates);
    
    return {
      short: baseText.short,
      long: baseText.long,
      bullets: [
        ...baseText.bullets,
        "• Sandbox suggestions:",
        ...suggestions.map(s => `  - ${s}`)
      ],
      template_id: baseText.template_id
    };
  }

  /**
   * Generate tempo fragment for long text
   */
  private generateTempoFragment(): string {
    // This would be determined from controls.tempo_norm
    // For now, return a generic tempo description
    const tempoDescriptions = this.mappingTable.tempo_descriptions || { brisk: { description: 'at a brisk pace.' }, measured: { description: 'at a measured pace.' }, slow: { description: 'at a slow pace.' } };
    
    // Mock tempo value - would come from actual controls
    const tempoNorm = 0.6; // Example value
    
    if (tempoNorm > 0.7) {
      return tempoDescriptions.brisk.description;
    } else if (tempoNorm >= 0.4 && tempoNorm <= 0.7) {
      return tempoDescriptions.measured.description;
    } else {
      return tempoDescriptions.slow.description;
    }
  }

  /**
   * Build delta descriptions for overlay mode (Unified Spec v1.1)
   */
  private buildDeltaDescriptions(deltaControls: any): string[] {
    const descriptions: string[] = [];
    
    // Only add descriptions when Δ exceeds spec thresholds using centralized guard
    if (deltaControls.step_bias && this.shouldContrast('step_bias', Math.abs(deltaControls.step_bias))) {
      if (deltaControls.step_bias > 0) {
        descriptions.push('more stepwise than natal');
      } else {
        descriptions.push('more leaping than natal');
      }
    }
    
    if (deltaControls.leap_cap && Math.abs(deltaControls.leap_cap) >= 1) {
      if (deltaControls.leap_cap > 0) {
        descriptions.push('wider leaps than natal');
      } else {
        descriptions.push('narrower leaps than natal');
      }
    }
    
    if (deltaControls.syncopation_bias && this.shouldContrast('syncopation_bias', Math.abs(deltaControls.syncopation_bias))) {
      if (deltaControls.syncopation_bias > 0) {
        descriptions.push('more syncopated feel than natal');
      } else {
        descriptions.push('less syncopated feel than natal');
      }
    }
    
    if (deltaControls.density_level && this.shouldContrast('density_level', Math.abs(deltaControls.density_level))) {
      if (deltaControls.density_level > 0) {
        descriptions.push('richer texture than natal');
      } else {
        descriptions.push('sparser texture than natal');
      }
    }
    
    return descriptions;
  }

  /**
   * Centralized threshold check for overlay contrast (Unified Spec v1.1)
   */
  private shouldContrast(kind: 'step_bias' | 'syncopation_bias' | 'density_level', deltaAbs: number): boolean {
    return shouldContrast(kind, deltaAbs);
  }

  /**
   * Generate sandbox suggestions for failed gates
   */
  private generateSandboxSuggestions(failedGates: string[]): string[] {
    const suggestions: string[] = [];
    
    for (const gate of failedGates) {
      const hint = this.mappingTable.sandbox_hints?.[gate];
      if (hint) {
        suggestions.push(hint.hint);
      }
    }
    
    return suggestions;
  }

  /**
   * Generate fail hint when gates don't pass (Unified Spec v1.1)
   */
  private generateFailHint(gateReport: any): string {
    const failedGates = [];
    
    if (gateReport.strict && !gateReport.strict.melody_arc) {
      failedGates.push("arc");
    }
    if (gateReport.strict && !gateReport.strict.melody_step_leap) {
      failedGates.push("step_bias +0.1 or leap_cap → 3");
    }
    if (gateReport.strict && !gateReport.strict.melody_narrative) {
      failedGates.push("narrative");
    }
    if (gateReport.strict && !gateReport.strict.rhythm_diversity) {
      failedGates.push("rhythm_template_id or syncopation");
    }
    
    if (failedGates.length === 0) {
      return "Adjust control parameters to meet calibrated gate thresholds.";
    }
    // Only actionable knob hints, no adjectives
    return `Adjust: ${failedGates.join(', ')}.`;
  }

  /**
   * Generate template ID for variation
   */
  private generateTemplateId(): string {
    const templateCount = 4;
    const templateIndex = this.hashString(this.seed + 'template') % templateCount;
    return `v1.short.${templateIndex.toString().padStart(2, '0')}`;
  }

  /**
   * Apply synonym variations based on seed
   */
  private applySynonymVariations(atoms: ExplainerAtoms): ExplainerAtoms {
    const synonymSets = this.mappingTable.synonym_variations.seed_based.sets;
    const setIndex = this.hashString(this.seed) % synonymSets.length;
    const synonymSet = synonymSets[setIndex];
    
    const applyVariations = (text: string): string => {
      let variedText = text;
      Object.entries(synonymSet).forEach(([original, synonym]) => {
        const regex = new RegExp(original, 'gi');
        variedText = variedText.replace(regex, synonym as string);
      });
      return variedText;
    };
    
    return {
      ...atoms,
      arc_desc: applyVariations(atoms.arc_desc),
      movement: applyVariations(atoms.movement),
      rhythm_feel: applyVariations(atoms.rhythm_feel),
      density_desc: applyVariations(atoms.density_desc),
      motif_desc: applyVariations(atoms.motif_desc),
      astro_color: applyVariations(atoms.astro_color)
    } as ExplainerAtoms;
  }

  /**
   * Truncate text to fit length constraint
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Find last complete sentence before maxLength
    const truncated = text.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    // Fallback: truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
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