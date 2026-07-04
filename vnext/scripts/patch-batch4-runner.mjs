import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS } from './patch-batch4-fields.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projection/insight-library');

const JUPITER_KEYS = Object.keys(FIELDS).filter(
  (k) => k.startsWith('JUPITER_') && !k.includes('MERCURY') && !k.includes('JUPITER_JUPITER'),
);
const SATURN_KEYS = Object.keys(FIELDS).filter(
  (k) => k.startsWith('SATURN_') && !k.includes('MERCURY') && !k.includes('SATURN_SATURN'),
);
const URANUS_OUTER_FILE = Object.keys(FIELDS).filter(
  (k) => k.startsWith('URANUS_') && !k.includes('MERCURY'),
);
const NEPTUNE_OUTER_FILE = Object.keys(FIELDS).filter(
  (k) => k.startsWith('NEPTUNE_') && !k.includes('MERCURY'),
);
const PLUTO_OUTER_FILE = Object.keys(FIELDS).filter(
  (k) => k.startsWith('PLUTO_') && !k.includes('MERCURY'),
);
const MERCURY_OUTER_KEYS = Object.keys(FIELDS).filter(
  (k) =>
    k.startsWith('URANUS_MERCURY') ||
    k.startsWith('NEPTUNE_MERCURY') ||
    k.startsWith('PLUTO_MERCURY'),
);

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Replace a field value whether stored as `...` or '...' (handles long multiline strings). */
function replaceField(block, field, value) {
  const label = `${field}:`;
  const idx = block.indexOf(label);
  if (idx < 0) throw new Error(`missing ${field}`);
  let pos = idx + label.length;
  while (block[pos] === ' ') pos++;
  const delim = block[pos];
  if (delim !== '`' && delim !== "'") throw new Error(`unknown delimiter for ${field}`);
  pos++;
  while (pos < block.length) {
    if (block[pos] === '\\') {
      pos += 2;
      continue;
    }
    if (block[pos] === delim) {
      pos++;
      while (block[pos] === ' ') pos++;
      if (block[pos] !== ',') throw new Error(`expected comma after ${field}`);
      pos++;
      break;
    }
    pos++;
  }
  const replacement = ` ${field}: '${esc(value)}',`;
  return block.slice(0, idx) + replacement + block.slice(pos);
}

function addSelfFields(block, entry) {
  if (!entry.core_self || !entry.behavioral_self) return block;
  if (/\ncore_self:/.test(block)) return block;
  const label = 'behavioral_synastry:';
  const idx = block.indexOf(label);
  if (idx < 0) throw new Error('missing behavioral_synastry');
  let pos = idx + label.length;
  while (block[pos] === ' ') pos++;
  const delim = block[pos];
  pos++;
  while (pos < block.length) {
    if (block[pos] === '\\') {
      pos += 2;
      continue;
    }
    if (block[pos] === delim) {
      pos++;
      while (block[pos] === ' ') pos++;
      if (block[pos] !== ',') throw new Error('expected comma after behavioral_synastry');
      pos++;
      break;
    }
    pos++;
  }
  const insert = `\n core_self: '${esc(entry.core_self)}',\n behavioral_self: '${esc(entry.behavioral_self)}',`;
  return block.slice(0, pos) + insert + block.slice(pos);
}

function patchEntry(content, key, entry, { replaceSynastry, addSelf }) {
  const start = content.indexOf(`${key}:`);
  if (start < 0) throw new Error(`${key} not found`);
  const end = content.indexOf('\n },', start);
  if (end < 0) throw new Error(`${key} block end not found`);
  let block = content.slice(start, end);
  if (replaceSynastry) {
    if (!entry.core_synastry || !entry.behavioral_synastry) {
      throw new Error(`missing synastry for ${key}`);
    }
    block = replaceField(block, 'core_synastry', entry.core_synastry);
    block = replaceField(block, 'behavioral_synastry', entry.behavioral_synastry);
  }
  if (addSelf) {
    block = addSelfFields(block, entry);
  }
  return content.slice(0, start) + block + content.slice(end);
}

function patchFile(fileName, keys, opts) {
  const filePath = path.join(root, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  for (const key of keys) {
    content = patchEntry(content, key, FIELDS[key], opts);
  }
  fs.writeFileSync(filePath, content);
  return keys.length;
}

const jupiterN = patchFile('insight-library-aspects-jupiter.ts', JUPITER_KEYS, {
  replaceSynastry: true,
  addSelf: false,
});
const saturnN = patchFile('insight-library-aspects-saturn.ts', SATURN_KEYS, {
  replaceSynastry: true,
  addSelf: false,
});
const uranusN = patchFile('insight-library-aspects-uranus.ts', URANUS_OUTER_FILE, {
  replaceSynastry: true,
  addSelf: true,
});
const neptuneN = patchFile('insight-library-aspects-neptune.ts', NEPTUNE_OUTER_FILE, {
  replaceSynastry: true,
  addSelf: true,
});
const plutoN = patchFile('insight-library-aspects-pluto.ts', PLUTO_OUTER_FILE, {
  replaceSynastry: true,
  addSelf: true,
});
const mercuryN = patchFile('insight-library-aspects-mercury.ts', MERCURY_OUTER_KEYS, {
  replaceSynastry: false,
  addSelf: true,
});

console.log('jupiter', jupiterN, 'saturn', saturnN, 'uranus', uranusN, 'neptune', neptuneN, 'pluto', plutoN, 'mercury', mercuryN);
const total = jupiterN + saturnN + uranusN + neptuneN + plutoN + mercuryN;
console.log('entries', total, '(expected 115)');
if (total !== 115) process.exit(1);

// Count field operations
const synReplace = jupiterN + saturnN + uranusN + neptuneN + plutoN; // 100 entries × 2 fields
const selfAdd =
  uranusN + neptuneN + plutoN + mercuryN; // 75 entries × 2 fields (each entry gets core_self + behavioral_self)
console.log('synastry field replacements (approx):', synReplace * 2);
console.log('self field additions (approx):', selfAdd * 2);
