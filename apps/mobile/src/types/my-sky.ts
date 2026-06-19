export type ProfileUser = {
  id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
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
  user: ProfileUser | null;
  primaryChart: ProfilePrimaryChart | null;
};

export type SnapshotPlanet = {
  name: string;
  lon: number;
  lat?: number;
  speed?: number;
};

export type SnapshotAspect = {
  bodyA?: string;
  bodyB?: string;
  a?: string;
  b?: string;
  type: string;
  orb?: number;
};

export type EphemerisSnapshot = {
  planets?: SnapshotPlanet[];
  houses?: number[];
  cusps?: number[];
  positions?: Record<string, number>;
  aspects?: SnapshotAspect[];
  asc?: number;
};

export type ProfileChartSection = {
  id: string;
  title: string;
  text: string;
  bullets?: string[];
};

export type ProfileChartResponse = {
  chart?: ProfilePrimaryChart & { identityExportId?: string | null };
  identity_export_id?: string | null;
  snapshot?: EphemerisSnapshot;
  explainer?: {
    spec?: string;
    sections?: Array<{
      id?: string;
      sectionId?: string;
      title?: string;
      text?: string;
      bullets?: string[];
    }>;
  };
};

export type LibraryCompositionRow = {
  id: string;
  source?: string;
  composition_type?: string;
  export_id?: string | null;
  sandbox_state?: unknown;
  created_at?: string;
  report?: unknown;
};

export type WheelPlacement = {
  body: string;
  sign: string;
  degree: number;
  house: number;
  longitude: number;
};

export type WheelHouse = {
  house: number;
  sign: string;
  degree: number;
};

export type WheelAspect = {
  body1: string;
  body2: string;
  type: string;
  orb: number;
};

export type MySkyScreenData = {
  user: ProfileUser;
  primaryChart: ProfilePrimaryChart | null;
  bigThree: string | null;
  wheel: {
    placements: WheelPlacement[];
    houses: WheelHouse[];
    aspects: WheelAspect[];
    cusps: number[];
    ascendantLongitude: number;
  } | null;
  identitySections: ProfileChartSection[];
  identityExportId: string | null;
  libraryItems: Array<{
    id: string;
    title: string;
    subtitle: string;
    hasAudio: boolean;
  }>;
};
