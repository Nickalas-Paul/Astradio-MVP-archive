import https from 'https';
import type { EphemerisSnapshot } from '../contracts';

export async function triggerVideoEncodeJob(
  videoExportKey: string,
  snapshot: EphemerisSnapshot,
  inProcessFallback?: () => Promise<void>,
): Promise<void> {
  const renderApiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;

  if (!renderApiKey || !serviceId) {
    console.warn('[COMPOSE_VIDEO] No RENDER_API_KEY; falling back to in-process encode');
    if (inProcessFallback) {
      await inProcessFallback();
      return;
    }
    throw new Error('RENDER_API_KEY or RENDER_SERVICE_ID not configured and no fallback provided');
  }

  const snapshotB64 = Buffer.from(JSON.stringify(snapshot)).toString('base64');
  const startCommand = `node dist/vnext/vnext/scripts/encode-video-job.js ${videoExportKey} ${snapshotB64}`;
  const body = JSON.stringify({ startCommand });

  await new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.render.com',
        path: `/v1/services/${serviceId}/jobs`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${renderApiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[COMPOSE_VIDEO] Job triggered: ${videoExportKey}`);
            resolve();
            return;
          }
          reject(new Error(`Render API ${res.statusCode}: ${data}`));
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
