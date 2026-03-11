import type { TextAnalysisIntermediate, AnalysisTheme, AnalysisTension, AnalysisOpportunity } from '../contracts';
import { stableSortByNodeWeight } from './shared';

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

export function renderCharacterSheet(analysis: TextAnalysisIntermediate): StructuredRenderResult {
  if (analysis.surface !== 'characterSheet') {
    return {
      surface: 'characterSheet',
      status: 'insufficient_data',
      reason: `renderCharacterSheet called with surface=${analysis.surface}`,
      sections: []
    };
  }

  const themes = stableSortByNodeWeight(analysis.themes);
  const tensions = stableSortByNodeWeight(analysis.tensions);
  const opportunities = stableSortByNodeWeight(analysis.opportunities);

  const coreIdentity = buildCoreIdentitySection(themes);
  const dynamicEdges = buildDynamicEdgesSection(tensions);
  const growthVectors = buildGrowthVectorsSection(opportunities);

  const sections = [coreIdentity, dynamicEdges, growthVectors].filter(
    (s): s is StructuredSection => Boolean(s)
  );

  if (sections.length === 0) {
    return {
      surface: 'characterSheet',
      status: 'insufficient_data',
      reason: 'characterSheet renderer had no themes, tensions, or opportunities to work with',
      sections: []
    };
  }

  return {
    surface: 'characterSheet',
    status: 'ok',
    sections
  };
}

function buildCoreIdentitySection(themes: AnalysisTheme[]): StructuredSection | undefined {
  if (themes.length === 0) return undefined;

  const top = themes.slice(0, 3);
  const labels = top.map((t) => t.label);

  return {
    id: 'core_identity',
    title: 'Core Identity Pattern',
    text: `This chart often centers its core storyline around patterns such as ${labels.join(
      ', '
    )}, which describe how identity tends to organize itself over time.`
  };
}

function buildDynamicEdgesSection(tensions: AnalysisTension[]): StructuredSection | undefined {
  if (tensions.length === 0) return undefined;

  const hard = tensions.filter((t) => t.polarity === 'tension');
  const mixed = tensions.filter((t) => t.polarity === 'mixed');
  const support = tensions.filter((t) => t.polarity === 'support');

  const ordered = [...hard, ...mixed, ...support];
  const top = ordered.slice(0, 3);
  if (top.length === 0) return undefined;

  const labels = top.map((t) => t.label);

  return {
    id: 'dynamic_edges',
    title: 'Dynamic Edges',
    text: `Inner dynamics and friction often cluster around patterns like ${labels.join(
      ', '
    )}, marking the edges where habit, desire, and circumstance meet.`
  };
}

function buildGrowthVectorsSection(
  opportunities: AnalysisOpportunity[]
): StructuredSection | undefined {
  if (opportunities.length === 0) return undefined;

  const top = opportunities.slice(0, 3);
  const labels = top.map((o) => o.label);

  return {
    id: 'growth_vectors',
    title: 'Growth Vectors',
    text: `Growth and experimentation can move through opportunities such as ${labels.join(
      ', '
    )}, offering concrete directions where effort and curiosity are especially well used.`
  };
}

