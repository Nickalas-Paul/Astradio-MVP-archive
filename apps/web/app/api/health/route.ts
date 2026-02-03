import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.2.0',
      services: {
        api: 'ok',
        compose: 'ok',
        geocode: 'ok',
        wheel: 'ok'
      }
    };

    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'error', 
        timestamp: new Date().toISOString(),
        error: error.message 
      }, 
      { status: 500 }
    );
  }
}
