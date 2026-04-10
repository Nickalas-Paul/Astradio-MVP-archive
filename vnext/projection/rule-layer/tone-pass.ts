/**
 * Step 9 — centralized tone pass (language-lint + forbidden_tone_flags + cross-section discipline).
 * Only invoked from apply-unified-projection after section assembly.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { ProjectedExplanationSection } from '../projection-types';
import { lintSectionBody } from '../language-lint';

/** Lower wins duplicate sentences (section collapse). */
const SECTION_RANK: Record<string, number> = {
  connection_structure: 5,
  ensemble_framing: 5,
  signatures: 10,
  sky_summary: 12,
  significance: 14,
  relational_field: 15,
  feed_signal: 18,
  feed_context: 19,
  audio_staging: 20,
  musical: 24,
  audio_thread: 25,
  personal_emphasis: 30,
  likely_expressions: 32,
  watch_fors: 34,
  integration_prompt: 36,
  music_translation: 38,
  synthesis_a: 40,
  synthesis_b: 41,
  temporal_integration: 42,
  trait_bridge: 43,
  interaction_map: 44,
  field_distribution: 45,
  pressure_response: 46,
  layering: 47,
  delta_emphasis: 48,
  contradiction_map: 49,
  subcluster: 50,
  depth_panel_1: 55,
  depth_panel_2: 56,
  depth_panel_3: 57,
  relational_weather_v1: 16,
};

function sectionRank(id: string): number {
  if (SECTION_RANK[id] !== undefined) return SECTION_RANK[id];
  if (id.startsWith('depth_panel_')) return 55;
  return 200;
}

function normalizeSentence(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[""''`]/g, '');
}

function splitSentences(text: string): string[] {
  const t = text.trim();
   if (!t) return [];
  return t.split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type Winner = { sectionId: string; rank: number; sectionIndex: number };

function computeSentenceWinners(sections: ProjectedExplanationSection[]): Map<string, Winner> {
  const winners = new Map<string, Winner>();
  sections.forEach((sec, sectionIndex) => {
    const rank = sectionRank(sec.id);
    for (const para of sec.text.split(/\n\n+/)) {
      for (const sent of splitSentences(para)) {
        const norm = normalizeSentence(sent);
        if (norm.length < 12) continue;
        const cur = winners.get(norm);
        if (!cur || rank < cur.rank || (rank === cur.rank && sectionIndex < cur.sectionIndex)) {
          winners.set(norm, { sectionId: sec.id, rank, sectionIndex });
        }
      }
    }
  });
  return winners;
}

function filterParagraphsByWinners(text: string, sectionId: string, winners: Map<string, Winner>): string {
  const paras = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const para of paras) {
    const sents = splitSentences(para);
    const keptSents = sents.filter((sent) => {
      const norm = normalizeSentence(sent);
      if (norm.length < 12) return true;
      const w = winners.get(norm);
      return !w || w.sectionId === sectionId;
    });
    // Keep the whole paragraph if any sentence would be removed — partial removal breaks density validation.
    if (keptSents.length !== sents.length && sents.length > 0) {
      kept.push(sents.join(' '));
    } else if (keptSents.length > 0) {
      kept.push(keptSents.join(' '));
    }
  }
  return kept.join('\n\n');
}

function applyCrossSectionDiscipline(sections: ProjectedExplanationSection[]): ProjectedExplanationSection[] {
  if (sections.length === 0) return sections;
  const winners = computeSentenceWinners(sections);
  return sections.map((sec) => {
    const text = filterParagraphsByWinners(sec.text, sec.id, winners);
    const bullets = sec.bullets?.map((b) => filterParagraphsByWinners(b, sec.id, winners)).filter((b) => b.trim().length > 0);
    return {
      ...sec,
      text,
      bullets: bullets?.length ? bullets : undefined,
    };
  });
}

function applyForbiddenToneFlags(text: string, core: SemanticCore): string {
  let t = text;
  const flags = core.text.forbidden_tone_flags;
  if (flags.includes('TONE_AVOID_SHADOW')) {
    t = t.replace(/\bshadow\b/gi, 'quieter register');
  }
  return t;
}

export function runTonePassOnSections(sections: ProjectedExplanationSection[], core: SemanticCore): ProjectedExplanationSection[] {
  const linted = sections.map((sec) => {
    const afterFlag = applyForbiddenToneFlags(sec.text, core);
    const body = lintSectionBody(afterFlag);
    const bullets = sec.bullets?.map((b) => lintSectionBody(applyForbiddenToneFlags(b, core)).text);
    return {
      ...sec,
      text: body.text,
      bullets,
    };
  });
  return applyCrossSectionDiscipline(linted);
}
