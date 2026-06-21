import { api } from './api';
import {
  buildFeedTransit,
  buildLocationFromChart,
  buildSkyComposeRequestBody,
  buildTodayScreenData,
  resolveNowInTimezone,
  type ProfileResponse,
} from './today-mappers';
import type { EphemerisSnapshot } from '../types/my-sky';
import type {
  ActiveStateResponse,
  CanonicalLocation,
  ComposeLikeResponse,
  RelationalFeedResponse,
  TodayScreenData,
} from '../types/today';

/**
 * Today screen uses three engine endpoints (same as web Today page):
 * 1. GET /api/profile — primary chart + user id
 * 2. POST /api/compose — global sky summary (web: TodaySkySummary)
 * 3. POST /api/profile/active-state — personal overlay transits (requires chartId, date, time, location)
 * 4. POST /api/community/relational-feed — relational weather cards
 * 5. GET /api/chart-snapshot — current sky wheel (web: TodaySkySummary)
 *
 * POST /api/profile/active-state does NOT accept an empty body.
 */
export async function fetchSkySnapshot(
  date: string,
  time: string,
  lat: number,
  lon: number,
  timezone: string
): Promise<EphemerisSnapshot | null> {
  try {
    const params = new URLSearchParams({
      date,
      time,
      lat: String(lat),
      lon: String(lon),
      timezone,
    });
    return await api<EphemerisSnapshot>(`/api/chart-snapshot?${params.toString()}`);
  } catch {
    return null;
  }
}

async function fetchActiveStateWithRetry(
  body: {
    chartId: string;
    calendarDate: string;
    localTime: string;
    location: CanonicalLocation;
    generateAudio: boolean;
  },
  userId: string
): Promise<ActiveStateResponse | null> {
  try {
    return await api<ActiveStateResponse>('/api/profile/active-state', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {
    try {
      return await api<ActiveStateResponse>('/api/profile/active-state', {
        method: 'POST',
        body: JSON.stringify({ ...body, userId }),
      });
    } catch {
      return null;
    }
  }
}

async function fetchRelationalFeedWithRetry(
  feedTransit: ReturnType<typeof buildFeedTransit>,
  userId: string
): Promise<RelationalFeedResponse | null> {
  try {
    return await api<RelationalFeedResponse>('/api/community/relational-feed', {
      method: 'POST',
      body: JSON.stringify({ transit: feedTransit }),
    });
  } catch {
    try {
      return await api<RelationalFeedResponse>('/api/community/relational-feed', {
        method: 'POST',
        body: JSON.stringify({ transit: feedTransit, userId }),
      });
    } catch {
      return null;
    }
  }
}

export async function fetchTodayScreenData(userId: string): Promise<TodayScreenData> {
  const profile = await api<ProfileResponse>('/api/profile');
  const chart = profile.primaryChart;

  if (!chart?.id || typeof chart.lat !== 'number' || typeof chart.lon !== 'number') {
    throw { status: 400, error: 'primary_chart_required' };
  }

  const location = buildLocationFromChart(chart);
  const timezone = chart.timezone?.trim() || 'UTC';
  const { date, time } = resolveNowInTimezone(timezone);
  const feedTransit = buildFeedTransit(chart);

  const activeStateBody = {
    chartId: chart.id,
    calendarDate: date,
    localTime: time,
    location,
    generateAudio: false,
  };

  const [skyCompose, activeState, relationalFeed, skySnapshot] = await Promise.all([
    (async (): Promise<ComposeLikeResponse | null> => {
      try {
        return await api<ComposeLikeResponse>('/api/compose', {
          method: 'POST',
          body: JSON.stringify(buildSkyComposeRequestBody(date, time, location, false)),
        });
      } catch {
        return null;
      }
    })(),
    fetchActiveStateWithRetry(activeStateBody, userId),
    fetchRelationalFeedWithRetry(feedTransit, userId),
    fetchSkySnapshot(date, time, location.lat, location.lon, timezone),
  ]);

  return buildTodayScreenData({
    skyCompose,
    activeState,
    relationalFeed,
    skySnapshot,
    composeContext: {
      chartId: chart.id,
      date,
      time,
      location,
    },
    viewerUserId: userId,
  });
}
