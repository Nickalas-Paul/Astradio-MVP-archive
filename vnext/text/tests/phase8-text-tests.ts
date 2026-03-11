import * as fs from 'fs';
import * as path from 'path';
import type { TextAnalysisIntermediate, ToneSpec } from '../contracts';
import { renderDaily } from '../renderers/daily';
import {
  renderCompat,
  renderGroup,
  renderSandboxDiff,
  renderCampaignTurn,
  renderCharacterSheet
} from '../renderers/structural';
import { validateTone } from '../tone-validation';

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

  // 3) Non-daily renderers stay fail-closed
  {
    const compat = renderCompat(makeMinimalAnalysis('compat', false));
    const group = renderGroup(makeMinimalAnalysis('group', false));
    const sandbox = renderSandboxDiff(makeMinimalAnalysis('sandboxDiff', false));
    const campaign = renderCampaignTurn(makeMinimalAnalysis('campaignTurn', false));
    const character = renderCharacterSheet(makeMinimalAnalysis('characterSheet', false));

    for (const result of [compat, group, sandbox, campaign, character]) {
      if (result.status !== 'unimplemented') {
        throw new Error(`Non-daily renderer ${result.surface} is not fail-closed (status=${result.status})`);
      }
      if (result.sections.length !== 0) {
        throw new Error(`Non-daily renderer ${result.surface} emitted sections despite being unimplemented`);
      }
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
}

// Allow running directly when compiled as a script.
if (require.main === module) {
  runPhase8TextTests();
  // eslint-disable-next-line no-console
  console.log('[phase8-text-tests] OK');
}

