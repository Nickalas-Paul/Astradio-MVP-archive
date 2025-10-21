import { NextRequest, NextResponse } from 'next/server';
import { ExportQueue } from '../../../lib/queue/export-queue';
import { generateChartHashSync } from '../../../lib/hash/chartHash';

const exportQueue = new ExportQueue();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { controlSurface, seed, modelVersion = 'v2.8', format = 'mp3', priority = 0 } = body;
    
    // Validate required fields
    if (!controlSurface) {
      return NextResponse.json(
        { error: 'controlSurface is required' },
        { status: 400 }
      );
    }

    // Generate deterministic chart hash for idempotency
    const chartHash = generateChartHashSync(controlSurface);
    const exportHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify({ controlSurface, seed, modelVersion, format }))
      .digest('hex')
      .slice(0, 16);

    // Check if export already exists
    const existingStatus = await exportQueue.getJobStatus(exportHash);
    if (existingStatus && existingStatus.status === 'completed') {
      return NextResponse.json({
        jobId: exportHash,
        status: 'completed',
        result: existingStatus.result
      });
    }

    // Enqueue export job
    const jobId = await exportQueue.enqueue({
      controlSurface,
      seed,
      modelVersion,
      format,
      priority,
      chartHash,
      exportHash
    });

    return NextResponse.json({
      jobId,
      status: 'queued',
      message: 'Export job queued successfully'
    });

  } catch (error) {
    console.error('[EXPORT_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to queue export job' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      );
    }

    const status = await exportQueue.getJobStatus(jobId);
    
    if (!status) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(status);

  } catch (error) {
    console.error('[EXPORT_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
