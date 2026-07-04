import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIELDS } from './patch-batch3-synastry-fields.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../projection/insight-library');

const FILE_KEYS = {
  'insight-library-aspects-mercury.ts': ['SUN_MERCURY_CONJUNCTION'],
  'insight-library-aspects-jupiter.ts': Object.keys(FIELDS).filter((k) => k.startsWith('JUPITER_')),
  'insight-library-aspects-saturn.ts': Object.keys(FIELDS).filter((k) => k.startsWith('SATURN_')),
  'insight-library-aspects-uranus.ts': Object.keys(FIELDS).filter((k) => k.startsWith('URANUS_')),
  'insight-library-aspects-neptune.ts': Object.keys(FIELDS).filter((k) => k.startsWith('NEPTUNE_')),
  'insight-library-aspects-pluto.ts': Object.keys(FIELDS).filter((k) => k.startsWith('PLUTO_')),
};

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function replaceSynastryField(block, field, value) {
  const re = new RegExp(`${field}: \`[^\`]*\`,`);
  if (!re.test(block)) {
    throw new Error(`missing ${field}`);
  }
  return block.replace(re, `${field}: '${esc(value)}',`);
}

function patchFile(fileName, keys) {
  const filePath = path.join(root, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let patched = 0;
  for (const key of keys) {
    const entry = FIELDS[key];
    if (!entry?.friendship_synastry || !entry?.romantic_synastry) {
      throw new Error(`missing data for ${key}`);
    }
    const start = content.indexOf(`${key}:`);
    if (start < 0) throw new Error(`${key} not found in ${fileName}`);
    const end = content.indexOf('\n },', start);
    if (end < 0) throw new Error(`${key} block end not found in ${fileName}`);
    let block = content.slice(start, end);
    block = replaceSynastryField(block, 'friendship_synastry', entry.friendship_synastry);
    block = replaceSynastryField(block, 'romantic_synastry', entry.romantic_synastry);
    content = content.slice(0, start) + block + content.slice(end);
    patched++;
  }
  fs.writeFileSync(filePath, content);
  return patched;
}

let total = 0;
for (const [fileName, keys] of Object.entries(FILE_KEYS)) {
  const n = patchFile(fileName, keys);
  console.log(`${fileName}: ${n}`);
  total += n;
}
console.log(`total: ${total} (expected 101)`);
if (total !== 101) process.exit(1);
