import { NextResponse } from 'next/server';

/**
 * GET /api/reverse-geocode?lat=&lon=
 * Returns a human-readable label for coordinates (e.g. "City, Region, Country").
 * Used by the composer UI to display location; compose pipeline continues to use lat/lon.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const latNum = lat != null ? parseFloat(lat) : NaN;
    const lonNum = lon != null ? parseFloat(lon) : NaN;
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
    }
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Astradio/1.0 (astradio.io; contact: support@astradio.io)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const fallback = `${latNum.toFixed(2)}, ${lonNum.toFixed(2)}`;
      return NextResponse.json({ label: fallback, city: null, region: null, country: null });
    }
    const j = await response.json();
    const displayName = j?.display_name ?? '';
    const parts = displayName ? displayName.split(',').slice(0, 3).join(',').trim() : '';
    const label = parts || `${latNum.toFixed(2)}, ${lonNum.toFixed(2)}`;
    const addr = j?.address ?? {};
    return NextResponse.json({
      label,
      city: addr.city ?? addr.town ?? addr.village ?? null,
      region: addr.state ?? addr.region ?? null,
      country: addr.country ?? null,
    });
  } catch (e: unknown) {
    const lat = new URL(req.url).searchParams.get('lat');
    const lon = new URL(req.url).searchParams.get('lon');
    const latNum = lat != null ? parseFloat(lat) : NaN;
    const lonNum = lon != null ? parseFloat(lon) : NaN;
    const fallback = Number.isFinite(latNum) && Number.isFinite(lonNum)
      ? `${latNum.toFixed(2)}, ${lonNum.toFixed(2)}`
      : '';
    return NextResponse.json({ label: fallback, error: (e as Error).message }, { status: 200 });
  }
}
