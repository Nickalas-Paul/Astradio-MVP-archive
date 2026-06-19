import { api } from './api';
import {
  buildFeedTransit,
  buildLocationFromChart,
  buildSkyComposeRequestBody,
  buildTodayScreenData,
  resolveNowInTimezone,
  type ProfileResponse,
} from './today-mappers';
import type {
  ActiveStateResponse,
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
 *
 * POST /api/profile/active-state does NOT accept an empty body.
 */
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

  let skyCompose: ComposeLikeResponse | null = null;
  try {
    skyCompose = await api<ComposeLikeResponse>('/api/compose', {
      method: 'POST',
      body: JSON.stringify(
        buildSkyComposeRequestBody(date, time, location, false)
      ),
    });
  } catch {
    skyCompose = null;
  }

  let activeState: ActiveStateResponse | null = null;
  const activeStateBody = {
    chartId: chart.id,
    calendarDate: date,
    localTime: time,
    location,
    generateAudio: false,
  };
  try {
    activeState = await api<ActiveStateResponse>('/api/profile/active-state', {
      method: 'POST',
      body: JSON.stringify(activeStateBody),
    });
  } catch {
    activeState = await api<ActiveStateResponse>('/api/profile/active-state', {
      method: 'POST',
      body: JSON.stringify({ ...activeStateBody, userId }),
    });
  }

  let relationalFeed: RelationalFeedResponse | null = null;
  try {
    relationalFeed = await api<RelationalFeedResponse>('/api/community/relational-feed', {
      method: 'POST',
      body: JSON.stringify({ transit: feedTransit }),
    });
  } catch {
    try {
      relationalFeed = await api<RelationalFeedResponse>('/api/community/relational-feed', {
        method: 'POST',
        body: JSON.stringify({ transit: feedTransit, userId }),
      });
    } catch {
      relationalFeed = null;
    }
  }

  return buildTodayScreenData({ skyCompose, activeState, relationalFeed });
}
