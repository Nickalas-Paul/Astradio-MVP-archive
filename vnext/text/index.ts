import * as fs from 'fs';
import * as path from 'path';
import type { EphemerisSnapshot } from '../contracts';
import type {
  ChartTextInput,
  TextAnalysisIntermediate,
  ToneId,
  ToneSpec,
  TextSurface
} from './contracts';
import type { RelationalChartContext } from '../report-context';
import { buildTextAnalysis } from './analysis/buildTextAnalysis';
import { renderDaily, type DailyRenderResult } from './renderers/daily';
import { renderCharacterSheet, type StructuredRenderResult } from './renderers/structural';

export type PublicTextSurface = 'daily' | 'structural';

export interface GenerateTextSurfaceInput {
  surface: PublicTextSurface;
  snapshot: EphemerisSnapshot;
  relationalContext?: RelationalChartContext;
  toneVersion?: ToneId;
}

export type GenerateTextSurfaceResult = DailyRenderResult | StructuredRenderResult;

type RendererFn = (analysis: TextAnalysisIntermediate, toneOverride?: ToneSpec) => GenerateTextSurfaceResult;

const RENDERERS: Record<PublicTextSurface, RendererFn> = {
  daily: (analysis, toneOverride) => {
    if (analysis.surface !== 'daily') {
      throw new Error(`generateTextSurface(daily) expected analysis.surface=daily, got ${analysis.surface}`);
    }
    const tone = toneOverride ?? loadDailyToneSpec();
    return renderDaily(analysis, tone);
  },
  structural: (analysis) => {
    if (analysis.surface !== 'characterSheet') {
      throw new Error(
        `generateTextSurface(structural) expected analysis.surface=characterSheet, got ${analysis.surface}`
      );
    }
    return renderCharacterSheet(analysis);
  }
};

export function generateTextSurface(input: GenerateTextSurfaceInput): GenerateTextSurfaceResult {
  const renderer = RENDERERS[input.surface];
  if (!renderer) {
    throw new Error(`No renderer registered for surface=${input.surface}`);
  }

  const analysisSurface: TextSurface =
    input.surface === 'daily' ? 'daily' : 'characterSheet';

  const toneVersion: ToneId =
    input.toneVersion ??
    (input.surface === 'daily' ? 'daily.personality.v1' : 'characterSheet.personality.v1');

  const chartInput: ChartTextInput = {
    snapshot: input.snapshot,
    relationalContext: input.relationalContext,
    surface: analysisSurface,
    algoVersion: 'vnext-text-1',
    toneVersion,
    hasHouses: true,
    hasAspects: true,
    hasNatalContext: true,
    missing: []
  };

  const analysis = buildTextAnalysis(analysisSurface, chartInput);
  return renderer(analysis);
}

export function loadDailyToneSpec(): ToneSpec {
  const file = path.resolve(process.cwd(), 'vnext/text/tones/daily.personality.v1.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as ToneSpec;
}

