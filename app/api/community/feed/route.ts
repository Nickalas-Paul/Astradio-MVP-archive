import { NextRequest, NextResponse } from 'next/server';
import { SocialAPI } from '../../../src/core/social/mock-api';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 50; // 50 requests per window

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `feed:${ip}`;
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

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { 'Retry-After': rateLimit.retryAfter!.toString() } }
    );
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor') || undefined;
  const since = searchParams.get('since') || undefined;

  try {
    const items = await SocialAPI.getFeed({ cursor, since });
    
    const response = {
      items,
      nextCursor: items.length > 0 ? `cursor_${Date.now()}` : undefined,
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
      { error: 'Failed to fetch community feed' },
      { status: 500 }
    );
  }
}
