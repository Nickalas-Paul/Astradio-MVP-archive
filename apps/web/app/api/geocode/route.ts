import { NextResponse } from 'next/server';
import { getEngineBaseUrl } from '@/lib/engine-base';
import * as tzPack from 'tzlookup';
import {
  isUtcEquivalentChartTimezone,
  isValidIanaTimezone,
} from '../../../../../vnext/compat/chart-timezone-resolve';

function normalizeGeocodeItem(item: Record<string, unknown>): {
  label: string;
  lat: number;
  lon: number;
  timezone: string;
} | null {
  const label = String(item.label ?? item.display_name ?? '');
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  let tzRaw = typeof item.timezone === 'string' ? item.timezone.trim() : '';
  const useClientTz =
    tzRaw.length > 0 && isValidIanaTimezone(tzRaw) && !isUtcEquivalentChartTimezone(tzRaw);

  let timezone = useClientTz ? tzRaw : '';
  if (!timezone) {
    try {
      const derived = tzPack.tzNameAt(lat, lon);
      if (
        derived &&
        typeof derived === 'string' &&
        derived.trim() &&
        isValidIanaTimezone(derived) &&
        !isUtcEquivalentChartTimezone(derived)
      ) {
        timezone = derived.trim();
      }
    } catch {
      return null;
    }
  }
  if (!timezone || !isValidIanaTimezone(timezone) || isUtcEquivalentChartTimezone(timezone)) {
    return null;
  }
  return { label, lat, lon, timezone };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Proxy to Express geocode endpoint
    const backendUrl = getEngineBaseUrl();
    const geocodeUrl = `${backendUrl}/geocode?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'Astradio/1.0 (astradio.io; contact: support@astradio.io)',
        'Accept': 'application/json'
      },
      // Add timeout for geocode requests
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      if (response.status === 503) {
        return NextResponse.json({ error: 'Geocoding service temporarily unavailable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Geocoding failed' }, { status: response.status });
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : [];
    const normalized = items
      .map((item: Record<string, unknown>) => normalizeGeocodeItem(item))
      .filter((x): x is NonNullable<typeof x> => x != null);
    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('[Geocode] Error:', error.message);
    
    // Handle timeout and network errors gracefully
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Geocoding timeout' }, { status: 504 });
    }
    
    return NextResponse.json({ error: 'Geocoding service error' }, { status: 500 });
  }
}

// Also support POST for consistency with frontend expectations
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query } = body;
    
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Convert POST to GET and proxy to Express
    const backendUrl = getEngineBaseUrl();
    const geocodeUrl = `${backendUrl}/geocode?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'Astradio/1.0 (astradio.io; contact: support@astradio.io)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      if (response.status === 503) {
        return NextResponse.json({ error: 'Geocoding service temporarily unavailable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Geocoding failed' }, { status: response.status });
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : [];
    const normalized = items
      .map((item: Record<string, unknown>) => normalizeGeocodeItem(item))
      .filter((x): x is NonNullable<typeof x> => x != null);
    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error('[Geocode] Error:', error.message);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Geocoding timeout' }, { status: 504 });
    }
    
    return NextResponse.json({ error: 'Geocoding service error' }, { status: 500 });
  }
}
