/**
 * Phase D — claim-sourced expansion beats (no new claims; uses SemanticCore.claims only).
 */
import type { SemanticCore, SemanticClaim } from '../semantic/semantic-core';
import type { ClaimId } from '../semantic/ontology-codes';
import type { ExpansionTier } from './projection-types';

function pickVariant(seed: string, variants: string[]): string {
  if (variants.length === 0) return '';
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

function claimWindow(tier: ExpansionTier): number {
  if (tier === 'baseline') return 6;
  if (tier === 'expanded') return 14;
  return 999;
}

function sentenceForClaim(c: SemanticClaim, seed: string): string {
  const id = c.claim_id as ClaimId;
  const s = `${seed}:${id}`;
  const strengthNote =
    c.strength >= 0.66 ? 'with relatively strong encoding in the feature field' : 'with moderate encoding in the feature field';

  const byId: Partial<Record<ClaimId, string[]>> = {
    ELEMENT_FIRE_DOM: [
      `A fire-weighted emphasis ${strengthNote} often correlates with quicker initiation rhythms and visible expressive heat in how the pattern lands.`,
    ],
    ELEMENT_EARTH_DOM: [
      `An earth-weighted emphasis ${strengthNote} often correlates with steadier pacing and a preference for tangible, stepwise stabilization.`,
    ],
    ELEMENT_AIR_DOM: [
      `An air-weighted emphasis ${strengthNote} often correlates with conceptual mobility and a tendency to narrate or reframe experience quickly.`,
    ],
    ELEMENT_WATER_DOM: [
      `A water-weighted emphasis ${strengthNote} often correlates with emotional permeability and layered processing before outward commitment.`,
    ],
    TENSION_BAND_HIGH: [
      `Higher structural tension in the encoded field often shows up as sharper contrasts and less forgiving harmonic spacing in how the pattern feels moment to moment.`,
    ],
    TENSION_BAND_MED: [
      `Moderate tension in the encoded field often shows up as workable friction: enough edge to move things, without constant crisis signaling.`,
    ],
    TENSION_BAND_LOW: [
      `Lower structural tension in the encoded field often shows up as smoother continuity and fewer abrupt harmonic breaks in pacing.`,
    ],
    TONAL_BRIGHT: [
      `A brighter tonal register in the encoded field often correlates with outward lift and a tendency to emphasize possibility over heaviness.`,
    ],
    TONAL_DARK: [
      `A darker tonal register in the encoded field often correlates with depth-first processing and a tendency to take tension seriously rather than glossing it.`,
    ],
    TONAL_BALANCED: [
      `A balanced tonal register in the encoded field often correlates with mixed brightness cues that can flex with context rather than locking one mood.`,
    ],
    REL_HARMONY_HIGH: [
      `High harmony-band signaling in the relational field often correlates with cooperative resonance and easier mutual pacing when activation rises.`,
    ],
    REL_FRICTION_HIGH: [
      `High friction-band signaling in the relational field often correlates with edge-rich contact where misunderstandings can spike if pacing is ignored.`,
    ],
    REL_INTENSITY_HIGH: [
      `High intensity-band signaling in the relational field often correlates with amplified activation: more signal per interaction, for better or sharper.`,
    ],
    CROSS_ELEMENT_DRIFT_HIGH: [
      `Strong cross-chart elemental drift often correlates with divergent baseline styles; blending language too quickly may flatten real differences.`,
    ],
    CROSS_TENSION_DELTA_HIGH: [
      `A large tension delta between charts often correlates with alternating stress profiles; a single unified arc may not fit both baselines.`,
    ],
    STRUCT_STELLIUM: [
      `A clustered structural signature often correlates with concentrated emphasis: many threads pulling through the same thematic doorway.`,
    ],
    MOTION_LABEL_SURGING: [
      `Surging motion labeling often correlates with forward impulse and rapid escalation curves in how energy is spent.`,
    ],
    MOTION_LABEL_INWARD: [
      `Inward motion labeling often correlates with consolidation phases where outward visibility lags behind internal processing.`,
    ],
    GRAVITY_LABEL_ANCHORED: [
      `Anchored gravity labeling often correlates with weighty downbeats and slower release curves in how resolution arrives.`,
    ],
  };

  const variants = byId[id];
  if (variants?.length) {
    return pickVariant(s, variants);
  }
  return `The encoded claim ${id} ${strengthNote}; this may show up as subtle shifts in emphasis rather than a single fixed behavioral label.`;
}

/** Mechanism + expression style paragraph from top claims (deterministic order = core order). */
export function buildClaimMechanismExpressionParagraph(
  core: SemanticCore,
  seed: string,
  tier: ExpansionTier
): { text: string; claimIds: string[] } {
  const n = claimWindow(tier);
  const slice = core.claims.slice(0, n);
  const lines: string[] = [];
  const ids: string[] = [];
  const maxLines = tier === 'baseline' ? 3 : tier === 'expanded' ? 5 : 8;
  for (let i = 0; i < slice.length && lines.length < maxLines; i++) {
    const c = slice[i];
    lines.push(sentenceForClaim(c, `${seed}:me:${i}`));
    ids.push(c.claim_id);
  }
  return { text: lines.join(' '), claimIds: ids };
}

export function buildTensionIntegrationParagraph(core: SemanticCore, seed: string): { text: string; claimIds: string[] } | null {
  const challenging = core.claims.filter((c) => c.polarity === 'challenging').slice(0, 4);
  const constructive = core.claims.filter((c) => c.polarity === 'constructive').slice(0, 4);
  if (challenging.length === 0 || constructive.length === 0) return null;
  const cIds = [...constructive.map((c) => c.claim_id), ...challenging.map((c) => c.claim_id)];
  const text = pickVariant(seed + ':ti', [
    `Taken together, constructive and challenging signals both appear in this readout; this configuration tends to benefit from naming friction without treating it as the whole story, while still honoring supportive threads where they show up.`,
    `This readout mixes supportive and challenging emphases; many people with this mix find that integration works best when neither side is forced to “win,” and pacing alternates between repair and forward motion.`,
  ]);
  return { text, claimIds: cIds };
}

/** Supplemental depth panel from a slice of claims (deterministic). */
export function buildSupplementalPanel(
  core: SemanticCore,
  seed: string,
  panelIndex: number,
  tier: ExpansionTier
): { title: string; text: string; claimIds: string[] } {
  const start = 2 + panelIndex * 3;
  const slice = core.claims.slice(start, start + 3 + (tier === 'extended' ? 2 : 0));
  const lines: string[] = [];
  const ids: string[] = [];
  for (let i = 0; i < slice.length; i++) {
    lines.push(sentenceForClaim(slice[i], `${seed}:panel:${panelIndex}:${i}`));
    ids.push(slice[i].claim_id);
  }
  const text = lines.join(' ') || pickVariant(seed, ['This readout includes additional encoded emphasis that may show up subtly in pacing rather than as a single headline.']);
  return {
    title: `Pattern note ${panelIndex + 1}`,
    text,
    claimIds: ids,
  };
}

export function buildCampaignPressureResponseParagraph(core: SemanticCore, seed: string): { text: string; claimIds: string[] } {
  const tension = core.claims.find((c) => c.claim_id.startsWith('TENSION_BAND'));
  const motion = core.claims.find((c) => c.claim_id.startsWith('MOTION_LABEL'));
  const ids: string[] = [];
  if (tension) ids.push(tension.claim_id);
  if (motion) ids.push(motion.claim_id);
  const tNote = tension
    ? `Tension signaling (${tension.claim_id}) often maps to a pressure loop: the system state may ask for steadier breath and smaller steps when activation spikes.`
    : `Pressure cues in this readout are distributed; the system state may still benefit from shorter loops and explicit checkpoints when intensity rises.`;
  const mNote = motion
    ? `Motion labeling (${motion.claim_id}) often maps to response pacing: choose actions that match the encoded impulse curve rather than fighting it outright.`
    : `Response pacing may need to stay flexible; without a dominant motion label, alternating consolidation and push tends to be safer than a single fixed speed.`;
  const text = pickVariant(seed + ':camp', [tNote + ' ' + mNote]);
  return { text, claimIds: ids };
}
