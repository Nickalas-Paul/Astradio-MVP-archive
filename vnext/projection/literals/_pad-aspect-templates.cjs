const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'aspect-behavior-v1.json');
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const suf = 'between chart lines on this timed pass.';
function wc(s) {
  return s.split(/\s+/).filter(Boolean).length;
}
for (const t of Object.keys(j.primary_line_templates)) {
  for (const d of Object.keys(j.primary_line_templates[t])) {
    let s = j.primary_line_templates[t][d];
    s = s.trim();
    if (!s.endsWith(suf)) {
      s = s.replace(/\.\s*$/, '') + ' ' + suf;
    }
    j.primary_line_templates[t][d] = s;
    const w = wc(s.replace('{aspect}', 'Sun opposite Moon'));
    if (w < 12 || w > 22) console.error('bad', t, d, w, s);
  }
}
fs.writeFileSync(p, JSON.stringify(j, null, 2), 'utf8');
console.log('padded');
