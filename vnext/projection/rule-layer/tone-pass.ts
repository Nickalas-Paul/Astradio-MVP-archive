/**
 * Step 9 — centralized tone pass (language-lint + forbidden_tone_flags).
 * Only invoked from apply-unified-projection after section assembly.
 */
import type { SemanticCore } from '../../semantic/semantic-core';
import type { ProjectedExplanationSection } from '../projection-types';
import { lintSectionBody } from '../language-lint';

function applyForbiddenToneFlags(text: string, core: SemanticCore): string {
  let t = text;
  const flags = core.text.forbidden_tone_flags;
  if (flags.includes('TONE_AVOID_SHADOW')) {
    t = t.replace(/\bshadow\b/gi, 'quieter register');
  }
  return t;
}

export function runTonePassOnSections(sections: ProjectedExplanationSection[], core: SemanticCore): ProjectedExplanationSection[] {
  return sections.map((sec) => {
    const afterFlag = applyForbiddenToneFlags(sec.text, core);
    const linted = lintSectionBody(afterFlag);
    return {
      ...sec,
      text: linted.text,
    };
  });
}
