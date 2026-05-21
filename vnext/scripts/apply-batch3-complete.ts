/**
 * Batch 3B complete: replace PLUTO_JUPITER + NEPTUNE/PLUTO_SATURN entries,
 * direction-fix Sun-Venus/Mars transits in personal.ts, feed rewrites in mercury.ts.
 * Run: npx tsx vnext/scripts/apply-batch3-complete.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const JUPITER = path.join(__dirname, '../projection/insight-library/insight-library-aspects-jupiter.ts');
const SATURN = path.join(__dirname, '../projection/insight-library/insight-library-aspects-saturn.ts');
const PERSONAL = path.join(__dirname, '../projection/insight-library/insight-library-aspects-personal.ts');
const MERCURY = path.join(__dirname, '../projection/insight-library/insight-library-aspects-mercury.ts');

type FieldPatch = {
  key: string;
  file: 'personal' | 'mercury';
  core_transit?: string;
  behavioral_transit?: string;
  feed?: string;
};

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Load full entry blocks from a fragment file (KEY: { ... }, per entry). */
function loadFragmentEntries(fragmentName: string): Map<string, string> {
  const raw = fs.readFileSync(path.join(__dirname, fragmentName), 'utf8');
  const map = new Map<string, string>();
  const re = /  ([A-Z][A-Z0-9_]+):\s*\{[\s\S]*?\n  \},/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    map.set(m[1]!, m[0]);
  }
  return map;
}

/** Replace entire entry block for a key in a library file. */
function replaceFullEntry(filePath: string, key: string, entryBlock: string): boolean {
  let src = fs.readFileSync(filePath, 'utf8');
  const keyRe = new RegExp(
    `\\n  ${escapeForRegex(key)}:\\s*\\{[\\s\\S]*?\\n  \\},`
  );
  if (!keyRe.test(src)) {
    console.error('MISSING KEY', key, 'in', path.basename(filePath));
    return false;
  }
  src = src.replace(keyRe, `\n${entryBlock}`);
  fs.writeFileSync(filePath, src, 'utf8');
  return true;
}

function applyFieldPatch(filePath: string, patch: FieldPatch): boolean {
  let src = fs.readFileSync(filePath, 'utf8');
  const keyRe = new RegExp(
    `(\\s+${escapeForRegex(patch.key)}:\\s*\\{)([\\s\\S]*?)(\\n\\s+\\},)`
  );
  const m = src.match(keyRe);
  if (!m) {
    console.error('MISSING KEY', patch.key, 'in', path.basename(filePath));
    return false;
  }
  let body = m[2]!;

  if (patch.feed !== undefined) {
    const feedRe = /\n\s+feed:\s*`[^`]*`,/;
    if (!feedRe.test(body)) {
      console.error('NO FEED FIELD', patch.key);
      return false;
    }
    body = body.replace(feedRe, `\n    feed: \`${patch.feed}\`,`);
  }

  if (patch.core_transit !== undefined) {
    if (!/\n\s+core_transit:/.test(body)) {
      console.error('NO core_transit', patch.key);
      return false;
    }
    body = body.replace(
      /\n\s+core_transit:\s*`[^`]*`,/,
      `\n    core_transit: \`${patch.core_transit}\`,`
    );
  }

  if (patch.behavioral_transit !== undefined) {
    if (!/\n\s+behavioral_transit:/.test(body)) {
      console.error('NO behavioral_transit', patch.key);
      return false;
    }
    body = body.replace(
      /\n\s+behavioral_transit:\s*`[^`]*`,/,
      `\n    behavioral_transit: \`${patch.behavioral_transit}\`,`
    );
  }

  src = src.replace(keyRe, `$1${body}$3`);
  fs.writeFileSync(filePath, src, 'utf8');
  return true;
}

// Section B: transiting Venus/Mars → natal Sun (2-3 day window)
const SECTION_B: FieldPatch[] = [
  {
    key: 'SUN_VENUS_CONJUNCTION',
    file: 'personal',
    core_transit: `Transiting Venus meets your natal Sun at the same degree, fusing your conscious identity with beauty, love, and relational value during this 2-3 day window. Who you are and what you find beautiful arrive at the same frequency—your sense of self and your aesthetic values aren't having separate conversations. This is your identity being warmed by what Venus governs, and Venus being directed by solar will. What you value becomes visible as part of who you are rather than something you pursue apart from your identity.`,
    behavioral_transit: `You naturally create warmth and beauty in your environment during this window without performing it. What you find aesthetically right and what serves your identity are the same thing right now. Relational choices feel wholehearted because your sense of self and your capacity for love are aligned. The shadow: because identity and attraction are fused, rejection of your aesthetic choices can register as rejection of who you are rather than difference in taste. Use this for creative work that expresses your genuine aesthetic, relationships where you can show up as your whole self, decisions about beauty that don't require separating what you like from who you are.`,
  },
  {
    key: 'SUN_VENUS_TRINE',
    file: 'personal',
    core_transit: `Transiting Venus forms a trine to your natal Sun, 120 degrees of natural flow in the same elemental family during this 2-3 day window. Your identity and your sense of beauty are drawing from the same source. Who you are and what you value recognize each other as kin. Your conscious direction and your capacity for warmth move in the same current without friction.`,
    behavioral_transit: `Self-expression feels aesthetically right during this window without needing to manufacture it. What you create and who you are feel like the same thing. Relationships benefit from having your identity and your warmth available simultaneously without one compromising the other. The ease is real but it's also the limit—the trine won't push you toward unfamiliar aesthetic territory or force relational growth. Use this for creative work that refines your existing style, relationships that already feel aligned with who you are, beauty-making that expresses what you already know about yourself.`,
  },
  {
    key: 'SUN_VENUS_SEXTILE',
    file: 'personal',
    core_transit: `Transiting Venus forms a sextile to your natal Sun, opening a 2-3 day channel of productive cooperation between your sense of purpose and relational grace. Your sense of beauty and your sense of self are operating in compatible modes. What you value aesthetically and who you actually are can support each other without strain. Venus's grace and the Sun's authenticity have breathing room from each other—beauty and genuine presence can work together productively.`,
    behavioral_transit: `Being yourself and being graceful feel compatible during this window rather than opposed. Venus's aesthetic sense and the Sun's authentic expression aren't competing—when you show up as yourself, it can include beauty; when you create relational grace, it doesn't require performing someone you're not. Use this for moments that need both genuine presence and aesthetic attunement operating together.`,
  },
  {
    key: 'SUN_VENUS_SQUARE',
    file: 'personal',
    core_transit: `Transiting Venus forms a square to your natal Sun, 90 degrees of sustained friction between aesthetic value and identity during this 2-3 day period. What you find beautiful and who you actually are cut across each other. Venus's sense of grace and the Sun's authentic expression are both operating at full strength but in geometrically incompatible directions. The square isn't pathological—both planets are legitimate—but they're asking for incompatible things in the same moment.`,
    behavioral_transit: `You'll feel the pull between "be aesthetically pleasing" and "be genuinely yourself" more intensely during this window. Venus says create relational beauty even if it requires restraint; the Sun says express who you actually are even if it's not graceful. Use this friction to examine whether you're performing beauty at the cost of authentic presence, or whether solar rawness is demolishing Venus's capacity for grace entirely. The productive move is conscious choice about which planet the moment requires.`,
  },
  {
    key: 'SUN_VENUS_OPPOSITION',
    file: 'personal',
    core_transit: `Transiting Venus opposes your natal Sun across 180 degrees, maximum distance between aesthetic value and conscious identity during this 2-3 day period. What you find beautiful and who you actually are sit at opposite poles. Venus's sense of grace and the Sun's authentic expression are pulling in different directions—when you're being genuine, it's not beautiful; when you're creating beauty, you're not being yourself. The opposition holds both as equally legitimate.`,
    behavioral_transit: `You see clearly the gap between being aesthetically pleasing and being genuinely yourself. The opposition doesn't resolve by choosing Venus's beauty over solar authenticity or the Sun's genuineness over Venusian grace. It resolves by recognizing that both are real and learning to operate across the distance. Use this window to get honest about whether you're performing relational beauty while your actual self goes unexpressed, or whether solar authenticity is demolishing every attempt at grace.`,
  },
  {
    key: 'SUN_MARS_CONJUNCTION',
    file: 'personal',
    core_transit: `Transiting Mars meets your natal Sun at the same degree, fusing your conscious identity with drive, assertion, and physical force during this 2-3 day window. Who you are and what you're moved to fight for arrive at the same frequency. Your sense of self and your pursuit aren't having separate conversations. This is your identity being energized by Mars, and Mars being directed by solar will. What you want becomes visible as part of who you are rather than something separate from your identity.`,
    behavioral_transit: `You pursue goals with your whole self during this window rather than splitting identity from action. What you want and who you are feel like the same thing. The drive is wholehearted and backed by your entire identity. The shadow: because self and assertion are fused, resistance to your pursuit can register as attack on your identity rather than opposition to your goals. Use this for goals that require full commitment, confrontations where your entire identity is invested in the outcome, physical challenges that demand you show up as your complete self.`,
  },
  {
    key: 'SUN_MARS_OPPOSITION',
    file: 'personal',
    core_transit: `Transiting Mars opposes your natal Sun across 180 degrees during this 2-3 day window. Your identity and your drive are pulling in opposite directions. Who you are reaches toward one pole. What you want to fight for reaches toward the other. The opposition holds both as equally real. Your conscious sense of self and your assertion are at maximum distance from each other right now.`,
    behavioral_transit: `You see clearly the gap between who you are and what you're pursuing. The opposition doesn't resolve by choosing identity over drive or drive over self. It resolves by recognizing that both are legitimate and learning to operate across the distance. Use this window to get honest about whether your current pursuit actually serves who you're becoming or whether you're fighting for goals that no longer match your identity. The work is integration rather than choosing one pole.`,
  },
  {
    key: 'SUN_MARS_SQUARE',
    file: 'personal',
    core_transit: `Transiting Mars forms a square to your natal Sun, 90 degrees of sustained friction between drive and identity during this 2-3 day period. What you're actively pursuing and who you actually are cut across each other. Mars's force and the Sun's conscious aims are both operating at full strength but in geometrically incompatible directions. The square isn't asking you to abandon ambition—it's asking whether your pursuit serves your actual self.`,
    behavioral_transit: `You'll feel the tension between "act decisively" and "stay true to who I am" more sharply during this window. Mars says pursue this goal with full force; the Sun says that goal doesn't match my actual identity. Use this friction to examine whether you're pursuing ambitions that don't serve your genuine self, or whether solar identity is preventing legitimate growth Mars is trying to achieve. The conflict resolves through conscious choice about which planet to honor in this specific situation.`,
  },
  {
    key: 'SUN_MARS_TRINE',
    file: 'personal',
    core_transit: `Transiting Mars forms a trine to your natal Sun, 120 degrees in the same elemental family during this 2-3 day window. Your drive and your identity are drawing from the same source. What you're pursuing and who you are recognize each other as kin. Mars's physical force and the Sun's conscious expression are operating in natural harmony—when you act, it's in service of your actual self; when your Sun expresses identity, Mars can back it with real force.`,
    behavioral_transit: `Pursuing goals feels aligned with your genuine identity during this window. What you're fighting for and who you actually are aren't in competition—Mars's drive serves the Sun's authentic expression naturally. Use this for pursuits that need both committed force and genuine direction, goals where action and identity are drawing from the same elemental source. The trine makes this coordination available but won't create passion where genuine desire is absent.`,
  },
  {
    key: 'SUN_MARS_SEXTILE',
    file: 'personal',
    core_transit: `Transiting Mars forms a sextile to your natal Sun, opening a 2-3 day channel of productive cooperation between drive and deliberate self-expression. Your drive and your sense of self are operating in compatible modes. What you want to pursue and who you actually are can support each other without strain. Mars's force and the Sun's identity have breathing room from each other—action and authentic presence can work together productively.`,
    behavioral_transit: `Pursuing what you want feels aligned with who you are during this window rather than forcing you to perform someone else's version of success. Mars's drive and the Sun's identity are compatible—when you act, it's in service of your actual self rather than an image. Use this for goals that need both committed force and authentic direction, pursuits where action and identity support each other rather than competing.`,
  },
];

// Section C: feed → transit-relational (between these charts today)
const SECTION_C: FieldPatch[] = [
  {
    key: 'SUN_MERCURY_SEXTILE',
    file: 'mercury',
    feed: `The Sun and Mercury are cooperating productively between these charts today. One person's identity and the other person's thinking are operating in compatible modes right now rather than competing. The current sky is opening channels where authentic self-expression and clear articulation can support each other. When one person's Sun shows up as themselves, the other person's Mercury can think about that presence constructively without distancing from it. When Mercury articulates, the Sun experiences it as recognition rather than analysis from outside. Use this for conversations that need both genuine presence and intellectual clarity without friction.`,
  },
  {
    key: 'SUN_MERCURY_SQUARE',
    file: 'mercury',
    feed: `The Sun and Mercury are at friction point between these charts today. One person's identity and the other person's thinking are cutting across each other with more geometric force than usual right now. The current sky is making visible the tension between authentic self-expression and intellectual analysis in this connection. When one person's Sun is being genuine, the other person's Mercury may analyze it in ways that feel misaligned. When Mercury articulates precisely, the Sun may experience it as opposite to authentic presence. The friction is structural. There's something useful in naming that gap rather than forcing convergence the geometry doesn't support.`,
  },
  {
    key: 'JUPITER_MERCURY_SEXTILE',
    file: 'mercury',
    feed: `Jupiter and Mercury are cooperating productively between these charts today. One person's expansion impulse and the other person's thinking are operating in compatible modes right now. The current sky is opening channels where big vision and articulate precision can support each other. When one person's Jupiter wants to grow, the other person's Mercury can think strategically about that growth without constraining it. When Mercury articulates a plan, Jupiter can see the larger possibility without dismissing the details. Use this for planning that needs both vision and clarity applied at appropriate moments.`,
  },
  {
    key: 'JUPITER_MERCURY_OPPOSITION',
    file: 'mercury',
    feed: `Jupiter and Mercury are at opposite poles between these charts today. One person's expansion impulse and the other person's articulate precision are at maximum distance from each other right now. The current sky is making visible the gap between thinking big and thinking clearly in this connection. What one person experiences as exciting scope, the other experiences as imprecise overreach. What one person experiences as necessary detail, the other experiences as limiting vision. The distance isn't failure—it's the opposition showing you that ambition and accuracy don't always arrive together. Use this window to name which form of thinking the moment actually requires.`,
  },
  {
    key: 'SATURN_MERCURY_CONJUNCTION',
    file: 'mercury',
    feed: `Saturn and Mercury are meeting at the same degree between these charts today. One person's structural requirement and the other person's thinking are fused right now. The current sky is opening a window where discipline and articulation aren't separate—when one person's Saturn builds foundation, the other person's Mercury is already thinking about proof and sustainable form. When Mercury articulates, Saturn gives that thinking weight and consequence. Use this for conversations that need both rigor and clarity operating together, commitments where words and structure must align.`,
  },
  {
    key: 'SATURN_MERCURY_SEXTILE',
    file: 'mercury',
    feed: `Saturn and Mercury are cooperating productively between these charts today. One person's structural requirement and the other person's thinking are operating in compatible modes right now. The current sky is opening channels where discipline and mental agility can support each other. When one person's Saturn establishes limits, the other person's Mercury can work within those limits without feeling crushed. When Mercury articulates, Saturn can contribute realistic framework without suppressing clarity. Use this for work that needs both precision and sustainable structure applied at appropriate moments.`,
  },
  {
    key: 'SATURN_MERCURY_SQUARE',
    file: 'mercury',
    feed: `Saturn and Mercury are at friction point between these charts today. One person's structural requirement and the other person's thinking are cutting across each other with more geometric force than usual right now. The current sky is making visible the tension between proof and fluency in this connection. When one person's Saturn demands rigor, the other person's Mercury experiences it as blockage. When Mercury moves quickly, Saturn experiences it as insufficient foundation. The friction is structural—both discipline and clarity are legitimate. There's something useful in naming that difference rather than forcing one planet to surrender.`,
  },
  {
    key: 'SATURN_MERCURY_TRINE',
    file: 'mercury',
    feed: `Saturn and Mercury are flowing together between these charts today in natural harmony. One person's structural requirement and the other person's thinking are drawing from the same elemental source right now. The current sky is amplifying how easily discipline and articulation support each other in this connection. When Saturn builds foundation, Mercury knows how to think within it productively. When Mercury articulates, Saturn recognizes it as structurally sound rather than loose. Use this for intellectual work that needs both rigor and clarity operating as allies.`,
  },
  {
    key: 'SATURN_MERCURY_OPPOSITION',
    file: 'mercury',
    feed: `Saturn and Mercury are at opposite poles between these charts today. One person's structural requirement and the other person's thinking are at maximum distance from each other right now. The current sky is making visible the gap between proof and mental freedom in this connection. When one person's Saturn establishes limits, the other person's Mercury experiences it as constraining. When Mercury thinks openly, Saturn experiences it as insufficiently grounded. The distance isn't pathological—it's the opposition showing you that structure and fluency don't always arrive together. Use this window to choose consciously which planet the moment requires.`,
  },
  {
    key: 'MOON_MERCURY_SEXTILE',
    file: 'mercury',
    feed: `The Moon and Mercury are cooperating productively between these charts today. One person's emotional instinct and the other person's thinking are operating in compatible modes right now rather than competing. The current sky is opening channels where feeling and articulation can support each other. When one person's Moon is experiencing emotion, the other person's Mercury can name it without distancing from the feeling. When Mercury articulates, the Moon recognizes it as emotionally accurate rather than cold analysis. Use this for conversations that need both emotional honesty and clear language without the two modes fighting.`,
  },
];

let fullReplaceOk = 0;
let fullReplaceFail = 0;

const jupEntries = loadFragmentEntries('batch3b-jupiter-pluto-fragment.txt');
for (const [key, block] of jupEntries) {
  if (replaceFullEntry(JUPITER, key, block)) {
    fullReplaceOk++;
    console.log('OK full replace', path.basename(JUPITER), key);
  } else fullReplaceFail++;
}

const satEntries = loadFragmentEntries('batch3b-saturn-fragment.txt');
for (const [key, block] of satEntries) {
  if (replaceFullEntry(SATURN, key, block)) {
    fullReplaceOk++;
    console.log('OK full replace', path.basename(SATURN), key);
  } else fullReplaceFail++;
}

let patchOk = 0;
let patchFail = 0;

for (const p of [...SECTION_B, ...SECTION_C]) {
  const fp = p.file === 'mercury' ? MERCURY : PERSONAL;
  if (applyFieldPatch(fp, p)) {
    patchOk++;
    console.log('OK patch', path.basename(fp), p.key);
  } else patchFail++;
}

console.log('\n--- Batch 3 complete apply summary ---');
console.log({
  fullEntryReplace: { ok: fullReplaceOk, fail: fullReplaceFail, expected: 15 },
  fieldPatches: { ok: patchOk, fail: patchFail, expected: 20 },
  totalSuccess: fullReplaceOk + patchOk,
  totalExpected: 35,
});

if (fullReplaceFail > 0 || patchFail > 0) process.exit(1);
