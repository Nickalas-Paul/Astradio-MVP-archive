/**
 * Phase D — connection-type structural framing (projection only; not wording-only swaps).
 * Each preface is exactly three sentences (period-terminated) for density validation.
 */
import type { ConnectionMode, ExpansionTier, ProjectedExplanationSection, ProjectionSurface } from './projection-types';

function openingForMode(mode: ConnectionMode, seed: string): string | null {
  if (!mode || mode === 'group') return null;
  const variants: Record<string, string[]> = {
    friends: [
      `Structural framing (friends): cooperative bandwidth and mutual pacing tend to organize this pair readout. The following sections weight repair capacity and shared rhythm when friction signals appear. Emphasis stays descriptive and avoids locking a single relationship myth.`,
    ],
    lovers: [
      `Structural framing (lovers): reciprocity and intimacy rhythm tend to organize this pair readout. Polarity may read as attraction tension rather than a verdict on compatibility. The copy below stays observational and does not treat chemistry as a fixed verdict.`,
    ],
    rivals: [
      `Structural framing (rivals): competitive charge and boundary pressure tend to organize this pair readout. Harmony signals are not treated as the default story unless they dominate the encoded field. Friction language is named without turning it into a moral label.`,
    ],
    neutral: [
      `Structural framing (neutral): low-assumption interface dynamics tend to organize this pair readout. Emphasis stays descriptive and avoids locking a relationship myth. The readout weights what the semantic field encodes rather than a preferred story.`,
    ],
    mentor: [
      `Structural framing (mentor): asymmetric support pacing tends to organize this pair readout. Emphasis may lean toward guidance bandwidth without implying fixed hierarchy in lived behavior. Both sides of the interface remain visible in the sections below.`,
    ],
    collaborator: [
      `Structural framing (collaborator): task-phase coordination tends to organize this pair readout. Friction may show up around ownership and tempo rather than intimacy chemistry. The following sections keep language situational rather than identity-fixed.`,
    ],
  };
  const list = variants[mode];
  if (!list) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

function groupFieldOpening(participantCount: number, seed: string): string | null {
  if (participantCount <= 2) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const opts = [
    `Ensemble framing (${participantCount} charts): field-level signals tend to distribute across members. This readout avoids collapsing the group into a single two-person axis unless slot-level claims explicitly justify a dyadic subcluster. Language stays descriptive of the encoded field rather than assigning fixed roles.`,
    `Ensemble framing (${participantCount} charts): clustering and diffusion are read as systemic patterns. Pair-style blame or “A vs B” framing is withheld unless claim groupings support a bounded subcluster note. The sections below treat the ensemble as a shared field first.`,
  ];
  return opts[h % opts.length];
}

/** Insert structural preface as first section (new id) — changes interpretive structure, not adjectives only. */
export function applyConnectionPreface(
  sections: ProjectedExplanationSection[],
  opts: {
    surface: ProjectionSurface;
    connectionMode?: ConnectionMode;
    participantCount?: number;
    tier: ExpansionTier;
    seed: string;
  }
): ProjectedExplanationSection[] {
  const { surface, connectionMode, participantCount = 0, seed } = opts;
  const out = [...sections];
  if (surface === 'compat_pair' && connectionMode && connectionMode !== 'group') {
    const text = openingForMode(connectionMode, seed);
    if (text) {
      out.unshift({
        id: 'connection_structure',
        title: 'Connection framing',
        text,
        meta: { claimIdsReferenced: [], phaseD: true },
      });
    }
  }
  if (surface === 'group' && participantCount > 2) {
    const g = groupFieldOpening(participantCount, seed);
    if (g) {
      out.unshift({
        id: 'ensemble_framing',
        title: 'Ensemble field',
        text: g,
        meta: { claimIdsReferenced: [], phaseD: true },
      });
    }
  }
  return out;
}
