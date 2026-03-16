export type LocationSource = 'browser_geo' | 'geofinder';

export type CanonicalLocation = {
  source: LocationSource;
  label: string;
  lat: number;
  lon: number;
  timezone: string;
  resolvedAt: string;
};

export type GeoPermissionStatus = 'unknown' | 'granted' | 'denied' | 'unavailable';

