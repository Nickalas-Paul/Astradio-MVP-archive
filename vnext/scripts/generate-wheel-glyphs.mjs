import fs from 'fs';
import path from 'path';

const GLYPH_DIR = path.resolve('apps/web/src/assets/glyphs');

const PLANET_KEY_TO_FILE = {
  sun: 'sun',
  moon: 'moon',
  mercury: 'mercury',
  venus: 'venus',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
  pluto: 'pluto',
  northNode: 'north-node',
  northnode: 'north-node',
  north_node: 'north-node',
  southNode: 'south-node',
  southnode: 'south-node',
  south_node: 'south-node',
  chiron: 'chiron',
  ceres: 'ceres',
  pallas: 'pallas',
  juno: 'juno',
  vesta: 'vesta',
  ascendant: 'ascendant',
  midheaven: 'midheaven',
  mc: 'midheaven',
};

const SIGN_FILES = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

function readGlyph(fileStem) {
  const filePath = path.join(GLYPH_DIR, `${fileStem}.svg`);
  const content = fs.readFileSync(filePath, 'utf8');
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  const pathMatch = content.match(/<path[^>]*\sd="([^"]+)"/);
  if (!viewBoxMatch || !pathMatch) {
    throw new Error(`Missing viewBox or path in ${filePath}`);
  }
  return { pathData: pathMatch[1], viewBox: viewBoxMatch[1] };
}

function escapeString(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildPlanetMap() {
  const uniqueFiles = [...new Set(Object.values(PLANET_KEY_TO_FILE))];
  const byFile = {};
  for (const file of uniqueFiles) {
    byFile[file] = readGlyph(file);
  }
  const map = {};
  for (const [key, file] of Object.entries(PLANET_KEY_TO_FILE)) {
    map[key] = byFile[file];
  }
  return map;
}

function buildSignMap() {
  const map = {};
  SIGN_FILES.forEach((file, index) => {
    map[index] = readGlyph(file);
  });
  return map;
}

function renderGlyphData(name, data) {
  return `const ${name}: GlyphData = {\n  pathData: '${escapeString(data.pathData)}',\n  viewBox: '${data.viewBox}',\n};`;
}

function renderPlanetEntries() {
  const uniqueFiles = [...new Set(Object.values(PLANET_KEY_TO_FILE))];
  const byFile = {};
  for (const file of uniqueFiles) {
    byFile[file] = readGlyph(file);
  }

  const fileConsts = uniqueFiles
    .map((file) => renderGlyphData(`GLYPH_${file.replace(/-/g, '_').toUpperCase()}`, byFile[file]))
    .join('\n\n');

  const lookupEntries = Object.entries(PLANET_KEY_TO_FILE)
    .map(([key, file]) => `  ${JSON.stringify(key)}: GLYPH_${file.replace(/-/g, '_').toUpperCase()},`)
    .join('\n');

  return `${fileConsts}\n\nconst PLANET_GLYPH_MAP: Record<string, GlyphData> = {\n${lookupEntries}\n};`;
}

function renderSignEntries(map) {
  const fileConsts = SIGN_FILES.map((file, index) =>
    renderGlyphData(`GLYPH_SIGN_${file.toUpperCase()}`, map[index])
  ).join('\n\n');

  const lookupEntries = SIGN_FILES.map(
    (file, index) => `  ${index}: GLYPH_SIGN_${file.toUpperCase()},`
  ).join('\n');

  return `${fileConsts}\n\nconst SIGN_GLYPH_MAP: Record<number, GlyphData> = {\n${lookupEntries}\n};`;
}

function generateWebFile() {
  const signMap = buildSignMap();

  return `/** Inline SVG path data for wheel glyph rendering. Generated from apps/web/src/assets/glyphs/. */

export type GlyphData = {
  pathData: string;
  viewBox: string;
};

${renderPlanetEntries()}

${renderSignEntries(signMap)}

function normalizePlanetKey(bodyKey: string): string {
  const trimmed = bodyKey.trim();
  const lower = trimmed.toLowerCase().replace(/\\s+/g, '');
  const aliases: Record<string, string> = {
    northnode: 'northNode',
    north_node: 'northNode',
    southnode: 'southNode',
    south_node: 'southNode',
  };
  if (aliases[lower]) return aliases[lower];
  if (lower in PLANET_GLYPH_MAP) return lower;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

export function getPlanetGlyphSvg(bodyKey: string): GlyphData | null {
  const key = normalizePlanetKey(bodyKey);
  return PLANET_GLYPH_MAP[key] ?? null;
}

export function getSignGlyphSvg(signIndex: number): GlyphData | null {
  if (!Number.isInteger(signIndex) || signIndex < 0 || signIndex > 11) return null;
  return SIGN_GLYPH_MAP[signIndex] ?? null;
}
`;
}

function generateMobileFile() {
  const signMap = buildSignMap();

  return `/** Inline SVG path data for wheel glyph rendering. Generated from apps/mobile/src/assets/glyphs/. */

export type GlyphData = {
  pathData: string;
  viewBox: string;
};

${renderPlanetEntries()}

${renderSignEntries(signMap)}

function normalizePlanetKey(bodyKey: string): string {
  const trimmed = bodyKey.trim();
  const lower = trimmed.toLowerCase().replace(/\\s+/g, '');
  const aliases: Record<string, string> = {
    northnode: 'northNode',
    north_node: 'northNode',
    southnode: 'southNode',
    south_node: 'southNode',
  };
  if (aliases[lower]) return aliases[lower];
  if (lower in PLANET_GLYPH_MAP) return lower;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

export function getPlanetGlyphPath(bodyKey: string): GlyphData | null {
  const key = normalizePlanetKey(bodyKey);
  return PLANET_GLYPH_MAP[key] ?? null;
}

export function getSignGlyphPath(signIndex: number): GlyphData | null {
  if (!Number.isInteger(signIndex) || signIndex < 0 || signIndex > 11) return null;
  return SIGN_GLYPH_MAP[signIndex] ?? null;
}
`;
}

fs.writeFileSync(
  path.resolve('apps/web/src/components/wheel/wheel-glyphs.ts'),
  generateWebFile(),
  'utf8'
);
fs.writeFileSync(
  path.resolve('apps/mobile/src/constants/wheel-glyphs.ts'),
  generateMobileFile(),
  'utf8'
);

console.log('Generated wheel-glyphs.ts for web and mobile');
