import { ZODIAC_SIGNS } from '../constants/wheel-constants';
import { normalizeChartForWheel } from './chart-adapter';
import type {
  EphemerisSnapshot,
  LibraryCompositionRow,
  MySkyScreenData,
  ProfileChartResponse,
  ProfileChartSection,
  ProfileResponse,
  WheelAspect,
  WheelHouse,
  WheelPlacement,
} from '../types/my-sky';

const SECTION_ORDER = [
  'core_identity',
  'direction_foundation',
  'personal_expression',
  'growth_expansion',
  'evolutionary_currents',
  'aspects',
  'signatures',
  'trait_bridge',
  'synthesis_a',
  'synthesis_b',
  'contradiction_map',
  'audio_thread',
];

const SECTION_TITLES: Record<string, string> = {
  core_identity: 'Core Identity Architecture',
  direction_foundation: 'Direction and Foundation',
  personal_expression: 'Personal Expression',
  growth_expansion: 'Growth and Expansion',
  evolutionary_currents: 'Evolutionary Currents',
  aspects: 'Planetary Relationships',
  signatures: 'Astrology',
};

function normLon(lon: number): number {
  let value = lon % 360;
  if (value < 0) value += 360;
  return value;
}

function lonToSign(lon: number): string {
  return ZODIAC_SIGNS[Math.floor(normLon(lon) / 30) % 12]!;
}

function lonToHouse(lon: number, cusps: number[]): number {
  const x = normLon(lon);
  for (let index = 0; index < 12; index++) {
    const start = normLon(cusps[index]!);
    const end = normLon(cusps[(index + 1) % 12]!);
    const inSegment = start <= end ? x >= start && x < end : x >= start || x < end;
    if (inSegment) return index + 1;
  }
  return 1;
}

function normalizeBodyKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

function bodyLabel(body: string): string {
  const key = normalizeBodyKey(body);
  const labels: Record<string, string> = {
    sun: 'Sun',
    moon: 'Moon',
    mercury: 'Mercury',
    venus: 'Venus',
    mars: 'Mars',
    jupiter: 'Jupiter',
    saturn: 'Saturn',
    uranus: 'Uranus',
    neptune: 'Neptune',
    pluto: 'Pluto',
    northnode: 'North Node',
    north_node: 'North Node',
    chiron: 'Chiron',
  };
  return labels[key] ?? body;
}

export function buildBigThreeSummary(snapshot: EphemerisSnapshot | undefined): string | null {
  const wheel = snapshot ? normalizeChartForWheel(snapshot) : null;
  if (!wheel) return null;

  const sunLon = wheel.positions.sun;
  const moonLon = wheel.positions.moon;
  const ascLon = typeof wheel.asc === 'number' ? wheel.asc : wheel.cusps[0]!;
  if (sunLon == null || moonLon == null) return null;

  return `☉ ${lonToSign(sunLon)} · ☽ ${lonToSign(moonLon)} · ↑ ${lonToSign(ascLon)}`;
}

export function mapSnapshotToWheel(snapshot: EphemerisSnapshot | undefined): MySkyScreenData['wheel'] {
  const wheel = snapshot ? normalizeChartForWheel(snapshot) : null;
  if (!wheel) return null;

  const ascendantLongitude = typeof wheel.asc === 'number' ? wheel.asc : wheel.cusps[0]!;

  const placements: WheelPlacement[] = Object.entries(wheel.positions)
    .map(([body, lon]) => ({
      body: bodyLabel(body),
      sign: lonToSign(lon),
      degree: normLon(lon) % 30,
      house: lonToHouse(lon, wheel.cusps),
      longitude: normLon(lon),
    }))
    .sort((a, b) => a.body.localeCompare(b.body));

  const houses: WheelHouse[] = wheel.cusps.map((degree, index) => ({
    house: index + 1,
    sign: lonToSign(degree),
    degree: normLon(degree) % 30,
  }));

  const aspects: WheelAspect[] = (snapshot?.aspects ?? [])
    .map((aspect) => {
      const body1 = aspect.bodyA ?? aspect.a;
      const body2 = aspect.bodyB ?? aspect.b;
      if (!body1 || !body2) return null;
      return {
        body1: bodyLabel(body1),
        body2: bodyLabel(body2),
        type: String(aspect.type ?? '').toLowerCase(),
        orb: typeof aspect.orb === 'number' ? aspect.orb : 0,
      };
    })
    .filter((aspect): aspect is WheelAspect => aspect !== null)
    .slice(0, 24);

  return { placements, houses, aspects, cusps: wheel.cusps, ascendantLongitude };
}

function sectionSortKey(id: string): number {
  const index = SECTION_ORDER.indexOf(id);
  if (index >= 0) return index;
  const depth = /^depth_panel_(\d+)$/.exec(id);
  if (depth) return SECTION_ORDER.length + parseInt(depth[1]!, 10);
  return 200;
}

export function mapIdentitySections(chart: ProfileChartResponse | null): ProfileChartSection[] {
  const sections = chart?.explainer?.sections ?? [];
  const mapped: ProfileChartSection[] = [];

  for (const section of sections) {
    const id = String(section.sectionId ?? section.id ?? '');
    const text = typeof section.text === 'string' ? section.text.trim() : '';
    if (!text) continue;
    mapped.push({
      id,
      title: SECTION_TITLES[id] ?? (String(section.title ?? '').trim() || id),
      text,
      bullets: Array.isArray(section.bullets) ? section.bullets.map(String) : undefined,
    });
  }

  return mapped.sort((a, b) => sectionSortKey(a.id) - sectionSortKey(b.id));
}

export function resolveIdentityExportId(chart: ProfileChartResponse | null): string | null {
  const candidates = [chart?.identity_export_id, chart?.chart?.identityExportId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^[a-f0-9]{64}$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function librarySourceLabel(source: unknown): string {
  const value = String(source ?? '').trim();
  if (value === 'profile_identity') return 'Identity';
  if (value === 'profile_active') return 'Transit reading';
  if (value === 'community_relational_weather') return 'Connection reading';
  if (value === 'community_relationship') return 'Connection reading';
  if (value === 'community_group') return 'Group reading';
  if (value === 'community_post_audio') return 'Community audio';
  if (value === 'sandbox') return 'Sandbox reading';
  return value ? value.replace(/_/g, ' ') : 'Saved reading';
}

function formatLibraryDate(createdAt: unknown): string {
  if (createdAt == null || createdAt === '') return '';
  const date = new Date(String(createdAt));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function mapLibraryItems(rows: LibraryCompositionRow[]): MySkyScreenData['libraryItems'] {
  return rows.map((row) => ({
    id: String(row.id),
    title: librarySourceLabel(row.source),
    subtitle: formatLibraryDate(row.created_at),
    hasAudio: typeof row.export_id === 'string' && /^[a-f0-9]{64}$/.test(row.export_id),
  }));
}

export function buildMySkyScreenData(input: {
  profile: ProfileResponse;
  chart: ProfileChartResponse | null;
  library: LibraryCompositionRow[];
}): MySkyScreenData {
  const user = input.profile.user!;
  const snapshot = input.chart?.snapshot;

  return {
    user,
    primaryChart: input.profile.primaryChart,
    bigThree: buildBigThreeSummary(snapshot),
    wheel: mapSnapshotToWheel(snapshot),
    identitySections: mapIdentitySections(input.chart),
    identityExportId: resolveIdentityExportId(input.chart),
    libraryItems: mapLibraryItems(input.library),
  };
}
