import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Proxy to Express geocode endpoint
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
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
    return NextResponse.json(data);
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
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
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
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Geocode] Error:', error.message);
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Geocoding timeout' }, { status: 504 });
    }
    
    return NextResponse.json({ error: 'Geocoding service error' }, { status: 500 });
  }
}
