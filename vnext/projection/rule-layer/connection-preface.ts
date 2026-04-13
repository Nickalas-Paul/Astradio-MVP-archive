/**
 * Connection / ensemble preface — private to rule layer; only called from assemble-sections.
 * **Proj:** sentence-bundle step (legacy “Phase 2” wording in older notes) — fixed bundles only (deterministic); not Product:Phase-2.
 */
import type { ConnectionMode, ExpansionTier, ProjectedExplanationSection, ProjectionSurface } from '../projection-types';
import { taggedSectionBodyFromText } from '../tagged-text';

const FRIENDS_BUNDLES = [
  [
    'This connection emphasizes cooperative timing and repair when friction shows.',
    'The sections stay descriptive.',
    'They do not lock one relationship story.',
  ],
  [
    'This connection treats friendly bandwidth as the starting frame.',
    'Friction is named without identity collapse.',
    'The sections stay observational.',
  ],
];

const LOVERS_BUNDLES = [
  [
    'This connection emphasizes reciprocity and intimacy cadence.',
    'Polarity reads as tension, not a final verdict.',
    'The sections stay observational.',
  ],
  [
    'This connection names heat without turning it into a label.',
    'Language stays situational.',
    'The sections stay descriptive.',
  ],
];

const RIVALS_BUNDLES = [
  [
    'This connection names competitive charge and boundary pressure.',
    'Harmony is not assumed unless it clearly leads.',
    'Framing stays descriptive without moral blame.',
  ],
  [
    'This connection treats rivalry as charge, not character judgment.',
    'The sections stay observational.',
    'Avoid single-story collapse.',
  ],
];

const NEUTRAL_BUNDLES = [
  [
    'This connection keeps assumptions low.',
    'The picture weights what shows.',
    'The sections stay descriptive.',
  ],
  [
    'This connection keeps options open.',
    'It avoids locking one relationship myth.',
    'The sections stay observational.',
  ],
];

const MENTOR_BUNDLES = [
  [
    'This connection names asymmetric support timing.',
    'That does not fix hierarchy in real life.',
    'Both sides stay visible below.',
  ],
  [
    'This connection names guidance bandwidth without freezing roles.',
    'The sections stay descriptive.',
    'Care is honored without identity labels.',
  ],
];

const COLLABORATOR_BUNDLES = [
  [
    'This connection starts from task coordination.',
    'Friction may sit around ownership and phase fit.',
    'Language stays situational.',
  ],
  [
    'This connection does not assume chemistry explains task friction.',
    'The sections stay descriptive.',
    'Tasks stay human without identity-fixing.',
  ],
];

const MODE_BUNDLES: Record<string, string[][]> = {
  friends: FRIENDS_BUNDLES,
  lovers: LOVERS_BUNDLES,
  rivals: RIVALS_BUNDLES,
  neutral: NEUTRAL_BUNDLES,
  mentor: MENTOR_BUNDLES,
  collaborator: COLLABORATOR_BUNDLES,
};

const ENSEMBLE_BUNDLES = [
  [
    'This group holds multiple voices; emphasis may spread unevenly.',
    'The sections stay descriptive and keep emphasis legible at shared scale without collapsing to private detail.',
  ],
  [
    'This group treats the room as shared space; local emphasis still varies person to person.',
    'The sections stay descriptive.',
  ],
];

function openingForMode(mode: ConnectionMode, seed: string): string | null {
  if (!mode || mode === 'group') return null;
  const bundles = MODE_BUNDLES[mode];
  if (!bundles) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pick = bundles[h % bundles.length];
  return pick.join('\n\n');
}

function groupFieldOpening(participantCount: number, seed: string): string | null {
  if (participantCount <= 2) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pick = ENSEMBLE_BUNDLES[h % ENSEMBLE_BUNDLES.length];
  return pick.join('\n\n');
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
        meta: { claimIdsReferenced: [], phaseD: true, tagged: taggedSectionBodyFromText(text, 'preface') },
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
        meta: { claimIdsReferenced: [], phaseD: true, tagged: taggedSectionBodyFromText(g, 'preface') },
      });
    }
  }
  return out;
}
