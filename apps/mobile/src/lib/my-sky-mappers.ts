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
  if (value === 'sky') return "Today's Sky";
  return value ? value.replace(/_/g, ' ') : 'Saved reading';
}

function parseSandboxState(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function formatChartNameList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function chartNamesFromRow(row: LibraryCompositionRow): string[] {
  const names: string[] = [];
  const ps = parseSandboxState(row.sandbox_state);
  const compositionInput = ps?.composition_input;
  if (compositionInput && typeof compositionInput === 'object' && !Array.isArray(compositionInput)) {
    const slots = (compositionInput as { slots?: unknown }).slots;
    if (Array.isArray(slots)) {
      for (const slot of slots) {
        if (!slot || typeof slot !== 'object' || Array.isArray(slot)) continue;
        const displayName = (slot as { chart_display_name?: unknown }).chart_display_name;
        if (typeof displayName === 'string' && displayName.trim()) {
          names.push(displayName.trim());
        }
      }
    }
  }
  return names;
}

function libraryChartDetailSuffix(row: LibraryCompositionRow): string {
  const compositionType = String(row.composition_type ?? '').trim();
  if (compositionType === 'A') return '';

  const names = chartNamesFromRow(row);
  if (names.length > 0) {
    return ` · ${formatChartNameList(names)}`;
  }

  if (compositionType === 'A+B') return ' · 2 charts';
  if (compositionType === 'A+B+N') {
    const source = String(row.source ?? '').trim();
    if (source === 'community_group') return ' · Group reading';
    return ' · 3 charts';
  }

  return '';
}

function formatLibraryDateValue(value: unknown): string {
  if (value == null || value === '') return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).trim();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function sameCalendarDay(a: unknown, b: unknown): boolean {
  const da = new Date(String(a));
  const db = new Date(String(b));
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function libraryRowSummary(row: LibraryCompositionRow): string {
  const customLabel = String(row.display_label ?? '').trim();
  if (customLabel) return customLabel;

  const source = String(row.source ?? '').trim();
  const ps = parseSandboxState(row.sandbox_state);
  const createdDate = formatLibraryDateValue(row.created_at);

  if (source === 'sky' || ps?.kind === 'sky_summary') {
    const skyDate =
      typeof ps?.date === 'string' && ps.date.trim()
        ? formatLibraryDateValue(ps.date)
        : createdDate;
    return skyDate ? `Today's Sky · ${skyDate}` : "Today's Sky";
  }

  let displayDate = createdDate;
  if (source === 'profile_active' || ps?.kind === 'profile_active') {
    const calendarDate = typeof ps?.calendarDate === 'string' ? ps.calendarDate.trim() : '';
    if (calendarDate && row.created_at != null && !sameCalendarDay(calendarDate, row.created_at)) {
      const transitDate = formatLibraryDateValue(calendarDate);
      if (transitDate) displayDate = transitDate;
    }
  }

  const label = librarySourceLabel(row.source);
  const suffix = libraryChartDetailSuffix(row);
  return [displayDate, label].filter(Boolean).join(' · ') + suffix;
}

export function mapLibraryItems(rows: LibraryCompositionRow[]): MySkyScreenData['libraryItems'] {
  return rows.map((row) => ({
    id: String(row.id),
    title: libraryRowSummary(row) || librarySourceLabel(row.source),
    subtitle: '',
    hasAudio: typeof row.export_id === 'string' && /^[a-f0-9]{64}$/.test(row.export_id),
    exportId: typeof row.export_id === 'string' ? row.export_id : null,
    source: typeof row.source === 'string' ? row.source : undefined,
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
