import type { TextAnalysisIntermediate, ToneSpec, AnalysisTension, AnalysisTheme, AnalysisOpportunity } from '../contracts';
import * as fs from 'fs';
import * as path from 'path';

export interface DailySection {
  id:
    | 'sky_summary'
    | 'personal_emphasis'
    | 'likely_expressions'
    | 'watch_fors'
    | 'integration_prompt'
    | 'music_translation';
  title: string;
  text: string;
}

export interface DailyRenderResult {
  surface: 'daily';
  hasNatalContext: boolean;
  sections: DailySection[];
  confidence: number;
}

export function renderDaily(
  analysis: TextAnalysisIntermediate,
  toneSpec?: ToneSpec
): DailyRenderResult {
  if (analysis.surface !== 'daily') {
    throw new Error(`renderDaily called with surface=${analysis.surface}`);
  }

  const spec = toneSpec ?? loadDailyToneSpec();
  const hasNatal = analysis.hasNatalContext === true;

  const themes = stableSortByWeight(analysis.themes);
  const tensions = stableSortByWeight(analysis.tensions);
  const opportunities = stableSortByWeight(analysis.opportunities);

  const sections: DailySection[] = [];

  sections.push({
    id: 'sky_summary',
    title: 'Sky Summary',
    text: buildSkySummary(analysis, themes, tensions, hasNatal, spec)
  });

  sections.push({
    id: 'personal_emphasis',
    title: 'Personal Emphasis',
    text: buildPersonalEmphasis(analysis, themes, hasNatal, spec)
  });

  sections.push({
    id: 'likely_expressions',
    title: 'Likely Expressions',
    text: buildLikelyExpressions(analysis, themes, opportunities, hasNatal, spec)
  });

  sections.push({
    id: 'watch_fors',
    title: 'Watch-Fors',
    text: buildWatchFors(analysis, tensions, hasNatal, spec)
  });

  sections.push({
    id: 'integration_prompt',
    title: 'Integration Prompt',
    text: buildIntegrationPrompt(analysis, themes, tensions, hasNatal, spec)
  });

  sections.push({
    id: 'music_translation',
    title: 'Music Translation',
    text: buildMusicTranslation(analysis, spec)
  });

  return {
    surface: 'daily',
    hasNatalContext: hasNatal,
    sections,
    confidence: analysis.confidence.score
  };
}

function loadDailyToneSpec(): ToneSpec {
  const here = __dirname;
  const file = path.resolve(here, '../tones/daily.personality.v1.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as ToneSpec;
}

function stableSortByWeight<T extends { weight: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => b.weight - a.weight);
}

function buildSkySummary(
  analysis: TextAnalysisIntermediate,
  themes: AnalysisTheme[],
  tensions: AnalysisTension[],
  hasNatal: boolean,
  spec: ToneSpec
): string {
  const parts: string[] = [];

  const majorAspects = analysis.astro_facts.aspects.slice(0, 2);
  if (majorAspects.length > 0) {
    const labels = majorAspects.map((a) => {
      const asp = a.aspect;
      return `${asp.bodyA} ${asp.type} ${asp.bodyB}`;
    });
    const lead = hasNatal
      ? `For this chart, today’s sky is organized around connections such as ${labels.join(' and ')}.`
      : `Today’s sky is organized around connections such as ${labels.join(' and ')}.`;
    parts.push(lead);
  } else {
    const base = hasNatal
      ? 'For this chart, today’s sky presents a balanced pattern without a single dominating link.'
      : 'Today’s sky presents a balanced pattern without a single dominating link.';
    parts.push(base);
  }

  if (themes.length > 0) {
    const top = themes[0];
    parts.push(`At a high level, this pattern can show up as ${top.label}.`);
  }

  if (tensions.length > 0) {
    const hard = tensions.find((t) => t.polarity === 'tension') ?? tensions[0];
    parts.push(`There is also a dynamic that often describes how pressure concentrates: ${hard.label}.`);
  }

  return parts.join(' ');
}

function buildPersonalEmphasis(
  analysis: TextAnalysisIntermediate,
  themes: AnalysisTheme[],
  hasNatal: boolean,
  spec: ToneSpec
): string {
  if (!hasNatal) {
    const generic = 'Without natal context, this section stays general: the sky pattern is available to everyone rather than describing one specific biography.';
    return generic;
  }

  const parts: string[] = [];
  if (themes.length > 0) {
    const top = themes[0];
    parts.push(
      `In a personal reading of this chart, this dynamic often describes where attention and effort cluster: ${top.label}.`
    );
  } else {
    parts.push(
      'In a personal reading of this chart, emphasis can show up most strongly where several key planets share a house or angle.'
    );
  }

  return parts.join(' ');
}

function buildLikelyExpressions(
  analysis: TextAnalysisIntermediate,
  themes: AnalysisTheme[],
  opportunities: AnalysisOpportunity[],
  hasNatal: boolean,
  spec: ToneSpec
): string {
  const parts: string[] = [];

  const source = themes.length ? themes[0] : opportunities[0];
  if (source) {
    const lead = hasNatal
      ? `In practice, this may feel like a recurring pattern in day-to-day choices: ${source.label}.`
      : `In practice, many people experience a pattern like this in day-to-day choices: ${source.label}.`;
    parts.push(lead);
  } else {
    parts.push(
      'In practice, this may feel like certain topics keep returning to the foreground for a short stretch, then receding as the sky shifts.'
    );
  }

  return parts.join(' ');
}

function buildWatchFors(
  analysis: TextAnalysisIntermediate,
  tensions: AnalysisTension[],
  hasNatal: boolean,
  spec: ToneSpec
): string {
  const parts: string[] = [];
  const source = tensions.find((t) => t.polarity === 'tension') ?? tensions[0];

  if (source) {
    const lead = hasNatal
      ? `This pattern can show up as a place where reactions run hotter or feel more compressed: ${source.label}.`
      : `For many people, this pattern can show up as a place where reactions run hotter or feel more compressed: ${source.label}.`;
    parts.push(lead);
    parts.push('It is something to notice and work with rather than something that decides outcomes on its own.');
  } else {
    parts.push(
      'If anything feels unusually sharp or crowded today, it is worth noticing how long it lasts and where it concentrates, rather than assuming it will define the whole story.'
    );
  }

  return parts.join(' ');
}

function buildIntegrationPrompt(
  analysis: TextAnalysisIntermediate,
  themes: AnalysisTheme[],
  tensions: AnalysisTension[],
  hasNatal: boolean,
  spec: ToneSpec
): string {
  const focus = themes[0] ?? tensions[0];
  if (focus) {
    const lead = hasNatal
      ? `A useful reflection is to notice one concrete situation today where this pattern shows up and how you respond to it: ${focus.label}.`
      : `A useful reflection is to notice one concrete situation today where this pattern shows up around you and how you respond to it: ${focus.label}.`;
    return lead;
  }

  const generic =
    'A useful reflection is to track one moment today where the sky pattern feels loudest, and to note what choices are actually available in that moment.';
  return generic;
}

function buildMusicTranslation(
  analysis: TextAnalysisIntermediate,
  spec: ToneSpec
): string {
  const traits = analysis.music_mapping?.traits;
  if (!traits) {
    const generic =
      'In the score, the pattern is translated into tempo, density, register, and harmonic posture so that the music carries the same structure the chart describes.';
    return generic;
  }

  const parts: string[] = [];
  if (traits.tempo) {
    parts.push(`Tempo is chosen so that it often describes ${traits.tempo}.`);
  }
  if (traits.density) {
    parts.push(`Density can show up as ${traits.density}.`);
  }
  if (traits.register) {
    parts.push(`Register placement often describes ${traits.register}.`);
  }
  if (traits.harmonicPosture) {
    parts.push(`Harmonic posture is set so that many people experience it as ${traits.harmonicPosture}.`);
  }

  return parts.join(' ');
}

