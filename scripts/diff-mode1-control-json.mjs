/**
 * One-off verification: compare Mode 1 postSynastry in committed JSONs.
 * Run: node scripts/diff-mode1-control-json.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readJsonDoc(rel) {
  const p = path.join(root, rel);
  const buf = fs.readFileSync(p);
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    const s = buf.slice(2).toString('utf16le').replace(/^\uFEFF/, '');
    return JSON.parse(s);
  }
  return JSON.parse(buf.toString('utf8'));
}

const m1 = readJsonDoc('docs/SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json');
const m2 = readJsonDoc('docs/SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json');

const map1 = Object.fromEntries(m1.fixtures.map((f) => [f.fixture, f.postSynastry]));
const ctrl = m2.mode1ComparisonPostSynastryControl;

let allMatch = true;
for (const row of ctrl) {
  const a = row.postSynastry;
  const b = map1[row.fixture];
  if (!b) {
    console.error('Missing Mode1 fixture:', row.fixture);
    allMatch = false;
    continue;
  }
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) {
    console.log(row.fixture + ': OK (identical JSON)');
  } else {
    allMatch = false;
    console.log(row.fixture + ': MISMATCH');
    if (sa.length !== sb.length) {
      console.log('  string length', sa.length, 'vs', sb.length);
    }
    const min = Math.min(sa.length, sb.length);
    let i = 0;
    for (; i < min; i++) {
      if (sa[i] !== sb[i]) break;
    }
    console.log('  first char index', i);
    console.log('  control sample:', JSON.stringify(sa.slice(i, i + 120)));
    console.log('  mode1 sample: ', JSON.stringify(sb.slice(i, i + 120)));
  }
}

process.exit(allMatch ? 0 : 1);
