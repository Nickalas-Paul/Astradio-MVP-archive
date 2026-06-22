import type { SandboxBirth } from '../types/sandbox';

export type HistoricalPreset = {
  id: string;
  label: string;
  category: 'historical' | 'cultural' | 'celestial';
  date: string;
  time: string;
  lat: number;
  lon: number;
  locationLabel: string;
};

export const HISTORICAL_PRESETS: HistoricalPreset[] = [
  {
    id: 'moon-landing',
    label: 'The Moon Landing',
    category: 'historical',
    date: '1969-07-20',
    time: '20:17',
    lat: 28.5721,
    lon: -80.648,
    locationLabel: 'Cape Canaveral, FL',
  },
  {
    id: 'berlin-wall',
    label: 'Fall of the Berlin Wall',
    category: 'historical',
    date: '1989-11-09',
    time: '18:53',
    lat: 52.5163,
    lon: 13.3777,
    locationLabel: 'Berlin, Germany',
  },
  {
    id: 'woodstock',
    label: 'Woodstock Opens',
    category: 'cultural',
    date: '1969-08-15',
    time: '17:07',
    lat: 41.7021,
    lon: -74.8783,
    locationLabel: 'Bethel, NY',
  },
  {
    id: 'titanic-departs',
    label: 'Titanic Departs Southampton',
    category: 'historical',
    date: '1912-04-10',
    time: '12:00',
    lat: 50.8998,
    lon: -1.4044,
    locationLabel: 'Southampton, England',
  },
  {
    id: 'end-of-wwii',
    label: 'End of World War II',
    category: 'historical',
    date: '1945-09-02',
    time: '09:04',
    lat: 35.3533,
    lon: 139.7683,
    locationLabel: 'Tokyo Bay, Japan',
  },
  {
    id: 'first-iphone',
    label: 'First iPhone Announcement',
    category: 'cultural',
    date: '2007-01-09',
    time: '09:41',
    lat: 37.3318,
    lon: -122.0312,
    locationLabel: 'San Francisco, CA',
  },
  {
    id: 'great-conjunction-2020',
    label: 'Great Conjunction 2020',
    category: 'celestial',
    date: '2020-12-21',
    time: '18:20',
    lat: 0,
    lon: 0,
    locationLabel: 'Prime Meridian / Equator',
  },
  {
    id: 'total-eclipse-2024',
    label: 'Total Solar Eclipse 2024',
    category: 'celestial',
    date: '2024-04-08',
    time: '13:42',
    lat: 34.5553,
    lon: -92.3809,
    locationLabel: 'Hot Springs, AR',
  },
];

const PRESET_TIMEZONES: Record<string, string> = {
  'moon-landing': 'America/New_York',
  'berlin-wall': 'Europe/Berlin',
  woodstock: 'America/New_York',
  'titanic-departs': 'Europe/London',
  'end-of-wwii': 'Asia/Tokyo',
  'first-iphone': 'America/Los_Angeles',
  'great-conjunction-2020': 'UTC',
  'total-eclipse-2024': 'America/Chicago',
};

export function historicalPresetToBirth(preset: HistoricalPreset): SandboxBirth {
  const timezone = PRESET_TIMEZONES[preset.id] ?? 'UTC';
  return {
    date: preset.date,
    time: preset.time,
    location: {
      source: 'geofinder',
      label: preset.locationLabel,
      lat: preset.lat,
      lon: preset.lon,
      timezone,
      resolvedAt: new Date().toISOString(),
    },
    houseSystem: 'placidus',
  };
}
