import fs from 'fs';
import path from 'path';

const dir = path.resolve('apps/web/src/assets/glyphs');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
const out = {};

for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  const pathMatch = content.match(/<path[^>]*\sd="([^"]+)"/);
  if (!viewBoxMatch || !pathMatch) {
    console.error('Missing data in', f);
    continue;
  }
  out[f.replace('.svg', '')] = {
    pathData: pathMatch[1],
    viewBox: viewBoxMatch[1],
  };
}

console.log(JSON.stringify(out, null, 2));
