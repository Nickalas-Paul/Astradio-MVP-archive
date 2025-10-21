import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Validate ID format (should be 16-character hex)
    if (!/^[a-f0-9]{16}$/.test(id)) {
      return NextResponse.json(
        { error: 'Invalid export ID format' },
        { status: 400 }
      );
    }

    // Look for the export file in all model versions
    const exportsDir = path.join(process.cwd(), 'exports');
    const modelVersions = ['v2.8', 'v2.7', 'v2.6', 'v2.5', 'v2.4'];
    
    let exportPath = null;
    let metadata = null;
    
    for (const version of modelVersions) {
      const versionDir = path.join(exportsDir, version);
      const filePath = path.join(versionDir, `${id}.mp3`);
      const metadataPath = path.join(versionDir, `${id}.json`);
      
      try {
        await fs.access(filePath);
        exportPath = filePath;
        
        // Try to load metadata
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          metadata = JSON.parse(metadataContent);
        } catch {
          // Metadata not found, continue without it
        }
        
        break;
      } catch {
        // File not found in this version, try next
        continue;
      }
    }

    if (!exportPath) {
      return NextResponse.json(
        { error: 'Export not found' },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = await fs.readFile(exportPath);
    
    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Content-Length', fileBuffer.length.toString());
    headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    
    if (metadata) {
      headers.set('X-Export-Metadata', JSON.stringify(metadata));
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('[EXPORT_FILE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to serve export file' },
      { status: 500 }
    );
  }
}