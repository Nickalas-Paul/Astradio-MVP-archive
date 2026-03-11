import * as fs from 'fs';
import * as path from 'path';
import type { TextAnalysisIntermediate, ToneSpec, ChartTextInput } from '../contracts';
import type { EphemerisSnapshot } from '../../contracts';
import { buildTextAnalysis } from '../analysis/buildTextAnalysis';
import { renderDaily } from '../renderers/daily';
import {
  renderCompat,
  renderGroup,
  renderSandboxDiff,
  renderCampaignTurn,
  renderCharacterSheet
} from '../renderers/structural';
import { validateTone } from '../tone-validation';
import { generateTextSurface } from '../index';

function loadDailyToneSpec(): ToneSpec {
  const file = path.resolve(process.cwd(), 'vnext/text/tones/daily.personality.v1.json');
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw) as ToneSpec;
}

function makeMinimalAnalysis(surface: 'daily' | 'compat' | 'group' | 'sandboxDiff' | 'campaignTurn' | 'characterSheet', hasNatalContext: boolean): TextAnalysisIntermediate {
  return {
    surface,
    algoVersion: 'vnext-text-1',
    toneVersion: 'daily.personality.v1',
    hasNatalContext,
    astro_facts: {
      placements: [],
      houses: [],
      aspects: [],
      bodyRegistry: {
        all: [],
        majors: [],
        minors: []
      }
    },
    themes: [],
    tensions: [],
    opportunities: [],
    confidence: {
      score: 1,
      missing: hasNatalContext ? [] : [{ kind: 'no_natal_context' }]
    }
  };
}

function makeRicherAnalysis(): TextAnalysisIntermediate {
  return {
    surface: 'daily',
    algoVersion: 'vnext-text-1',
    toneVersion: 'daily.personality.v1',
    hasNatalContext: true,
    astro_facts: {
      placements: [
        {
          id: 'placement:Sun:Aries:1',
          body: 'Sun',
          sign: 'Aries',
          house: 1,
          nearAngle: 'ASC'
        }
      ],
      houses: [
        { house: 1, weight: 1 }
      ],
      aspects: [
        {
          id: 'aspect:Sun-square-Mars',
          aspect: {
            bodyA: 'Sun',
            bodyB: 'Mars',
            type: 'square',
            orb: 2,
            exactAngle: 90,
            strength: 0.9,
            exactness: 0.9,
            priorityBase: 1
          },
          ranking: {
            priorityBase: 1,
            strength: 0.9,
            exactness: 0.9,
            orderIndex: 0
          }
        }
      ],
      bodyRegistry: {
        all: [
          { key: 'sun', name: 'Sun', isMajor: true },
          { key: 'mars', name: 'Mars', isMajor: true }
        ],
        majors: [
          { key: 'sun', name: 'Sun', isMajor: true },
          { key: 'mars', name: 'Mars', isMajor: true }
        ],
        minors: []
      }
    },
    themes: [],
    tensions: [],
    opportunities: [],
    confidence: {
      score: 1,
      missing: []
    }
  };
}

export function runPhase8TextTests(): void {
  const tone = loadDailyToneSpec();

  // 1) Determinism: same analysis -> same daily output
  {
    const analysis = makeMinimalAnalysis('daily', false);
    const a = renderDaily(analysis, tone);
    const b = renderDaily(analysis, tone);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error('Determinism test failed: daily render outputs differ for identical input');
    }
  }

  // 1b) Public interface: loads correctly, routes daily surface from snapshot, and is deterministic
  {
    const snapshot = makeSynthesisSnapshot();
    const a = generateTextSurface({ surface: 'daily', snapshot });
    const b = generateTextSurface({ surface: 'daily', snapshot });
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error('Determinism test failed: interface daily render outputs differ for identical input');
    }
    if (a.surface !== 'daily') {
      throw new Error(`Interface daily render returned unexpected surface=${(a as any).surface}`);
    }
  }

  // 2) Sky-only vs natal-personalized behavior
  {
    const sky = renderDaily(makeMinimalAnalysis('daily', false), tone);
    const natal = renderDaily(makeMinimalAnalysis('daily', true), tone);

    const skyPersonal = sky.sections.find((s) => s.id === 'personal_emphasis')?.text ?? '';
    const natalPersonal = natal.sections.find((s) => s.id === 'personal_emphasis')?.text ?? '';

    if (!/stays general/i.test(skyPersonal)) {
      throw new Error('Sky-only daily personal_emphasis is not clearly generic');
    }
    if (!/In a personal reading of this chart/i.test(natalPersonal)) {
      throw new Error('Natal daily personal_emphasis does not use personalized phrasing');
    }
  }

  // 3) Non-daily structural renderers stay fail-closed (except characterSheet)
  {
    const compat = renderCompat(makeMinimalAnalysis('compat', false));
    const group = renderGroup(makeMinimalAnalysis('group', false));
    const sandbox = renderSandboxDiff(makeMinimalAnalysis('sandboxDiff', false));
    const campaign = renderCampaignTurn(makeMinimalAnalysis('campaignTurn', false));

    for (const result of [compat, group, sandbox, campaign]) {
      if (result.status !== 'unimplemented') {
        throw new Error(`Non-daily renderer ${result.surface} is not fail-closed (status=${result.status})`);
      }
      if (result.sections.length !== 0) {
        throw new Error(`Non-daily renderer ${result.surface} emitted sections despite being unimplemented`);
      }
    }
  }

  // 3b) Character sheet renderer: deterministic and node-driven
  {
    const analysis = makeCharacterSheetAnalysis();
    const a = renderCharacterSheet(analysis);
    const b = renderCharacterSheet(analysis);

    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error('Determinism test failed: characterSheet render outputs differ for identical input');
    }

    if (a.status !== 'ok') {
      throw new Error(`characterSheet renderer did not return ok status (status=${a.status})`);
    }

    const sections = a.sections ?? [];
    const ids = new Set(sections.map((s) => s.id));
    if (!ids.has('core_identity') || !ids.has('dynamic_edges') || !ids.has('growth_vectors')) {
      throw new Error('characterSheet renderer did not emit expected section structure');
    }

    const textBlob = sections.map((s) => s.text ?? '').join(' ');
    if (!/Theme One/i.test(textBlob) || !/Main Tension/i.test(textBlob) || !/Key Opportunity/i.test(textBlob)) {
      throw new Error('characterSheet renderer did not clearly consume provided themes/tensions/opportunities');
    }
  }

  // 3c) Public interface: routes structural surface to characterSheet renderer and preserves determinism
  {
    const snapshot = makeSynthesisSnapshot();
    const a = generateTextSurface({ surface: 'structural', snapshot });
    const b = generateTextSurface({ surface: 'structural', snapshot });

    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error('Determinism test failed: interface structural render outputs differ for identical input');
    }

    if (a.surface !== 'characterSheet') {
      throw new Error(`Interface structural render returned unexpected surface=${(a as any).surface}`);
    }
  }

  // 4) Tone validator catches injected violations
  {
    const bad = 'You are always this way. The universe wants you to change.';
    const violations = validateTone(bad, tone);
    if (!violations.some((v) => v.kind === 'fatalistic') || !violations.some((v) => v.kind === 'fluff')) {
      throw new Error('Tone validator did not catch fatalistic and fluff phrases');
    }
  }

  // 5) Tone validator passes normal daily output for minimal analysis
  {
    const daily = renderDaily(makeMinimalAnalysis('daily', false), tone);
    const textBlob = daily.sections.map((s) => s.text).join(' ');
    const violations = validateTone(textBlob, tone);
    const fatalFluffTherapy = violations.filter(
      (v) => v.kind === 'fatalistic' || v.kind === 'fluff' || v.kind === 'therapy_language'
    );
    if (fatalFluffTherapy.length > 0) {
      throw new Error('Tone validator found fatalistic/fluff/therapy violations in default daily output for minimal analysis');
    }
  }

  // 6) Richer analysis fixture behaves and passes tone checks (non-fatal, non-fluff, non-therapy)
  {
    const rich = renderDaily(makeRicherAnalysis(), tone);
    const textBlob = rich.sections.map((s) => s.text).join(' ');
    const violations = validateTone(textBlob, tone);
    const fatalFluffTherapy = violations.filter(
      (v) => v.kind === 'fatalistic' || v.kind === 'fluff' || v.kind === 'therapy_language'
    );
    if (fatalFluffTherapy.length > 0) {
      throw new Error('Tone validator found fatalistic/fluff/therapy violations in rich daily output');
    }
  }

  runSynthesisTests();
}

// Allow running directly when compiled as a script.
if (require.main === module) {
  runPhase8TextTests();
  // eslint-disable-next-line no-console
  console.log('[phase8-text-tests] OK');
}

function makeSynthesisSnapshot(): EphemerisSnapshot {
  return {
    ts: '2026-03-11T12:00:00Z',
    tz: 'UTC',
    lat: 0,
    lon: 0,
    houseSystem: 'placidus',
    planets: [
      { name: 'sun', lon: 10 },
      { name: 'moon', lon: 40 },
      { name: 'mars', lon: 100 },
      { name: 'jupiter', lon: 190 },
      { name: 'ceres', lon: 250 },
      { name: 'pallas', lon: 310 }
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [
      {
        bodyA: 'sun',
        bodyB: 'mars',
        type: 'square',
        orb: 2,
        exactAngle: 90,
        strength: 0.95,
        exactness: 0.95,
        priorityBase: 1
      },
      {
        bodyA: 'sun',
        bodyB: 'jupiter',
        type: 'trine',
        orb: 1.5,
        exactAngle: 120,
        strength: 0.9,
        exactness: 0.9,
        priorityBase: 0.9
      },
      {
        bodyA: 'ceres',
        bodyB: 'pallas',
        type: 'trine',
        orb: 1,
        exactAngle: 120,
        strength: 0.95,
        exactness: 0.95,
        priorityBase: 1
      }
    ],
    moonPhase: 0.5,
    dominantElements: { fire: 0.4, earth: 0.2, air: 0.2, water: 0.2 }
  };
}

function makeCharacterSheetAnalysis(): TextAnalysisIntermediate {
  return {
    surface: 'characterSheet',
    algoVersion: 'vnext-text-1',
    toneVersion: 'characterSheet.personality.v1',
    hasNatalContext: true,
    astro_facts: {
      placements: [],
      houses: [],
      aspects: [],
      bodyRegistry: {
        all: [],
        majors: [],
        minors: []
      }
    },
    themes: [
      {
        id: 'theme:1',
        label: 'Theme One',
        weight: 0.9,
        citations: { factIds: ['f1'] }
      },
      {
        id: 'theme:2',
        label: 'Theme Two',
        weight: 0.8,
        citations: { factIds: ['f2'] }
      }
    ],
    tensions: [
      {
        id: 'tension:1',
        label: 'Main Tension',
        weight: 0.85,
        polarity: 'tension',
        citations: { factIds: ['f3'] }
      }
    ],
    opportunities: [
      {
        id: 'opportunity:1',
        label: 'Key Opportunity',
        weight: 0.8,
        citations: { factIds: ['f4'] }
      }
    ],
    confidence: {
      score: 1,
      missing: []
    }
  };
}

function makeSynthesisInput(): ChartTextInput {
  const snapshot = makeSynthesisSnapshot();
  return {
    snapshot,
    surface: 'daily',
    algoVersion: 'vnext-text-1',
    toneVersion: 'daily.personality.v1',
    hasHouses: true,
    hasAspects: true,
    hasNatalContext: true,
    missing: []
  };
}

function runSynthesisTests(): void {
  // 7.1 Node generation for clear structures
  {
    const input = makeSynthesisInput();
    const analysis = buildTextAnalysis('daily', input);

    if (analysis.themes.length === 0) {
      throw new Error('Synthesis test: expected at least one theme node for structured chart');
    }
    if (analysis.tensions.length === 0) {
      throw new Error('Synthesis test: expected at least one tension node for structured chart');
    }
    if (analysis.opportunities.length === 0) {
      throw new Error('Synthesis test: expected at least one opportunity node for structured chart');
    }
  }

  // 7.2 Citation validity: every citation must match a placement or aspect fact id
  {
    const input = makeSynthesisInput();
    const analysis = buildTextAnalysis('daily', input);
    const placementIds = new Set(analysis.astro_facts.placements.map((p) => p.id));
    const aspectIds = new Set(analysis.astro_facts.aspects.map((a) => a.id));

    const checkNode = (node: { id: string; citations: { factIds: string[] } }) => {
      for (const factId of node.citations.factIds) {
        if (!placementIds.has(factId) && !aspectIds.has(factId)) {
          throw new Error(`Synthesis test: node ${node.id} cites unknown factId=${factId}`);
        }
      }
    };

    for (const node of analysis.themes) checkNode(node);
    for (const node of analysis.tensions) checkNode(node);
    for (const node of analysis.opportunities) checkNode(node);
  }

  // 7.3 Deterministic output and ranking stability: repeat run must match exactly
  {
    const input = makeSynthesisInput();
    const a = buildTextAnalysis('daily', input);
    const b = buildTextAnalysis('daily', makeSynthesisInput());

    const serialize = (x: TextAnalysisIntermediate) =>
      JSON.stringify({
        themes: x.themes,
        tensions: x.tensions,
        opportunities: x.opportunities
      });

    const sa = serialize(a);
    const sb = serialize(b);

    if (sa !== sb) {
      throw new Error('Synthesis test: repeated analysis produced different node sets or ordering');
    }
  }

  // 7.3b Stable ordering for equal-weight nodes: any ties must resolve the same way across runs
  {
    const input = makeSynthesisInput();
    const a = buildTextAnalysis('daily', input);
    const b = buildTextAnalysis('daily', makeSynthesisInput());

    const pickTop = (arr: { id: string; weight: number; citations: { factIds: string[] } }[]) => {
      if (arr.length === 0) return null;
      return arr
        .filter((n) => n.weight === arr[0].weight)
        .map((n) => n.id)
        .join('|');
    };

    const topThemesA = pickTop(a.themes);
    const topThemesB = pickTop(b.themes);
    if (topThemesA !== topThemesB) {
      throw new Error('Synthesis test: top theme tie-break ordering changed across runs');
    }
  }

  // 7.4 Major vs minor precedence: major-major structure must outrank minor-minor
  {
    const input = makeSynthesisInput();
    const analysis = buildTextAnalysis('daily', input);

    const majorTension = analysis.tensions.find((t) => /sun square mars/i.test(t.label));
    if (!majorTension) {
      throw new Error('Synthesis test: expected Sun square Mars tension node');
    }

    const minorOnlyTensions = analysis.tensions.filter((t) => /Ceres/.test(t.label) && /Pallas/.test(t.label));
    for (const node of minorOnlyTensions) {
      if (!(majorTension.weight >= node.weight)) {
        throw new Error(
          `Synthesis test: minor-only tension node ${node.id} outranks major-major Sun-Mars tension (weights ${node.weight} > ${majorTension.weight})`
        );
      }
    }
  }

  // 7.5 Duplicate prevention: ids should be unique per node kind
  {
    const input = makeSynthesisInput();
    const analysis = buildTextAnalysis('daily', input);

    const assertUniqueIds = (ids: string[], kind: string) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) {
          throw new Error(`Synthesis test: duplicate ${kind} node id=${id}`);
        }
        seen.add(id);
      }
    };

    assertUniqueIds(analysis.themes.map((t) => t.id), 'theme');
    assertUniqueIds(analysis.tensions.map((t) => t.id), 'tension');
    assertUniqueIds(analysis.opportunities.map((o) => o.id), 'opportunity');
  }

  // 7.6 Theme body dominance: minor-body themes should not outrank major-body themes
  {
    const input = makeSynthesisInput();
    const analysis = buildTextAnalysis('daily', input);

    const majorBodies = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
    const parseBodyFromId = (id: string): string | null => {
      const parts = id.split(':');
      if (parts.length < 3) return null;
      return parts[2];
    };

    const majorThemes = analysis.themes.filter((t) => {
      const bodyKey = parseBodyFromId(t.id);
      return bodyKey != null && majorBodies.has(bodyKey);
    });
    const minorThemes = analysis.themes.filter((t) => {
      const bodyKey = parseBodyFromId(t.id);
      return bodyKey != null && !majorBodies.has(bodyKey);
    });

    if (majorThemes.length > 0 && minorThemes.length > 0) {
      const topMajor = majorThemes[0];
      for (const minor of minorThemes) {
        if (!(topMajor.weight >= minor.weight)) {
          throw new Error(
            `Synthesis test: minor-body theme ${minor.id} outranks major-body theme ${topMajor.id} (weights ${minor.weight} > ${topMajor.weight})`
          );
        }
      }
    }
  }
}


