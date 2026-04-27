/**
 * Connection / ensemble preface — private to rule layer; only called from assemble-sections.
 * **Proj:** sentence-bundle step (legacy “Phase 2” wording in older notes) — fixed bundles only (deterministic); not Product:Phase-2.
 */

// NOTE: "phase/stage" naming here is a historical delivery label only.
// It is not a product concept, runtime layer, or Campaign feature.
// Do not use this terminology in new implementation, planning, or design work.

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
  [
    'Friendly contact here is framed as adjustable bandwidth: you can widen or tighten the read without erasing either person.',
    'The lines below describe what shows, not a single myth that must carry the bond.',
    'Parallel tracks stay visible; no forced fusion into one verdict.',
  ],
  [
    'This frame assumes good faith and repairable edges; sharp moments can still be named plainly.',
    'Contrast is allowed to remain in view while cooperation stays the default lens.',
    'Neither side is reduced to a label in the copy that follows.',
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
  [
    'Intimacy cadence is described as a moving interface: contact can intensify and still stay bounded in language.',
    'The following blocks keep heat reportable without turning it into a fixed character stamp.',
    'Tension and care can both be named without one erasing the other in the read.',
  ],
  [
    'This frame allows desire and risk to show as mechanics, not as a sealed fate for either person.',
    'Reciprocity is treated as something you can read in the pattern without inventing a single winner.',
    'The next sections keep the relationship picture multi-valued on purpose.',
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
  [
    'Competitive charge is read as structural: edges can be sharp without turning either person into a villain type.',
    'The copy below keeps boundary pressure visible and still avoids moral spectacle.',
    'If collaboration appears, it has to win on evidence, not on a forced soft-focus.',
  ],
  [
    'Rivalry language here is situational: it can spike and still be reported without a permanent scoreboard on character.',
    'The following lines separate charge from identity so the interface stays testable in real time.',
    'You can read contest without erasing the possibility of shared standards elsewhere.',
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
  [
    'A neutral frame here means the bond is not pre-labeled: the sections name patterns, not a single romance script.',
    'The emphasis is on what is legible in the data window, not on forcing a best guess story.',
    'You can read uncertainty as part of the picture, not as a failure to commit to one arc.',
  ],
  [
    'This pass treats the connection as a live interface: the copy tracks signals without crowning a single narrative king.',
    'If two readings fit, both can stay in play while you watch how contact actually behaves.',
    'The following text keeps categories light so new evidence can update the read.',
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
  [
    'Mentor-shaped bandwidth is treated as a timing read: one lane may lead without erasing the other’s agency.',
    'The lines below show support edges without crowning a permanent “teacher” in the text.',
    'Responsibility here is reportable, not a life sentence in either direction.',
  ],
  [
    'This frame allows uneven exchange to show as mechanics while still keeping both figures in the room.',
    'Narration stays observational: care can read strong without relabeling either person’s core.',
    'If roles shift, the read can follow without pretending roles were always symmetric.',
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
  [
    'Task bridges are read as systems pressure: the issue may be the handoff, not the “type” of either partner.',
    'The following text tracks deadlines and fit without smuggling a chemistry verdict into logistics.',
    'If alignment returns, you can name it as data, not as a personality makeover.',
  ],
  [
    'This frame allows parallel ownership: the copy can show split lanes while still sharing one work surface.',
    'Responsibility loads are named where they show, without forcing a single scapegoat line.',
    'Realignment language stays bounded to the task field so identity noise does not drown the fix.',
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
    'The following lines avoid crowning a single person as the “true” center of the field.',
  ],
  [
    'A multi-voice pass keeps the roster visible: the blend is explicit, the private backstory is not smuggled in as fact.',
    'If one lane spikes, the text still allows other lanes to register without being averaged away.',
  ],
  [
    'The ensemble read tracks shared load and local hotspots; it is not a crowd verdict on any one name.',
    'You can use this layout to see where the airtime goes before you pick a local zoom.',
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
