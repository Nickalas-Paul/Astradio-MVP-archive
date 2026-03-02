/**
 * Diagnostic: Sandbox 404 — determine which layer returns 404.
 * POSTs to Next (3000) and Engine (4000) with minimal valid body.
 */

const BODY = JSON.stringify({
  birth: { date: '1990-01-15', time: '12:00', lat: 40.7128, lon: -74.006 },
  overrides: { planets: {} },
});

const URLS = [
  'http://localhost:3000/api/sandbox/snapshot',
  'http://localhost:3000/api/sandbox/report',
  'http://localhost:4000/api/sandbox/snapshot',
  'http://localhost:4000/api/sandbox/report',
];

async function fetchUrl(url: string): Promise<{ status: number; body: string }> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: BODY,
    });
    const text = await r.text();
    const bodyPreview = text.length > 200 ? text.slice(0, 200) + '...' : text;
    return { status: r.status, body: bodyPreview };
  } catch (e) {
    return { status: -1, body: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  console.log('=== Sandbox 404 diagnostic ===');
  console.log('POST body:', BODY);
  console.log('');

  for (const url of URLS) {
    const { status, body } = await fetchUrl(url);
    const statusStr = status === -1 ? 'ERR' : String(status);
    console.log(`URL=${url}`);
    console.log(`STATUS=${statusStr}`);
    console.log(`BODY=${body.replace(/\n/g, ' ')}`);
    console.log('');
  }
}

main();

export {};
