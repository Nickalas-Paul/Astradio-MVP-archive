/**
 * Current user profile (stub V1). Returns user + primary chart reference.
 * No auth; deterministic stub for community profile.
 */
import { NextResponse } from 'next/server';

const STUB_USER = {
  id: 'usr_stub_v1',
  displayName: 'You',
};

const PRIMARY_CHART_ID = 'chart_profile_default';
const STUB_PRIMARY_CHART = {
  id: PRIMARY_CHART_ID,
  label: 'My Natal',
  date: '1990-01-15',
  time: '12:00',
  lat: 40.7128,
  lon: -74.006,
  timezone: undefined as string | undefined,
};

export async function GET() {
  return NextResponse.json({
    user: STUB_USER,
    primaryChart: STUB_PRIMARY_CHART,
  });
}
