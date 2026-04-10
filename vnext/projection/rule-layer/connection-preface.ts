/**
 * Connection / ensemble preface — private to rule layer; only called from assemble-sections.
 */
import type { ConnectionMode, ExpansionTier, ProjectedExplanationSection, ProjectionSurface } from '../projection-types';

function openingForMode(mode: ConnectionMode, seed: string): string | null {
  if (!mode || mode === 'group') return null;
  const variants: Record<string, string[]> = {
    friends: [
      `For this connection, you, at baseline, start from friendly bandwidth: cooperative timing and repair capacity matter when friction shows. The sections below stay descriptive and avoid locking one relationship story. Many people find this framing helps keep curiosity without forcing a verdict.`,
    ],
    lovers: [
      `For this connection, you, at baseline, start from reciprocity and intimacy cadence: polarity can feel like attraction tension, not a final verdict. The copy below stays observational. Many people find this framing helps name heat without turning it into a label.`,
    ],
    rivals: [
      `For this connection, you, at baseline, start from competitive charge and boundary pressure: harmony is not assumed unless it clearly leads. Friction is named without moral blame. Many people find this framing helps separate charge from character judgment.`,
    ],
    neutral: [
      `For this connection, you, at baseline, start from low assumptions: emphasis stays descriptive and avoids locking one relationship myth. The sections weight what the picture shows, not a preferred story. Many people find this framing helps keep options open.`,
    ],
    mentor: [
      `For this connection, you, at baseline, start from asymmetric support timing: guidance bandwidth may lean one way without fixing hierarchy in real life. Both sides stay visible below. Many people find this framing helps honor care without freezing roles.`,
    ],
    collaborator: [
      `For this connection, you, at baseline, start from task coordination: friction may sit around ownership and phase fit rather than chemistry. Language stays situational, not identity-fixed. Many people find this framing helps keep tasks human.`,
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
    `For this group, you, at baseline, hold ${participantCount} voices: emphasis often spreads unevenly, so avoid collapsing everyone into one pair story unless the picture supports it. Many people find this framing helps keep the room fair.`,
    `For this group, you, at baseline, hear a whole room first: pair-style blame stays off the table unless a smaller cluster clearly shows. The sections treat the ensemble as shared space. Many people find this framing slows rush-to-blame habits.`,
  ];
  return opts[h % opts.length];
}

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
