/**
 * Batch 4: Tier 2 completion — URANUS_SATURN entries + SUN_MERCURY transit fields.
 * Run: npx tsx vnext/scripts/apply-batch4-tier2-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const SATURN = path.join(__dirname, '../projection/insight-library/insight-library-aspects-saturn.ts');
const MERCURY = path.join(__dirname, '../projection/insight-library/insight-library-aspects-mercury.ts');

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadFragment(name: string): Map<string, string> {
  const raw = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const map = new Map<string, string>();
  const re = /  ([A-Z][A-Z0-9_]+):\s*\{[\s\S]*?\n  \},/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) map.set(m[1]!, m[0]);
  return map;
}

function replaceEntry(filePath: string, oldKey: string, newBlock: string): boolean {
  let src = fs.readFileSync(filePath, 'utf8');
  const keyRe = new RegExp(`\\n  ${escapeForRegex(oldKey)}:\\s*\\{[\\s\\S]*?\\n  \\},`);
  if (!keyRe.test(src)) {
    console.error('MISSING', oldKey, 'in', path.basename(filePath));
    return false;
  }
  src = src.replace(keyRe, `\n${newBlock}`);
  fs.writeFileSync(filePath, src, 'utf8');
  return true;
}

type MercuryPatch = { key: string; core_transit: string; behavioral_transit: string };

function applyMercuryPatch(patch: MercuryPatch): boolean {
  let src = fs.readFileSync(MERCURY, 'utf8');
  const keyRe = new RegExp(
    `(\\s+${escapeForRegex(patch.key)}:\\s*\\{)([\\s\\S]*?)(\\n\\s+\\},)`
  );
  const m = src.match(keyRe);
  if (!m) {
    console.error('MISSING', patch.key);
    return false;
  }
  let body = m[2]!;
  if (/\n\s+core_transit:/.test(body)) {
    body = body.replace(/\n\s+core_transit:\s*`[^`]*`,/, `\n    core_transit: \`${patch.core_transit}\`,`);
    body = body.replace(
      /\n\s+behavioral_transit:\s*`[^`]*`,/,
      `\n    behavioral_transit: \`${patch.behavioral_transit}\`,`
    );
  } else {
    const anchor = body.match(/\n\s+romantic_synastry:\s*`[^`]*`,/);
    if (!anchor) {
      console.error('NO romantic_synastry anchor', patch.key);
      return false;
    }
    body = body.replace(
      /\n\s+romantic_synastry:\s*`[^`]*`,/,
      `$&\n    core_transit: \`${patch.core_transit}\`,\n    behavioral_transit: \`${patch.behavioral_transit}\`,`
    );
  }
  src = src.replace(keyRe, `$1${body}$3`);
  fs.writeFileSync(MERCURY, src, 'utf8');
  return true;
}

const fragment = loadFragment('batch4-uranus-saturn-fragment.txt');
const saturnMap: [string, string][] = [
  ['SATURN_URANUS_CONJUNCTION', 'URANUS_SATURN_CONJUNCTION'],
  ['SATURN_URANUS_OPPOSITION', 'URANUS_SATURN_OPPOSITION'],
  ['SATURN_URANUS_SQUARE', 'URANUS_SATURN_SQUARE'],
  ['SATURN_URANUS_TRINE', 'URANUS_SATURN_TRINE'],
  ['SATURN_URANUS_SEXTILE', 'URANUS_SATURN_SEXTILE'],
];

let saturnOk = 0;
for (const [oldKey, newKey] of saturnMap) {
  const block = fragment.get(newKey);
  if (!block) {
    console.error('FRAGMENT MISSING', newKey);
    continue;
  }
  if (replaceEntry(SATURN, oldKey, block)) {
    saturnOk++;
    console.log('OK saturn', oldKey, '->', newKey);
  }
}

const MERCURY_PATCHES: MercuryPatch[] = [
  {
    key: 'SUN_MERCURY_CONJUNCTION',
    core_transit: `Transiting Sun meets your natal Mercury at the same degree, fusing identity and communication. What you need to express and who you are occupy the same space during this 1-2 day period. Your sense of self and your articulation principle aren't separate—they're operating together. When the Sun illuminates, your Mercury is already translating that awareness into language. When your Mercury communicates, the Sun is already giving it personal authority. This is access to authentic expression where identity and articulation are unified.`,
    behavioral_transit: `Speaking and being feel unified during this window. What you're saying and who you are aren't separate—the Sun's identity includes your Mercury's articulation naturally. Use this for conversations that require personal authority, communications where your authentic self needs to be present in the words, moments when what you say and who you are should be the same thing. The conjunction makes authentic expression available but won't create clarity where genuine self-knowledge is absent or manufacture articulation where communication capacity doesn't exist.`,
  },
  {
    key: 'SUN_MERCURY_OPPOSITION',
    core_transit: `Transiting Sun opposes your natal Mercury across 180 degrees, maximum distance between identity and communication. What you need to be and what you need to express are pulling in opposite directions during this 1-2 day period. Your sense of self and your articulation principle are at full polarity—when the Sun asserts identity, your Mercury wants to translate it differently; when your Mercury communicates, the Sun experiences the words as not fully representing who you are. The opposition holds both as equally real.`,
    behavioral_transit: `You see clearly which impulses are the Sun asserting identity and which are your Mercury translating experience into language. The opposition doesn't resolve by choosing self over expression or expression over self. It resolves by recognizing that who you are and how you communicate don't always converge perfectly. Use this window to notice where your words aren't carrying your full identity, or where your sense of self resists the articulation your Mercury offers. The work is conscious awareness of the gap rather than forcing them to match when the geometry keeps them opposed.`,
  },
  {
    key: 'SUN_MERCURY_SQUARE',
    core_transit: `Transiting Sun forms a square to your natal Mercury, ninety degrees of friction between identity and communication. What you need to be and what you need to express are cutting across each other during this 1-2 day period. Your sense of self and your articulation principle are both operating at full strength but in geometrically incompatible directions. The Sun says assert identity clearly; your Mercury says translate the complexity. The square means both impulses are legitimate but create friction when operating simultaneously.`,
    behavioral_transit: `You'll feel the pull between the Sun's "be yourself fully" and your Mercury's "communicate the nuance" more sharply during this window. The Sun wants pure self-expression; your Mercury wants accurate articulation. The square means both are valid but incompatible in the moment. Use this friction to examine whether you're communicating in ways that obscure who you actually are, or asserting identity in ways that bypass your Mercury's capacity for translation. The productive move is expression that honors both authentic self and articulate communication rather than one dominating at the expense of the other.`,
  },
  {
    key: 'SUN_MERCURY_TRINE',
    core_transit: `Transiting Sun forms a trine to your natal Mercury, 120 degrees in the same elemental family. Identity and communication are drawing from the same source during this 1-2 day period. Your sense of self and your articulation principle recognize each other as kin. When the Sun illuminates who you are, your Mercury translates that naturally into words. When your Mercury communicates, the Sun gives those words personal authority. This is access to fluent expression where identity and articulation support each other naturally.`,
    behavioral_transit: `Speaking feels aligned with being during this window. What you're expressing and who you are aren't in competition—the Sun's identity includes your Mercury's articulation naturally. Use this for communications that need both personal authority and clear expression, conversations where both authenticity and articulation are present, moments when your words can carry your full self without effort. The trine makes fluent expression available but won't create depth where superficiality is all that exists or manufacture communication where you have nothing to say.`,
  },
  {
    key: 'SUN_MERCURY_SEXTILE',
    core_transit: `Transiting Sun forms a sextile to your natal Mercury, 60 degrees of productive cooperation. Identity and communication are operating in compatible modes during this 1-2 day period. Your sense of self and your articulation principle have breathing room from each other—the Sun can assert identity without your Mercury immediately translating every nuance, and your Mercury can communicate without requiring the Sun's full identity be present in every word. This is access to flexible expression where being and speaking support each other productively.`,
    behavioral_transit: `Being yourself and expressing yourself feel compatible during this window rather than competing. What you're asserting and what you're articulating can support each other without one dominating. Use this for communications that need both personal presence and clear translation, conversations where identity and articulation contribute at appropriate moments, expression that happens in productive sequence rather than demanding both simultaneously. The sextile makes cooperation available but won't force articulation where you have nothing to express or create identity where genuine self-knowledge doesn't exist.`,
  },
];

let mercuryOk = 0;
for (const p of MERCURY_PATCHES) {
  if (applyMercuryPatch(p)) {
    mercuryOk++;
    console.log('OK mercury', p.key);
  }
}

console.log({ saturnOk, saturnExpected: 5, mercuryOk, mercuryExpected: 5 });
if (saturnOk !== 5 || mercuryOk !== 5) process.exit(1);
