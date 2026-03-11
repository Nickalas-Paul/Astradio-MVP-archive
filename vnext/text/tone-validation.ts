import type { ToneSpec } from './contracts';

export type ToneViolationKind =
  | 'forbidden_phrase'
  | 'fatalistic'
  | 'length'
  | 'therapy_language'
  | 'fluff';

export interface ToneViolation {
  kind: ToneViolationKind;
  message: string;
  sentence: string;
  phrase?: string;
}

export function validateTone(text: string, tone: ToneSpec): ToneViolation[] {
  const violations: ToneViolation[] = [];
  const sentences = splitSentences(text);

  for (const sentence of sentences) {
    const sLower = sentence.toLowerCase();

    // Forbidden phrases from tone spec
    for (const raw of tone.forbidden_phrases || []) {
      const needle = raw.toLowerCase();
      if (needle && sLower.includes(needle)) {
        violations.push({
          kind: 'forbidden_phrase',
          message: `Forbidden phrase "${raw}" found`,
          sentence,
          phrase: raw
        });
      }
    }

    // Fatalistic patterns
    if (/\byou\s+(are|always|will)\b/i.test(sentence) || /\bthis means you will\b/i.test(sentence)) {
      violations.push({
        kind: 'fatalistic',
        message: 'Detected fatalistic phrasing',
        sentence
      });
    }

    // Length violations
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    if (wordCount > 0 && (wordCount < tone.sentence_length_range.min || wordCount > tone.sentence_length_range.max)) {
      violations.push({
        kind: 'length',
        message: `Sentence length ${wordCount} outside allowed range`,
        sentence
      });
    }

    // Therapy / diagnosis language
    if (/\b(trauma|diagnos(?:is|ed)|disorder|patholog(?:y|ical)|clinical|treatment plan|coping mechanism|attachment style)\b/i.test(sentence)) {
      violations.push({
        kind: 'therapy_language',
        message: 'Detected therapy/diagnosis-style language',
        sentence
      });
    }

    // Horoscope fluff
    if (/\b(cosmic vibes?|the universe wants|energies are aligning|mystical download|magic of the universe)\b/i.test(sentence)) {
      violations.push({
        kind: 'fluff',
        message: 'Detected horoscope-style fluff language',
        sentence
      });
    }
  }

  return violations;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

