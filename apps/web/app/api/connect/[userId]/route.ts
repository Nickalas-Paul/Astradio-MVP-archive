import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 50; // 50 requests per window

function checkRateLimit(ip: string, userId?: string): { allowed: boolean; retryAfter?: number; bucket?: string } {
  const now = Date.now();
  
  // Check both IP and user buckets if authenticated
  const buckets = [
    { key: `connect:ip:${ip}`, name: 'IP' }
  ];
  
  if (userId) {
    buckets.push({ key: `connect:user:${userId}`, name: 'User' });
  }
  
  for (const bucket of buckets) {
    const current = rateLimitMap.get(bucket.key);
    
    if (!current || now > current.resetTime) {
      rateLimitMap.set(bucket.key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else if (current.count >= RATE_LIMIT_MAX) {
      return { 
        allowed: false, 
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
        bucket: bucket.name
      };
    } else {
      current.count++;
    }
  }
  
  return { allowed: true };
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function checkCSRF(req: NextRequest): { valid: boolean; error?: string } {
  const origin = req.headers.get('origin');
  const csrfToken = req.headers.get('x-csrf-token');
  const csrfCookie = req.cookies.get('csrf')?.value;
  
  if (!origin || !csrfToken || !csrfCookie) {
    return { valid: false, error: 'Missing CSRF token or origin' };
  }
  
  if (csrfToken !== csrfCookie) {
    return { valid: false, error: 'CSRF token mismatch' };
  }
  
  return { valid: true };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const requestId = req.headers.get('x-request-id') || generateRequestId();
  const { userId } = params;
  const { searchParams } = new URL(req.url);
  const goal = searchParams.get('goal') || undefined;

  // Check for session (simplified - in production, validate JWT/cookie)
  const authHeader = req.headers.get('authorization');
  const cookieHeader = req.headers.get('cookie');
  const isAuthenticated = !!(authHeader || cookieHeader);
  
  if (!isAuthenticated) {
    const response = NextResponse.json(
      { 
        error: { 
          code: 'AUTHENTICATION_REQUIRED', 
          message: 'Authentication required' 
        },
        requestId 
      },
      { status: 401 }
    );
    console.log(`[${requestId}] connect/${userId} - 401 - Authentication required`);
    return response;
  }

  // CSRF protection for authenticated requests
  const csrfCheck = checkCSRF(req);
  if (!csrfCheck.valid) {
    const response = NextResponse.json(
      { 
        error: { 
          code: 'CSRF_FAILED', 
          message: csrfCheck.error || 'Invalid CSRF token' 
        },
        requestId 
      },
      { status: 403 }
    );
    console.log(`[${requestId}] connect/${userId} - 403 - CSRF failed: ${csrfCheck.error}`);
    return response;
  }

  // Rate limiting
  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = checkRateLimit(ip, isAuthenticated ? 'authenticated-user' : undefined);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { 
        error: { 
          code: 'RATE_LIMITED', 
          message: `Too many requests (${rateLimit.bucket} limit exceeded)` 
        },
        requestId 
      },
      { status: 429, headers: { 'Retry-After': rateLimit.retryAfter!.toString() } }
    );
    console.log(`[${requestId}] connect/${userId} - 429 - Rate limited (${rateLimit.bucket})`);
    return response;
  }

  // Validate userId format
  if (!userId || userId.length < 3) {
    const response = NextResponse.json(
      { 
        error: { 
          code: 'INVALID_USER_ID', 
          message: 'Invalid user ID' 
        },
        requestId 
      },
      { status: 400 }
    );
    console.log(`[${requestId}] connect/${userId} - 400 - Invalid user ID`);
    return response;
  }

  try {
    // Idempotent success response
    const response = {
      status: "requested",
      connectionId: `conn_${userId}_${Date.now()}`,
      requestId,
      provenance: {
        featuresVersion: "v1",
        modelVersions: {
          text: "fixed",
          audio: "fixed",
          matching: "fixed"
        }
      }
    };

    console.log(`[${requestId}] connect/${userId} - 200 - Connection requested`);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const response = NextResponse.json(
      { 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to create connection request' 
        },
        requestId 
      },
      { status: 500 }
    );
    console.log(`[${requestId}] connect/${userId} - 500 - Internal error: ${error}`);
    return response;
  }
}
