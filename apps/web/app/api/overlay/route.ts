import { NextRequest, NextResponse } from 'next/server';

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || generateRequestId();
  
  // Return 410 Gone for deprecated endpoint
  const response = NextResponse.json(
    { 
      error: { 
        code: 'ENDPOINT_DEPRECATED', 
        message: 'This endpoint has been deprecated and will be removed in a future release' 
      },
      requestId 
    },
    { status: 410 }
  );
  
  console.log(`[${requestId}] overlay - 410 - Endpoint deprecated`);
  return response;
}


