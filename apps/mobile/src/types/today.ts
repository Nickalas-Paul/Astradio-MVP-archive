import type { EphemerisSnapshot } from './my-sky';

export type CanonicalLocation = {
  source: 'browser_geo' | 'geofinder';
  label: string;
  lat: number;
  lon: number;
  timezone: string;
  resolvedAt: string;
};

export type ProfilePrimaryChart = {
  id: string;
  label?: string;
  date?: string;
  time?: string;
  lat: number;
  lon: number;
  timezone?: string;
};

export type ProfileResponse = {
  user: {
    id: string;
    displayName: string;
    handle?: string;
  };
  primaryChart: ProfilePrimaryChart | null;
};

export type ExplanationSection = {
  sectionId?: string;
  id?: string;
  title?: string;
  text?: string;
  bullets?: string[];
  meta?: {
    transitCuration?: {
      natalBodies?: string[];
      transitBodies?: string[];
      aspectKeys?: string[];
    };
    planets?: string[];
    aspectKeys?: string[];
  };
};

export type ComposeLikeResponse = {
  explanation?: {
    text?: string;
    sections?: ExplanationSection[];
    meta?: { canonical_object_hash?: string };
  };
  hashes?: { plan_sha256?: string };
  export_id?: string | null;
  audio_export_available?: boolean;
  audio?: { export_id?: string; base64?: string };
};

export type ActiveStateResponse = ComposeLikeResponse & {
  identity?: Record<string, unknown>;
  text?: unknown;
  hashes?: {
    plan_sha256?: string;
    explanation?: string;
    control?: string;
    audio?: string;
  };
};

export type TodayComposeContext = {
  chartId: string;
  date: string;
  time: string;
  location: CanonicalLocation;
};

export type TodayTransitHashes = {
  expectedPlanSha256: string;
  expectedObjectIdentityHash: string;
} | null;

export type RelationalFeedActivationLine = {
  text: string;
  role?: 'you_bring' | 'they_bring' | 'tests_both';
  prefix?: string;
  expanded_text?: string;
};

export type RelationalFeedItem = {
  feed_item_id: string;
  connection_kind: string;
  connection_identity_line?: string;
  collapsed_display?: {
    primary_line?: string;
    enhanced_title?: string;
    micro_tag?: string;
    activation_lines?: RelationalFeedActivationLine[];
  };
  ranking?: {
    weather_activation_intensity?: number;
    activation_effective: number;
    overall_relational_intensity?: number;
  };
};

export type RelationalFeedResponse = {
  version: string;
  items: RelationalFeedItem[];
};

export type TodayTransitCard = {
  id: string;
  title: string;
  description: string;
  metadata?: string;
};

export type TodayRelationalWeatherLine = {
  role: string;
  label: string;
  prefix: string;
  description: string;
  transitPlanet: string | null;
};

export type TodayRelationalWeatherCard = {
  id: string;
  connectionName: string;
  activationEffective: number;
  heatLevel: 'high' | 'active' | 'mild';
  microTag?: string;
  lines: TodayRelationalWeatherLine[];
};

export type TodayScreenData = {
  skySummary: string;
  transits: TodayTransitCard[];
  relationalWeather: TodayRelationalWeatherCard[];
  audioExportId: string | null;
  audioAvailable: boolean;
  composeContext: TodayComposeContext | null;
  transitHashes: TodayTransitHashes;
  skySnapshot: EphemerisSnapshot | null;
  natalSnapshot: EphemerisSnapshot | null;
  transitSnapshot: EphemerisSnapshot | null;
};
