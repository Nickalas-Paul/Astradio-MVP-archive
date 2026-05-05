/**
 * One-shot: insert core_transit / behavioral_transit from Downloads batch file
 * into insight-library outer-planet aspect entries.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BATCH = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'batch4-outer-planets-transit-additions.ts'
);

function targetFile(key) {
  if (/^URANUS_MERCURY_|^NEPTUNE_MERCURY_|^PLUTO_MERCURY_/.test(key)) {
    return path.join(ROOT, 'vnext/projection/insight-library/insight-library-aspects-mercury.ts');
  }
  if (key.startsWith('URANUS_')) {
    return path.join(ROOT, 'vnext/projection/insight-library/insight-library-aspects-uranus.ts');
  }
  if (key.startsWith('NEPTUNE_')) {
    return path.join(ROOT, 'vnext/projection/insight-library/insight-library-aspects-neptune.ts');
  }
  if (key.startsWith('PLUTO_')) {
    return path.join(ROOT, 'vnext/projection/insight-library/insight-library-aspects-pluto.ts');
  }
  throw new Error(`Unknown key prefix: ${key}`);
}

function parseBatch(content) {
  const entries = [];
  const blockRe =
    /\b(URANUS_(?:SUN|MOON|MERCURY|VENUS|MARS)_[A-Z]+|NEPTUNE_(?:SUN|MOON|MERCURY|VENUS|MARS)_[A-Z]+|PLUTO_(?:SUN|MOON|MERCURY|VENUS|MARS)_[A-Z]+):\s*\{\s*core_transit:\s*`([\s\S]*?)`,\s*behavioral_transit:\s*`([\s\S]*?)`,\s*\}/g;
  let m;
  while ((m = blockRe.exec(content)) !== null) {
    entries.push({
      key: m[1],
      core_transit: m[2],
      behavioral_transit: m[3],
    });
  }
  return entries;
}

function insertIntoEntry(src, key, core, behavioral) {
  const marker = `  ${key}: {`;
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error(`Key block not found: ${key}`);

  const tail = src.slice(idx);
  const romanticIdx = tail.indexOf('romantic_synastry:');
  if (romanticIdx === -1) throw new Error(`romantic_synastry not found in ${key}`);

  const afterRomantic = tail.slice(romanticIdx);
  const closeBacktick = afterRomantic.indexOf('`,');
  if (closeBacktick === -1) throw new Error(`romantic_synastry closing not found: ${key}`);
  const insertPos = idx + romanticIdx + closeBacktick + '`,'.length;

  const injection =
    `\n    core_transit: \`${core}\`,\n    behavioral_transit: \`${behavioral}\`,`;

  if (src.slice(insertPos, insertPos + injection.length).includes('core_transit')) {
    throw new Error(`Already has core_transit after romantic_synastry: ${key}`);
  }

  return src.slice(0, insertPos) + injection + src.slice(insertPos);
}

const batchRaw = fs.readFileSync(BATCH, 'utf8');
const entries = parseBatch(batchRaw);
if (entries.length !== 75) {
  console.error(`Expected 75 entries, got ${entries.length}`);
  process.exit(1);
}

const byFile = new Map();
for (const e of entries) {
  const f = targetFile(e.key);
  if (!byFile.has(f)) byFile.set(f, []);
  byFile.get(f).push(e);
}

for (const [filePath, list] of byFile) {
  let src = fs.readFileSync(filePath, 'utf8');
  for (const e of list) {
    src = insertIntoEntry(src, e.key, e.core_transit, e.behavioral_transit);
  }
  fs.writeFileSync(filePath, src, 'utf8');
  console.log(`Updated ${path.relative(ROOT, filePath)} (${list.length} entries)`);
}

console.log('Done. Total:', entries.length);
