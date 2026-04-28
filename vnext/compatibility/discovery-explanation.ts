import type {
  CanonicalRelationalFieldObject,
  CompatibilityClassification,
  DomainDistribution,
  PairwiseInteractionCell,
  RelationalFieldScoreContract,
  TraitInteractionEdge,
} from './contracts';
import type { RelationalIntent } from './relational-intent';
import { RELATIONAL_INTENTS } from './relational-intent';
import { bucketIntentFit, canonicalIntentRank, type IntentFitBucket } from './intent-rank';

type ContrastByIntent = Record<RelationalIntent, IntentFitBucket>;

export interface CompatibilityExplanationProfile {
  intent: RelationalIntent;
  intentFitSummary: string;
  primarySupports: string[];
  secondarySupports: string[];
  tensionsOrLimits: string[];
  contrastByIntent: ContrastByIntent;
  anchors: string[];
}

type SignalLine = {
  text: string;
  anchor: string;
  signalKey: string;
};

const INDEX_TEMPLATES = [
  'Index signal {label} at {value} sets {intent} coordination behavior.',
  'Index signal {label} at {value} guides {intent} interaction pacing.',
  'Index signal {label} at {value} structures {intent} relational rhythm.',
];

const INTERACTION_TEMPLATES = [
  'Interaction signal {category} at {value} shapes pair {pairKey} for {intent} coordination.',
  'Interaction signal {category} at {value} directs pair {pairKey} under {intent} behavior.',
  'Interaction signal {category} at {value} channels pair {pairKey} through {intent} exchange.',
];

const STRUCTURE_TRAIT_TEMPLATES = [
  'Structure signal trait edge {edgeKey} at {value} reinforces repeatable relational behavior.',
  'Structure signal trait edge {edgeKey} at {value} stabilizes recurring coordination structure.',
];

const STRUCTURE_DOMAIN_TEMPLATES = [
  'Structure signal domain {domainId} at {value} supports practical interaction structure.',
  'Structure signal domain {domainId} at {value} anchors sustained operational alignment.',
];

const INDEX_PRIORITY: Record<RelationalIntent, Array<keyof RelationalFieldScoreContract['derived_indices']>> = {
  friend: ['cohesion_index', 'stability_index', 'transformation_index', 'tension_index'],
  lover: ['cohesion_index', 'transformation_index', 'stability_index', 'tension_index'],
  rival: ['tension_index', 'transformation_index', 'cohesion_index', 'stability_index'],
  collaborator: ['stability_index', 'cohesion_index', 'transformation_index', 'tension_index'],
};

const INTERACTION_CATEGORY_PRIORITY: Record<RelationalIntent, string[]> = {
  friend: ['reinforcing', 'transforming', 'cross_pressuring', 'escalating', 'dissolving'],
  lover: ['transforming', 'reinforcing', 'cross_pressuring', 'escalating', 'dissolving'],
  rival: ['escalating', 'cross_pressuring', 'transforming', 'dissolving', 'reinforcing'],
  collaborator: ['reinforcing', 'cross_pressuring', 'transforming', 'escalating', 'dissolving'],
};

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickTemplate(seed: string, intent: RelationalIntent, section: string): string {
  const pool = section === 'index'
    ? INDEX_TEMPLATES
    : section === 'interaction'
      ? INTERACTION_TEMPLATES
      : section === 'trait'
        ? STRUCTURE_TRAIT_TEMPLATES
        : STRUCTURE_DOMAIN_TEMPLATES;
  const idx = stableHash(`${seed}:${intent}:${section}`) % pool.length;
  return pool[idx] ?? pool[0];
}

function titleIntent(intent: RelationalIntent): string {
  return intent.charAt(0).toUpperCase() + intent.slice(1);
}

function titleBucket(bucket: IntentFitBucket): string {
  return bucket.charAt(0).toUpperCase() + bucket.slice(1);
}

function fmtPercent(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function pushUniqueLine(
  lines: SignalLine[],
  anchors: Set<string>,
  used: Set<string>,
  line: SignalLine | null
): void {
  if (!line) return;
  if (used.has(line.signalKey)) return;
  used.add(line.signalKey);
  anchors.add(line.anchor);
  lines.push(line);
}

function buildIndexSignal(scoring: RelationalFieldScoreContract, intent: RelationalIntent): SignalLine {
  const idxName = INDEX_PRIORITY[intent][0];
  const value = scoring.derived_indices[idxName];
  const idxLabel = idxName.replace('_index', '').replace('_', ' ');
  const template = pickTemplate(scoring.compatibility_field_hash, intent, 'index');
  return {
    text: template
      .replace('{label}', idxLabel)
      .replace('{value}', fmtPercent(value))
      .replace('{intent}', intent),
    anchor: `index:${idxName}`,
    signalKey: `index:${idxName}`,
  };
}

function selectInteractionCell(field: CanonicalRelationalFieldObject, intent: RelationalIntent, used: Set<string>): PairwiseInteractionCell | null {
  const ordered = field.pairwise_matrix
    .slice()
    .sort((a, b) => {
      const pa = INTERACTION_CATEGORY_PRIORITY[intent].indexOf(a.dominant_category);
      const pb = INTERACTION_CATEGORY_PRIORITY[intent].indexOf(b.dominant_category);
      if (pa !== pb) return pa - pb;
      const wa = a.category_weights[a.dominant_category] ?? 0;
      const wb = b.category_weights[b.dominant_category] ?? 0;
      if (wb !== wa) return wb - wa;
      if (a.pair_key !== b.pair_key) return a.pair_key.localeCompare(b.pair_key);
      if (a.a_slot_index !== b.a_slot_index) return a.a_slot_index - b.a_slot_index;
      return a.b_slot_index - b.b_slot_index;
    });
  for (const cell of ordered) {
    const key = `pair:${cell.pair_key}:${cell.dominant_category}`;
    if (!used.has(key)) return cell;
  }
  return ordered[0] ?? null;
}

function buildInteractionSignal(field: CanonicalRelationalFieldObject, intent: RelationalIntent, used: Set<string>): SignalLine | null {
  const cell = selectInteractionCell(field, intent, used);
  if (!cell) return null;
  const categoryWeight = cell.category_weights[cell.dominant_category] ?? 0;
  const template = pickTemplate(field.object_identity_hash, intent, 'interaction');
  return {
    text: template
      .replace('{category}', cell.dominant_category)
      .replace('{value}', fmtPercent(categoryWeight))
      .replace('{pairKey}', cell.pair_key)
      .replace('{intent}', intent),
    anchor: `pair:${cell.pair_key}:${cell.dominant_category}`,
    signalKey: `pair:${cell.pair_key}:${cell.dominant_category}`,
  };
}

function selectTrait(field: CanonicalRelationalFieldObject, used: Set<string>): TraitInteractionEdge | null {
  const ordered = field.trait_interaction_graph
    .slice()
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.edge_key.localeCompare(b.edge_key);
    });
  for (const edge of ordered) {
    if (!used.has(`trait:${edge.edge_key}`)) return edge;
  }
  return ordered[0] ?? null;
}

function selectDomain(field: CanonicalRelationalFieldObject, used: Set<string>): DomainDistribution | null {
  const ordered = field.domain_distribution
    .slice()
    .sort((a, b) => {
      if (b.total_weight !== a.total_weight) return b.total_weight - a.total_weight;
      return a.domain_id.localeCompare(b.domain_id);
    });
  for (const row of ordered) {
    if (!used.has(`domain:${row.domain_id}`)) return row;
  }
  return ordered[0] ?? null;
}

function buildStructureSignal(field: CanonicalRelationalFieldObject, used: Set<string>): SignalLine {
  const trait = selectTrait(field, used);
  if (trait) {
    const template = pickTemplate(field.object_identity_hash, 'friend', 'trait');
    return {
      text: template
        .replace('{edgeKey}', trait.edge_key)
        .replace('{value}', fmtPercent(trait.weight)),
      anchor: `trait:${trait.edge_key}`,
      signalKey: `trait:${trait.edge_key}`,
    };
  }
  const domain = selectDomain(field, used);
  if (domain) {
    const template = pickTemplate(field.object_identity_hash, 'friend', 'domain');
    return {
      text: template
        .replace('{domainId}', domain.domain_id)
        .replace('{value}', fmtPercent(domain.total_weight)),
      anchor: `domain:${domain.domain_id}`,
      signalKey: `domain:${domain.domain_id}`,
    };
  }
  return {
    text: 'Limited structural signals available in this field',
    anchor: 'domain:none',
    signalKey: 'structure:sparse',
  };
}

function contradictionLine(scoring: RelationalFieldScoreContract): SignalLine | null {
  const { cohesion_index, transformation_index, stability_index, tension_index } = scoring.derived_indices;
  if (cohesion_index >= 0.66 && transformation_index < 0.33) {
    return {
      text: `Index signal cohesion at ${fmtPercent(cohesion_index)} with transformation at ${fmtPercent(transformation_index)} limits adaptive change pressure.`,
      anchor: 'index:cohesion_index',
      signalKey: 'tension:cohesion-vs-transformation',
    };
  }
  if (stability_index >= 0.66 && tension_index >= 0.66) {
    return {
      text: `Index signal stability at ${fmtPercent(stability_index)} with tension at ${fmtPercent(tension_index)} creates sustained pressure cycles.`,
      anchor: 'index:stability_index',
      signalKey: 'tension:stability-vs-tension',
    };
  }
  return null;
}

function highTensionLine(field: CanonicalRelationalFieldObject, scoring: RelationalFieldScoreContract): SignalLine | null {
  if (scoring.derived_indices.tension_index >= 0.55) {
    return {
      text: `Index signal tension at ${fmtPercent(scoring.derived_indices.tension_index)} introduces high-friction exchange windows.`,
      anchor: 'index:tension_index',
      signalKey: 'tension:index',
    };
  }
  const highFrictionCell = field.pairwise_matrix
    .slice()
    .sort((a, b) => {
      if (b.interaction_vector.friction !== a.interaction_vector.friction) {
        return b.interaction_vector.friction - a.interaction_vector.friction;
      }
      return a.pair_key.localeCompare(b.pair_key);
    })[0];
  if (highFrictionCell && highFrictionCell.interaction_vector.friction >= 0.5) {
    return {
      text: `Interaction signal friction at ${fmtPercent(highFrictionCell.interaction_vector.friction)} in pair ${highFrictionCell.pair_key} requires active boundary control.`,
      anchor: `pair:${highFrictionCell.pair_key}:${highFrictionCell.dominant_category}`,
      signalKey: `tension:pair:${highFrictionCell.pair_key}`,
    };
  }
  return null;
}

function absenceLine(scoring: RelationalFieldScoreContract): SignalLine {
  if (scoring.derived_indices.transformation_index < 0.33) {
    return {
      text: `Index signal transformation at ${fmtPercent(scoring.derived_indices.transformation_index)} limits growth-through-change behavior.`,
      anchor: 'index:transformation_index',
      signalKey: 'tension:low-transformation',
    };
  }
  if (scoring.components.pairwise_volatility_mean < 0.33) {
    return {
      text: 'Low friction field — limited growth pressure',
      anchor: 'index:tension_index',
      signalKey: 'tension:low-friction',
    };
  }
  return {
    text: 'Low friction field — limited growth pressure',
    anchor: 'index:tension_index',
    signalKey: 'tension:fallback-low-friction',
  };
}

function buildContrast(scoring: RelationalFieldScoreContract): ContrastByIntent {
  return {
    friend: bucketIntentFit(canonicalIntentRank(scoring, 'friend')),
    lover: bucketIntentFit(canonicalIntentRank(scoring, 'lover')),
    collaborator: bucketIntentFit(canonicalIntentRank(scoring, 'collaborator')),
    rival: bucketIntentFit(canonicalIntentRank(scoring, 'rival')),
  };
}

function buildIntentSummary(intent: RelationalIntent, contrast: ContrastByIntent): string {
  const selected = `${titleIntent(intent)}: ${titleBucket(contrast[intent])}.`;
  const others = RELATIONAL_INTENTS.filter((x) => x !== intent);
  const ordered = others
    .map((x) => ({ intent: x, bucket: contrast[x], score: canonicalBucketScore(contrast[x]) }))
    .sort((a, b) => a.score - b.score || a.intent.localeCompare(b.intent));
  const first = ordered[0];
  const second = ordered[ordered.length - 1];
  return `${selected} ${titleIntent(first.intent)}: ${titleBucket(first.bucket)}. ${titleIntent(second.intent)}: ${titleBucket(second.bucket)}.`;
}

function canonicalBucketScore(bucket: IntentFitBucket): number {
  if (bucket === 'high') return 2;
  if (bucket === 'moderate') return 1;
  return 0;
}

export function buildCompatibilityExplanationProfile(input: {
  field: CanonicalRelationalFieldObject;
  scoring: RelationalFieldScoreContract;
  classification: CompatibilityClassification;
  intent: RelationalIntent;
}): CompatibilityExplanationProfile {
  const { field, scoring, classification, intent } = input;
  const usedSignals = new Set<string>();
  const anchors = new Set<string>();
  anchors.add(`class:${classification.outputs.class_code}`);

  const primary: SignalLine[] = [];
  pushUniqueLine(primary, anchors, usedSignals, buildIndexSignal(scoring, intent));
  pushUniqueLine(primary, anchors, usedSignals, buildInteractionSignal(field, intent, usedSignals));
  if (primary.length < 2) {
    pushUniqueLine(primary, anchors, usedSignals, {
      text: 'Interaction signal unavailable in this field; index signal drives intent ordering.',
      anchor: 'pair:none:none',
      signalKey: 'interaction:sparse',
    });
  }

  const secondary: SignalLine[] = [];
  pushUniqueLine(secondary, anchors, usedSignals, buildStructureSignal(field, usedSignals));

  const contrast = buildContrast(scoring);
  const intentFitSummary = buildIntentSummary(intent, contrast);

  const tensions: SignalLine[] = [];
  pushUniqueLine(tensions, anchors, usedSignals, contradictionLine(scoring));
  if (tensions.length === 0) {
    pushUniqueLine(tensions, anchors, usedSignals, highTensionLine(field, scoring));
  }
  if (tensions.length === 0) {
    pushUniqueLine(tensions, anchors, usedSignals, absenceLine(scoring));
  }

  const combinedLineCount = 1 + primary.length + secondary.length + tensions.length;
  if (combinedLineCount > 6) {
    secondary.splice(1);
  }

  return {
    intent,
    intentFitSummary,
    primarySupports: primary.slice(0, 2).map((x) => x.text),
    secondarySupports: secondary.slice(0, 2).map((x) => x.text),
    tensionsOrLimits: tensions.slice(0, 2).map((x) => x.text),
    contrastByIntent: contrast,
    anchors: Array.from(anchors).sort((a, b) => a.localeCompare(b)),
  };
}
