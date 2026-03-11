import type { TextAnalysisIntermediate } from '../contracts';

export type RendererStatus = 'ok' | 'unimplemented' | 'insufficient_data';

export interface StructuredSection {
  id: string;
  title: string;
  text?: string;
}

export interface StructuredRenderResult {
  surface: string;
  status: RendererStatus;
  reason?: string;
  sections: StructuredSection[];
}

export function renderCompat(_analysis: TextAnalysisIntermediate): StructuredRenderResult {
  return {
    surface: 'compat',
    status: 'unimplemented',
    reason: 'vnext text compat renderer not implemented in this phase',
    sections: []
  };
}

export function renderGroup(_analysis: TextAnalysisIntermediate): StructuredRenderResult {
  return {
    surface: 'group',
    status: 'unimplemented',
    reason: 'vnext text group renderer not implemented in this phase',
    sections: []
  };
}

export function renderSandboxDiff(_analysis: TextAnalysisIntermediate): StructuredRenderResult {
  return {
    surface: 'sandboxDiff',
    status: 'unimplemented',
    reason: 'vnext text sandboxDiff renderer not implemented in this phase',
    sections: []
  };
}

export function renderCampaignTurn(_analysis: TextAnalysisIntermediate): StructuredRenderResult {
  return {
    surface: 'campaignTurn',
    status: 'unimplemented',
    reason: 'vnext text campaignTurn renderer not implemented in this phase',
    sections: []
  };
}

export function renderCharacterSheet(_analysis: TextAnalysisIntermediate): StructuredRenderResult {
  return {
    surface: 'characterSheet',
    status: 'unimplemented',
    reason: 'vnext text characterSheet renderer not implemented in this phase',
    sections: []
  };
}

