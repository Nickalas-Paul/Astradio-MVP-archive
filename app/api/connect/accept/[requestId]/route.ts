import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const { requestId } = params;

  // Check for session (simplified - in production, validate JWT/cookie)
  const authHeader = req.headers.get('authorization');
  const cookieHeader = req.headers.get('cookie');
  
  if (!authHeader && !cookieHeader) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Validate requestId format
  if (!requestId || requestId.length < 3) {
    return NextResponse.json(
      { code: "INVALID_ID", error: 'Invalid request ID' },
      { status: 400 }
    );
  }

  try {
    // Idempotent success response
    const response = {
      status: "accepted",
      connectionId: `conn_${requestId}_${Date.now()}`,
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
      { error: 'Failed to accept connection request' },
      { status: 500 }
    );
  }
}
