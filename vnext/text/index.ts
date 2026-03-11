import * as fs from 'fs';
import * as path from 'path';
import type { TextAnalysisIntermediate, ToneSpec } from './contracts';
import { renderDaily, type DailyRenderResult } from './renderers/daily';
import { renderCharacterSheet, type StructuredRenderResult } from './renderers/structural';

export type PublicTextSurface = 'daily' | 'character';

export type GenerateTextSurfaceInput = {
  surface: PublicTextSurface;
  analysis: TextAnalysisIntermediate;
};

export type GenerateTextSurfaceResult = DailyRenderResult | StructuredRenderResult;

type RendererFn = (analysis: TextAnalysisIntermediate) => GenerateTextSurfaceResult;

const RENDERERS: Record<PublicTextSurface, RendererFn> = {
  daily: (analysis) => {
    if (analysis.surface !== 'daily') {
      throw new Error(`generateTextSurface(daily) expected analysis.surface=daily, got ${analysis.surface}`);
    }
    const tone = loadDailyToneSpec();
    return renderDaily(analysis, tone);
  },
  character: (analysis) => {
    if (analysis.surface !== 'characterSheet') {
      throw new Error(
        `generateTextSurface(character) expected analysis.surface=characterSheet, got ${analysis.surface}`
      );
    }
    return renderCharacterSheet(analysis);
  }
};

function loadDailyToneSpec(): ToneSpec {
  const file = path.resolve(process.cwd(), 'vnext/text/tones/daily.personality.v1.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as ToneSpec;
}

export function generateTextSurface(input: GenerateTextSurfaceInput): GenerateTextSurfaceResult {
  const renderer = RENDERERS[input.surface];
  if (!renderer) {
    throw new Error(`No renderer registered for surface=${input.surface}`);
  }
  return renderer(input.analysis);
}

