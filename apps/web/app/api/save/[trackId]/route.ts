import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 50; // 50 requests per window

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `save:${ip}`;
  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (current.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((current.resetTime - now) / 1000) };
  }
  
  current.count++;
  return { allowed: true };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { trackId: string } }
) {
  const { trackId } = params;

  // Rate limiting
  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': rateLimit.retryAfter!.toString() } }
    );
  }

  // Check for session (simplified - in production, validate JWT/cookie)
  const authHeader = req.headers.get('authorization');
  const cookieHeader = req.headers.get('cookie');
  
  if (!authHeader && !cookieHeader) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Validate trackId format
  if (!trackId || trackId.length < 3) {
    return NextResponse.json(
      { code: "INVALID_ID", error: 'Invalid track ID' },
      { status: 400 }
    );
  }

  try {
    // Idempotent success response
    const response = {
      saved: true,
      trackId,
      provenance: {
        featuresVersion: "v1",
        modelVersions: {
          text: "fixed",
          audio: "fixed",
          matching: "fixed"
        }
      }
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save track' },
      { status: 500 }
    );
  }
}
