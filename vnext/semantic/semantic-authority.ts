import type { CanonicalReportObject } from '../canonical/canonical-report-object';
import { validateCanonicalReportObject } from '../canonical/validate-canonical-report';
import { SEMANTIC_AUTHORITY_VERSION } from '../canonical/canonical-report-object';
import type { FeatureVec } from '../contracts';
import { reduceChartStructuralSignals, type ChartStructuralSignals, type ElementKey } from './authority-reducers';
import type {
  SemanticClaim,
  SemanticCore,
  SemanticCoreProvenance,
  RelationalSemanticBlock,
  TemporalWeightingBlock,
  TensionHarmonyBlock,
  TextProjectionEnvelope,
  AudioProjectionEnvelope,
} from './semantic-core';
import {
  type ClaimId,
  type DerivationCode,
  type RelationalBandCode,
  type CrossChartDeltaCode,
  type SectionTemplateId,
  type ToneFlagCode,
  type TempoBandCode,
  type DensityBandCode,
  type ArcBiasCode,
  type TensionBiasCode,
  type RelationalTextureCode,
} from './ontology-codes';
import { validateSemanticCore } from './validate-semantic-core';

function elementDomClaim(el: ElementKey): ClaimId {
  const m: Record<ElementKey, ClaimId> = {
    fire: 'ELEMENT_FIRE_DOM',
    earth: 'ELEMENT_EARTH_DOM',
    air: 'ELEMENT_AIR_DOM',
    water: 'ELEMENT_WATER_DOM',
  };
  return m[el];
}

function elementSecondaryClaim(el: ElementKey): ClaimId {
  const m: Record<ElementKey, ClaimId> = {
    fire: 'ELEMENT_SECONDARY_FIRE',
    earth: 'ELEMENT_SECONDARY_EARTH',
    air: 'ELEMENT_SECONDARY_AIR',
    water: 'ELEMENT_SECONDARY_WATER',
  };
  return m[el];
}

function claimsFromStructural(
  sig: ChartStructuralSignals,
  slotIndices: readonly number[],
  startRank: number
): SemanticClaim[] {
  const claims: SemanticClaim[] = [];
  let r = startRank;
  claims.push({
    claim_id: elementDomClaim(sig.primaryElement),
    priority_rank: r++,
    strength: clamp01(sig.elementalBalance[sig.primaryElement]),
    polarity: 'neutral',
    participant_slot_indices: slotIndices,
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  });
  if (sig.secondaryElement) {
    claims.push({
      claim_id: elementSecondaryClaim(sig.secondaryElement),
      priority_rank: r++,
      strength: clamp01(sig.elementalBalance[sig.secondaryElement]),
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
    });
  }
  claims.push(
    {
      claim_id: 'MODALITY_CARDINAL',
      priority_rank: r++,
      strength: clamp01(sig.modalityBalance.cardinal),
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'MODALITY_FIXED',
      priority_rank: r++,
      strength: clamp01(sig.modalityBalance.fixed),
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    },
    {
      claim_id: 'MODALITY_MUTABLE',
      priority_rank: r++,
      strength: clamp01(sig.modalityBalance.mutable),
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_ASTRO_SUMMARY_MODALITY',
    }
  );

  const tb =
    sig.tensionIndex >= 0.66 ? 'TENSION_BAND_HIGH' : sig.tensionIndex >= 0.33 ? 'TENSION_BAND_MED' : 'TENSION_BAND_LOW';
  claims.push({
    claim_id: tb as ClaimId,
    priority_rank: r++,
    strength: clamp01(sig.tensionIndex),
    polarity: tb === 'TENSION_BAND_HIGH' ? 'challenging' : 'constructive',
    participant_slot_indices: slotIndices,
    derivation_code: 'DERIVE_FEATURE_TENSION',
  });

  const tonal: ClaimId =
    sig.tonalPolarity === 'bright' ? 'TONAL_BRIGHT' : sig.tonalPolarity === 'dark' ? 'TONAL_DARK' : 'TONAL_BALANCED';
  claims.push({
    claim_id: tonal,
    priority_rank: r++,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: slotIndices,
    derivation_code: 'DERIVE_BRIGHTNESS_INDEX',
  });

  const res: ClaimId =
    sig.resolutionIndex >= 0.65
      ? 'RESOLUTION_STRONG'
      : sig.resolutionIndex >= 0.35
        ? 'RESOLUTION_MODERATE'
        : 'RESOLUTION_SOFT';
  claims.push({
    claim_id: res,
    priority_rank: r++,
    strength: clamp01(sig.resolutionIndex),
    polarity: 'constructive',
    participant_slot_indices: slotIndices,
    derivation_code: 'DERIVE_RESOLUTION_INDEX',
  });

  if (sig.stelliumClusters.length) {
    const st = Math.max(...sig.stelliumClusters.map((c) => c.strength));
    claims.push({
      claim_id: 'STRUCT_STELLIUM',
      priority_rank: r++,
      strength: clamp01(st),
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }
  if (sig.angularEmphasis.first) {
    claims.push({
      claim_id: 'STRUCT_ANGULAR_FIRST',
      priority_rank: r++,
      strength: 1,
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }
  if (sig.angularEmphasis.fourth) {
    claims.push({
      claim_id: 'STRUCT_ANGULAR_FOURTH',
      priority_rank: r++,
      strength: 1,
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }
  if (sig.angularEmphasis.seventh) {
    claims.push({
      claim_id: 'STRUCT_ANGULAR_SEVENTH',
      priority_rank: r++,
      strength: 1,
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }
  if (sig.angularEmphasis.tenth) {
    claims.push({
      claim_id: 'STRUCT_ANGULAR_TENTH',
      priority_rank: r++,
      strength: 1,
      polarity: 'neutral',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }
  const lum: ClaimId =
    sig.luminaryWeight === 'sun'
      ? 'STRUCT_LUMINARY_SUN'
      : sig.luminaryWeight === 'moon'
        ? 'STRUCT_LUMINARY_MOON'
        : 'STRUCT_LUMINARY_BALANCED';
  claims.push({
    claim_id: lum,
    priority_rank: r++,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: slotIndices,
    derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
  });
  if (sig.aspectSignature.trineHeavy) {
    claims.push({
      claim_id: 'STRUCT_ASPECT_TRINE_HEAVY',
      priority_rank: r++,
      strength: 1,
      polarity: 'constructive',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }
  if (sig.aspectSignature.squareHeavy) {
    claims.push({
      claim_id: 'STRUCT_ASPECT_SQUARE_HEAVY',
      priority_rank: r++,
      strength: 1,
      polarity: 'challenging',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }
  if (sig.aspectSignature.oppositionHeavy) {
    claims.push({
      claim_id: 'STRUCT_ASPECT_OPPOSITION_HEAVY',
      priority_rank: r++,
      strength: 1,
      polarity: 'challenging',
      participant_slot_indices: slotIndices,
      derivation_code: 'DERIVE_SNAPSHOT_STRUCTURE',
    });
  }

  const motionClaim: ClaimId =
    sig.motionProfileStr === 'surging'
      ? 'MOTION_LABEL_SURGING'
      : sig.motionProfileStr === 'restless'
        ? 'MOTION_LABEL_RESTLESS'
        : sig.motionProfileStr === 'quiet_flow'
          ? 'MOTION_LABEL_QUIET_FLOW'
          : sig.motionProfileStr === 'inward_consolidation'
            ? 'MOTION_LABEL_INWARD'
            : 'MOTION_LABEL_STEADY';
  claims.push({
    claim_id: motionClaim,
    priority_rank: r++,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: slotIndices,
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  });

  const gravityClaim: ClaimId =
    sig.gravityProfileStr === 'anchored'
      ? 'GRAVITY_LABEL_ANCHORED'
      : sig.gravityProfileStr === 'weighted_with_spark'
        ? 'GRAVITY_LABEL_WEIGHTED_SPARK'
        : sig.gravityProfileStr === 'floating'
          ? 'GRAVITY_LABEL_FLOATING'
          : sig.gravityProfileStr === 'light'
            ? 'GRAVITY_LABEL_LIGHT'
            : 'GRAVITY_LABEL_BALANCED';
  claims.push({
    claim_id: gravityClaim,
    priority_rank: r++,
    strength: 1,
    polarity: 'neutral',
    participant_slot_indices: slotIndices,
    derivation_code: 'DERIVE_FEATURE_ELEMENT_VEC',
  });

  return claims;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function crossChartClaims(
  va: FeatureVec,
  vb: FeatureVec,
  startRank: number
): SemanticClaim[] {
  const claims: SemanticClaim[] = [];
  let r = startRank;
  const el = (i: number) => clamp01(va[i] ?? 0);
  const diff = (i: number) => Math.abs(el(i) - clamp01(vb[i] ?? 0));
  const spread = (diff(27) + diff(28) + diff(29) + diff(30)) / 4;
  if (spread >= 0.12) {
    claims.push({
      claim_id: 'CROSS_ELEMENT_DRIFT_HIGH',
      priority_rank: r++,
      strength: clamp01(spread),
      polarity: 'neutral',
      participant_slot_indices: [0, 1],
      derivation_code: 'DERIVE_CROSS_CHART_VEC',
    });
  }
  const td = Math.abs((va[32] ?? 0.5) - (vb[32] ?? 0.5));
  if (td >= 0.15) {
    claims.push({
      claim_id: 'CROSS_TENSION_DELTA_HIGH',
      priority_rank: r++,
      strength: clamp01(td),
      polarity: 'challenging',
      participant_slot_indices: [0, 1],
      derivation_code: 'DERIVE_CROSS_CHART_VEC',
    });
  }
  return claims;
}

function relationalBlockFromWeather(w: NonNullable<CanonicalReportObject['relational_weather']>): RelationalSemanticBlock {
  const a = w.activation;
  const bands: RelationalBandCode[] = [];
  const push3 = (v: number, high: RelationalBandCode, med: RelationalBandCode, low: RelationalBandCode) => {
    bands.push(v >= 0.66 ? high : v >= 0.33 ? med : low);
  };
  push3(a.harmony, 'REL_BAND_HARMONY_HIGH', 'REL_BAND_HARMONY_MED', 'REL_BAND_HARMONY_LOW');
  push3(a.friction, 'REL_BAND_FRICTION_HIGH', 'REL_BAND_FRICTION_MED', 'REL_BAND_FRICTION_LOW');
  push3(a.intensity, 'REL_BAND_INTENSITY_HIGH', 'REL_BAND_INTENSITY_MED', 'REL_BAND_INTENSITY_LOW');
  const deltas: CrossChartDeltaCode[] = [];
  return { activation_profile: bands, cross_chart_delta_codes: deltas };
}

function textEnvelopeForSurface(surface: CanonicalReportObject['surface_kind']): TextProjectionEnvelope {
  if (surface === 'home_daily') {
    const order: SectionTemplateId[] = [
      'SECTION_SKY_SUMMARY',
      'SECTION_PERSONAL_EMPHASIS',
      'SECTION_LIKELY_EXPRESSIONS',
      'SECTION_WATCH_FORS',
      'SECTION_INTEGRATION',
      'SECTION_MUSIC_TRANSLATION',
    ];
    return { section_eligibility: order, emphasis_order: order, forbidden_tone_flags: [] };
  }
  if (surface === 'comparison_pair') {
    const order: SectionTemplateId[] = ['SECTION_COMPARISON_SIGNATURES', 'SECTION_COMPARISON_BRIDGE', 'SECTION_MUSICAL'];
    return { section_eligibility: order, emphasis_order: order, forbidden_tone_flags: [] };
  }
  if (surface === 'overlay_aggregate') {
    const order: SectionTemplateId[] = [
      'SECTION_AGGREGATE_FIELD',
      'SECTION_SIGNATURES',
      'SECTION_SIGNIFICANCE',
      'SECTION_MUSICAL',
    ];
    return { section_eligibility: order, emphasis_order: order, forbidden_tone_flags: [] };
  }
  const order: SectionTemplateId[] = ['SECTION_SIGNATURES', 'SECTION_SIGNIFICANCE', 'SECTION_MUSICAL'];
  return { section_eligibility: order, emphasis_order: order, forbidden_tone_flags: [] };
}

function toneFlagsFromSig(sig: ChartStructuralSignals): ToneFlagCode[] {
  const flags: ToneFlagCode[] = [];
  if (sig.tonalPolarity === 'bright') flags.push('TONE_AVOID_SHADOW');
  if (sig.angularEmphasis.seventh) flags.push('TONE_EMPHASIZE_MIRROR');
  if (sig.primaryElement === 'water') flags.push('TONE_EMPHASIZE_WATER');
  if (sig.tensionIndex >= 0.7) flags.push('TONE_EMPHASIZE_TENSION_HIGH');
  return flags;
}

function audioEnvelopeFromSig(sig: ChartStructuralSignals): AudioProjectionEnvelope {
  const tempo: TempoBandCode =
    sig.tensionIndex >= 0.66 ? 'TEMPO_HIGH' : sig.tensionIndex >= 0.33 ? 'TEMPO_MED' : 'TEMPO_LOW';
  const density: DensityBandCode =
    sig.tensionIndex >= 0.6 ? 'DENSITY_DENSE' : sig.tensionIndex <= 0.3 ? 'DENSITY_SPARSE' : 'DENSITY_BALANCED';
  const arc: ArcBiasCode =
    sig.tensionIndex >= 0.55 ? 'ARC_SURGE_RESOLVE' : sig.tensionIndex <= 0.35 ? 'ARC_FALL' : 'ARC_CYCLIC';
  const tensionBias: TensionBiasCode =
    sig.tensionIndex >= 0.66 ? 'AUDIO_TENSION_HIGH' : sig.tensionIndex >= 0.33 ? 'AUDIO_TENSION_MED' : 'AUDIO_TENSION_LOW';
  let rel: RelationalTextureCode = 'REL_TEXTURE_NEUTRAL';
  if (sig.primaryElement === 'water' || sig.motionProfileStr === 'quiet_flow') rel = 'REL_TEXTURE_FLUID';
  if (sig.angularEmphasis.seventh) rel = 'REL_TEXTURE_CALL_RESPONSE';
  if (sig.motionProfileStr === 'inward_consolidation') rel = 'REL_TEXTURE_STATIC';
  return {
    tempo_band: tempo,
    density_band: density,
    arc_bias: arc,
    tension_bias: tensionBias,
    relational_texture: rel,
  };
}

function buildProvenance(
  objectHash: string,
  claims: SemanticClaim[]
): SemanticCoreProvenance {
  const claim_index: SemanticCoreProvenance['claim_index'] = {};
  for (const c of claims) {
    (claim_index as Record<string, { priority_rank: number; derivation_code: DerivationCode }>)[c.claim_id] = {
      priority_rank: c.priority_rank,
      derivation_code: c.derivation_code,
    };
  }
  return {
    source_object_hash: objectHash,
    authority_version: SEMANTIC_AUTHORITY_VERSION,
    core_schema_version: 'semantic_core_v1',
    claim_index,
  };
}

/**
 * Single semantic interpreter for the product. Inputs: validated canonical object only.
 */
export function interpretCanonicalReportObject(o: CanonicalReportObject): SemanticCore {
  validateCanonicalReportObject(o);

  let claims: SemanticClaim[] = [];
  let rank = 0;

  const anchor = o.participants[o.anchor_slot_index ?? 0] ?? o.participants[0];
  const anchorSnap = anchor.natal_snapshot;
  const anchorVec = anchor.feature_vec;
  if (!anchorSnap || !anchorVec) {
    throw new Error('SemanticAuthority: anchor participant missing snapshot/vector');
  }

  const anchorSig = reduceChartStructuralSignals(anchorSnap, anchorVec, o.mechanical);
  claims = claims.concat(claimsFromStructural(anchorSig, [anchor.slot_index], rank));
  rank = claims.length;

  if (o.surface_kind === 'comparison_pair' && o.participants.length === 2) {
    const p0 = o.participants[0];
    const p1 = o.participants[1];
    if (p0.feature_vec && p1.feature_vec) {
      claims = claims.concat(crossChartClaims(p0.feature_vec, p1.feature_vec, rank));
      rank = claims.length;
    }
  }

  claims.sort((a, b) => a.priority_rank - b.priority_rank);
  claims = claims.map((c, i) => ({ ...c, priority_rank: i }));

  let relational: RelationalSemanticBlock | null = null;
  if (o.relational_weather) {
    relational = relationalBlockFromWeather(o.relational_weather);
    const rw = o.relational_weather;
    const a = rw.activation;
    const slotIdx = o.participants.map((p) => p.slot_index);
    const pushClaim = (id: ClaimId, strength: number, d: DerivationCode) => {
      claims.push({
        claim_id: id,
        priority_rank: claims.length,
        strength: clamp01(strength),
        polarity: 'neutral',
        participant_slot_indices: slotIdx,
        derivation_code: d,
      });
    };
    if (a.harmony >= 0.66) pushClaim('REL_HARMONY_HIGH', a.harmony, 'DERIVE_RELATIONAL_WEATHER');
    else if (a.harmony >= 0.33) pushClaim('REL_HARMONY_MED', a.harmony, 'DERIVE_RELATIONAL_WEATHER');
    else pushClaim('REL_HARMONY_LOW', a.harmony, 'DERIVE_RELATIONAL_WEATHER');
    if (a.friction >= 0.66) pushClaim('REL_FRICTION_HIGH', a.friction, 'DERIVE_RELATIONAL_WEATHER');
    else if (a.friction >= 0.33) pushClaim('REL_FRICTION_MED', a.friction, 'DERIVE_RELATIONAL_WEATHER');
    else pushClaim('REL_FRICTION_LOW', a.friction, 'DERIVE_RELATIONAL_WEATHER');
    if (a.intensity >= 0.66) pushClaim('REL_INTENSITY_HIGH', a.intensity, 'DERIVE_RELATIONAL_WEATHER');
    else if (a.intensity >= 0.33) pushClaim('REL_INTENSITY_MED', a.intensity, 'DERIVE_RELATIONAL_WEATHER');
    else pushClaim('REL_INTENSITY_LOW', a.intensity, 'DERIVE_RELATIONAL_WEATHER');
  }

  claims.sort((a, b) => a.priority_rank - b.priority_rank);
  claims = claims.map((c, i) => ({ ...c, priority_rank: i }));

  const transitVsNatal =
    o.surface_kind === 'home_daily' || o.surface_kind === 'comparison_pair'
      ? 0.55
      : o.surface_kind === 'profile_natal'
        ? 0
        : 0.35;
  const temporal: TemporalWeightingBlock = {
    phase_emphasis: ['PHASE_ENCOUNTER', 'PHASE_DEVELOPMENT', 'PHASE_RESOLUTION'],
    transit_vs_natal_weight: transitVsNatal,
  };

  const tb: TensionHarmonyBlock['tension_band'] =
    anchorSig.tensionIndex >= 0.66
      ? 'TENSION_BUCKET_HIGH'
      : anchorSig.tensionIndex >= 0.33
        ? 'TENSION_BUCKET_MED'
        : 'TENSION_BUCKET_LOW';
  const hb: TensionHarmonyBlock['harmony_band'] =
    anchorSig.aspectSignature.trineHeavy ? 'HARMONY_BUCKET_HIGH' : 'HARMONY_BUCKET_MED';

  const tension_harmony: TensionHarmonyBlock = {
    tension_band: tb,
    harmony_band: hb,
    claim_edges: [],
  };

  const textBase = textEnvelopeForSurface(o.surface_kind);
  let text: TextProjectionEnvelope = {
    ...textBase,
    forbidden_tone_flags: toneFlagsFromSig(anchorSig),
  };
  if (o.relational_weather) {
    const order = [...text.emphasis_order];
    const mi = order.indexOf('SECTION_MUSICAL');
    if (mi >= 0) order.splice(mi, 0, 'SECTION_RELATIONAL_WEATHER');
    else order.push('SECTION_RELATIONAL_WEATHER');
    const elig = new Set([...text.section_eligibility, 'SECTION_RELATIONAL_WEATHER' as SectionTemplateId]);
    text = {
      section_eligibility: [...elig],
      emphasis_order: order,
      forbidden_tone_flags: text.forbidden_tone_flags,
    };
  }
  const audio = audioEnvelopeFromSig(anchorSig);

  const provenance = buildProvenance(o.object_identity_hash, claims);

  const core: SemanticCore = {
    provenance,
    claims,
    relational,
    temporal,
    tension_harmony,
    text,
    audio,
    campaign: null,
  };
  validateSemanticCore(core);
  return core;
}
