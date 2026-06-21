import { extractTransitPlanetFromLine } from '../components/shared/PlanetText';
import {
  activationHeatLevel,
  computeActivationThresholds,
} from './activation-heat';
import type { EphemerisSnapshot } from '../types/my-sky';
import type {
  ActiveStateResponse,
  CanonicalLocation,
  ComposeLikeResponse,
  ExplanationSection,
  ProfilePrimaryChart,
  ProfileResponse,
  RelationalFeedActivationLine,
  RelationalFeedItem,
  RelationalFeedResponse,
  TodayComposeContext,
  TodayRelationalWeatherCard,
  TodayScreenData,
  TodayTransitCard,
  TodayTransitHashes,
} from '../types/today';

const ROLE_LABELS: Record<string, string> = {
  you_bring: "What You're Bringing",
  they_bring: "What They're Bringing",
  tests_both: "What's Testing You Both",
};

export function resolveNowInTimezone(timezone: string): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  const hour = pick('hour');
  const minute = pick('minute');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour || '00'}:${minute || '00'}`,
  };
}

export function buildLocationFromChart(chart: ProfilePrimaryChart): CanonicalLocation {
  return {
    source: 'geofinder',
    label: chart.label?.trim() || 'Birth location',
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone?.trim() || 'UTC',
    resolvedAt: new Date().toISOString(),
  };
}

export function buildFeedTransit(chart: ProfilePrimaryChart) {
  const timezone = chart.timezone?.trim() || 'UTC';
  const { date, time } = resolveNowInTimezone(timezone);
  return {
    date,
    time,
    lat: chart.lat,
    lon: chart.lon,
    timezone,
  };
}

function sectionId(section: ExplanationSection): string {
  return String(section.sectionId ?? section.id ?? '');
}

function extractSkySummary(payload: ComposeLikeResponse): string {
  const explanation = payload.explanation;
  if (typeof explanation?.text === 'string' && explanation.text.trim()) {
    return explanation.text.trim();
  }

  const sections = explanation?.sections ?? [];
  const summaryParts = sections
    .map((section) => (typeof section.text === 'string' ? section.text.trim() : ''))
    .filter(Boolean)
    .slice(0, 2);

  if (summaryParts.length > 0) {
    return summaryParts.join('\n\n');
  }

  return '';
}

function transitMetadata(section: ExplanationSection): string | undefined {
  const curation = section.meta?.transitCuration;
  if (curation?.aspectKeys?.length) {
    return curation.aspectKeys.join(' · ');
  }
  const bodies = [...(curation?.natalBodies ?? []), ...(curation?.transitBodies ?? [])];
  if (bodies.length) {
    return bodies.join(' · ');
  }
  if (section.meta?.aspectKeys?.length) {
    return section.meta.aspectKeys.join(' · ');
  }
  return undefined;
}

export function mapActiveTransits(payload: ActiveStateResponse): TodayTransitCard[] {
  const sections = payload.explanation?.sections ?? [];
  const transitSections = sections.filter((section) => {
    const id = sectionId(section);
    if (section.meta?.transitCuration) return true;
    return id === 'relational_weather_v1' || id === 'significance' || id === 'aspects';
  });

  const mapped: TodayTransitCard[] = [];
  transitSections.forEach((section, index) => {
    const title = section.title?.trim() || sectionId(section) || 'Active transit';
    const description = section.text?.trim() || '';
    if (!description) return;
    mapped.push({
      id: `${sectionId(section) || 'transit'}-${index}`,
      title,
      description,
      metadata: transitMetadata(section),
    });
  });
  return mapped;
}

function activationDescription(line: RelationalFeedActivationLine): string {
  if (typeof line.expanded_text === 'string' && line.expanded_text.trim()) {
    return line.expanded_text.trim();
  }
  const dot = line.text.indexOf('. ');
  if (dot > 0) {
    return line.text.slice(dot + 2).trim();
  }
  return line.text.trim();
}

export function mapRelationalWeather(payload: RelationalFeedResponse | null): TodayRelationalWeatherCard[] {
  if (!payload?.items?.length) return [];

  const scores = payload.items.map(
    (item) => Math.max(0, Math.min(1, item.ranking?.activation_effective ?? 0))
  );
  const { highThreshold, mildThreshold } = computeActivationThresholds(scores);

  return payload.items
    .map((item) => mapRelationalFeedItem(item, highThreshold, mildThreshold))
    .filter((item): item is TodayRelationalWeatherCard => item !== null);
}

function mapRelationalFeedItem(
  item: RelationalFeedItem,
  highThreshold: number,
  mildThreshold: number
): TodayRelationalWeatherCard | null {
  const display = item.collapsed_display;
  const lines = display?.activation_lines ?? [];
  if (!lines.length) return null;

  const connectionName =
    display?.enhanced_title?.trim() ||
    item.connection_identity_line?.trim() ||
    'Connection';

  const activationEffective = Math.max(0, Math.min(1, item.ranking?.activation_effective ?? 0));
  const heatLevel = activationHeatLevel(activationEffective, highThreshold, mildThreshold);

  const mappedLines = lines
    .map((line) => {
      const description = activationDescription(line);
      if (!description) return null;
      const role = line.role ?? 'active';
      const prefix = line.prefix?.trim() ?? '';
      const transitPlanet = extractTransitPlanetFromLine(prefix || line.text);
      return {
        role,
        label: ROLE_LABELS[role] ?? 'Active today',
        prefix,
        description,
        transitPlanet,
      };
    })
    .filter((line): line is TodayRelationalWeatherCard['lines'][number] => line !== null);

  if (!mappedLines.length) return null;

  return {
    id: item.feed_item_id,
    connectionName,
    activationEffective,
    heatLevel,
    microTag: display?.micro_tag?.trim() || undefined,
    lines: mappedLines,
  };
}

export function resolveAudioExportId(
  activeState: ActiveStateResponse | null,
  skyCompose: ComposeLikeResponse | null
): { exportId: string | null; available: boolean } {
  const candidates = [activeState, skyCompose];
  for (const payload of candidates) {
    if (!payload) continue;
    const exportId =
      (typeof payload.export_id === 'string' && payload.export_id) ||
      (typeof payload.audio?.export_id === 'string' && payload.audio.export_id) ||
      null;
    if (exportId) {
      return { exportId, available: true };
    }
    if (payload.audio_export_available) {
      return { exportId: null, available: true };
    }
  }
  return { exportId: null, available: false };
}

function parseSnapshotFingerprint(raw: unknown): EphemerisSnapshot | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as EphemerisSnapshot;
  } catch {
    return null;
  }
}

function parseIdentitySnapshots(activeState: ActiveStateResponse | null): {
  natal: EphemerisSnapshot | null;
  transit: EphemerisSnapshot | null;
} {
  const identity = activeState?.identity;
  if (!identity || typeof identity !== 'object') {
    return { natal: null, transit: null };
  }
  const record = identity as Record<string, unknown>;
  return {
    natal: parseSnapshotFingerprint(record.natal_snapshot_fingerprint),
    transit: parseSnapshotFingerprint(record.transit_snapshot_fingerprint),
  };
}

export function exportIdFromComposePayload(payload: Record<string, unknown>): string | null {
  const audio = payload.audio as Record<string, unknown> | undefined;
  const exportId = (payload.export_id ?? audio?.export_id) as string | undefined;
  if (typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId)) {
    return exportId;
  }
  return null;
}

export function extractTransitHashes(activeState: ActiveStateResponse | null): TodayTransitHashes {
  if (!activeState) return null;
  const plan = activeState.hashes?.plan_sha256;
  const oid = activeState.explanation?.meta?.canonical_object_hash;
  if (typeof plan === 'string' && plan.trim() && typeof oid === 'string' && oid.trim()) {
    return {
      expectedPlanSha256: plan.trim(),
      expectedObjectIdentityHash: oid.trim(),
    };
  }
  return null;
}

export function buildSkyComposeRequestBody(
  date: string,
  time: string,
  location: CanonicalLocation,
  generateAudio = false
) {
  const timeNorm = time.length === 5 ? time : time.slice(0, 5);
  return {
    mode: 'sky' as const,
    skyParams: {
      latitude: location.lat,
      longitude: location.lon,
      datetime: `${date}T${timeNorm}:00`,
      timezone: location.timezone,
    },
    locationMeta: location,
    generateAudio,
  };
}

export function buildTodayScreenData(input: {
  skyCompose: ComposeLikeResponse | null;
  activeState: ActiveStateResponse | null;
  relationalFeed: RelationalFeedResponse | null;
  skySnapshot: EphemerisSnapshot | null;
  composeContext: TodayComposeContext | null;
}): TodayScreenData {
  const { exportId, available } = resolveAudioExportId(input.activeState, input.skyCompose);
  const { natal, transit } = parseIdentitySnapshots(input.activeState);
  return {
    skySummary: input.skyCompose ? extractSkySummary(input.skyCompose) : '',
    transits: input.activeState ? mapActiveTransits(input.activeState) : [],
    relationalWeather: mapRelationalWeather(input.relationalFeed),
    audioExportId: exportId,
    audioAvailable: available,
    composeContext: input.composeContext,
    transitHashes: extractTransitHashes(input.activeState),
    skySnapshot: input.skySnapshot,
    natalSnapshot: natal,
    transitSnapshot: transit,
  };
}

export type { ProfileResponse };
