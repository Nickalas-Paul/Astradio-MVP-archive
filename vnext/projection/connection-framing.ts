/**
 * Phase D — connection-type structural framing (projection only; not wording-only swaps).
 */
import type { ConnectionMode, ExpansionTier, ProjectedExplanationSection, ProjectionSurface } from './projection-types';

function openingForMode(mode: ConnectionMode, seed: string): string | null {
  if (!mode || mode === 'group') return null;
  const variants: Record<string, string[]> = {
    friends: [
      `Structural framing (friends): cooperative bandwidth and mutual pacing tend to organize this pair readout; the following sections weight repair capacity and shared rhythm when friction signals appear.`,
    ],
    lovers: [
      `Structural framing (lovers): reciprocity and intimacy rhythm tend to organize this pair readout; polarity may read as attraction tension rather than a verdict on compatibility.`,
    ],
    rivals: [
      `Structural framing (rivals): competitive charge and boundary pressure tend to organize this pair readout; harmony signals are not treated as the default story unless they dominate the encoded field.`,
    ],
    neutral: [
      `Structural framing (neutral): low-assumption interface dynamics tend to organize this pair readout; emphasis stays descriptive and avoids locking a relationship myth.`,
    ],
    mentor: [
      `Structural framing (mentor): asymmetric support pacing tends to organize this pair readout; emphasis may lean toward guidance bandwidth without implying fixed hierarchy in lived behavior.`,
    ],
    collaborator: [
      `Structural framing (collaborator): task-phase coordination tends to organize this pair readout; friction may show up around ownership and tempo rather than intimacy chemistry.`,
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
    `Ensemble framing (${participantCount} charts): field-level signals tend to distribute across members; this readout avoids collapsing the group into a single two-person axis unless slot-level claims explicitly justify a dyadic subcluster.`,
    `Ensemble framing (${participantCount} charts): clustering and diffusion are read as systemic patterns; pair-style blame or “A vs B” framing is withheld unless claim groupings support a bounded subcluster note.`,
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
  const { surface, connectionMode, participantCount = 0, tier, seed } = opts;
  const out = [...sections];
  if (surface === 'compat_pair' && connectionMode && connectionMode !== 'group') {
    const text = openingForMode(connectionMode, seed);
    if (text && tier !== 'baseline') {
      out.unshift({
        id: 'connection_structure',
        title: 'Connection framing',
        text,
        meta: { claimIdsReferenced: [], phaseD: true },
      });
    } else if (text && tier === 'baseline') {
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
