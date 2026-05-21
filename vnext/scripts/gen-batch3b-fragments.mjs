import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const transcript = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-nicka-OneDrive-Astradio-MVP/agent-transcripts/6c564259-97b7-48a7-9673-01cd79c2a748/6c564259-97b7-48a7-9673-01cd79c2a748.jsonl'
);

const FIELD_ORDER = [
  'key',
  'pair',
  'aspect',
  'intensity',
  'core',
  'behavioral',
  'friendship',
  'romantic',
  'feed',
  'sonic',
  'core_synastry',
  'behavioral_synastry',
  'friendship_synastry',
  'romantic_synastry',
  'core_transit',
  'behavioral_transit',
];

const line = fs.readFileSync(transcript, 'utf8').split(/\n/)[111];
const obj = JSON.parse(line);
const text = obj.message.content[0].text;
const blocks = [...text.matchAll(/```typescript\n([\s\S]*?)\n```/g)].map((m) => m[1]);

function keyMap(oldKey) {
  if (oldKey.startsWith('JUPITER_PLUTO_')) return oldKey.replace('JUPITER_PLUTO_', 'PLUTO_JUPITER_');
  if (oldKey.startsWith('SATURN_NEPTUNE_')) return oldKey.replace('SATURN_NEPTUNE_', 'NEPTUNE_SATURN_');
  if (oldKey.startsWith('SATURN_PLUTO_')) return oldKey.replace('SATURN_PLUTO_', 'PLUTO_SATURN_');
  return oldKey;
}

function pairFor(oldKey) {
  if (oldKey.includes('JUPITER_PLUTO')) return 'PLUTO_JUPITER';
  if (oldKey.includes('SATURN_NEPTUNE')) return 'NEPTUNE_SATURN';
  return 'PLUTO_SATURN';
}

function parseFields(block) {
  const fields = {};
  const re = /^\s*(\w+):\s*(?:`([^`]*)`|'([^']*)'|"([^"]*)"),?\s*$/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    fields[m[1]] = m[2] ?? m[3] ?? m[4];
  }
  return fields;
}

function formatEntry(oldKey, fields) {
  const key = keyMap(oldKey);
  const pair = pairFor(oldKey);
  const aspect = fields.aspect;
  const intensity = fields.intensity;
  const header = `  ${key}: {\n    key: '${key}', pair: '${pair}', aspect: '${aspect}', intensity: '${intensity}',`;
  const bodyFields = FIELD_ORDER.filter((f) => !['key', 'pair', 'aspect', 'intensity'].includes(f));
  const lines = [header];
  for (const f of bodyFields) {
    if (fields[f] === undefined) throw new Error(`Missing field ${f} in ${oldKey}`);
    lines.push(`    ${f}: \`${fields[f]}\`,`);
  }
  lines.push('  },');
  return lines.join('\n');
}

function convertBlock(block) {
  const km = block.match(/^\s*(\w+):\s*\{/m);
  if (!km) return null;
  const oldKey = km[1];
  const fields = parseFields(block);
  fields.key = keyMap(oldKey);
  fields.pair = pairFor(oldKey);
  return formatEntry(oldKey, fields);
}

const jup = blocks.slice(0, 5).map(convertBlock);
const sat = blocks.slice(5, 15).map(convertBlock);

const jupPath = path.join(__dirname, 'batch3b-jupiter-pluto-fragment.txt');
const satPath = path.join(__dirname, 'batch3b-saturn-fragment.txt');
fs.writeFileSync(jupPath, `${jup.join('\n\n')}\n`);
fs.writeFileSync(satPath, `${sat.join('\n\n')}\n`);

console.log('jupiter-pluto', jup.length, 'lines', fs.readFileSync(jupPath, 'utf8').split('\n').length);
console.log('saturn', sat.length, 'lines', fs.readFileSync(satPath, 'utf8').split('\n').length);
