// Shared API contracts between frontend and backend

export interface ComposeRequest {
  date?: string;
  time?: string;
  location?: string;
  geo?: {
    lat: number;
    lon: number;
  } | null;
}

export interface ComposeResponse {
  hash: string;
  controlSurface: {
    date: string;
    time: string;
    location: string;
    geo?: {
      lat: number;
      lon: number;
    } | null;
    positions: Record<string, number>;
    houses: number[];
    asc: number;
  };
  audio: {
    url: string | null;
    digest: string;
  };
  explanation: {
    text: string;
  };
  viz: {
    digest: string;
  };
}

export interface GeocodeRequest {
  q: string;
}

export interface GeocodeItem {
  label: string;
  lat: number;
  lon: number;
}

export interface GeocodeResponse extends Array<GeocodeItem> {}

export interface IpGeoResponse {
  lat: number | null;
  lon: number | null;
  city: string;
  country: string | null;
}

export interface PlanetPosition {
  id: string;
  longitude: number;
}

export interface WheelSnapshot {
  planets: PlanetPosition[];
  houses: number[];
  asc: number;
}

export interface ChartData {
  positions?: Record<string, number>;
  planets?: PlanetPosition[];
  houses?: number[];
  cusps?: number[];
  asc?: number;
}

// Error response format
export interface ApiError {
  error: string;
  message?: string;
  requestId?: string;
}
