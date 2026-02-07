#!/usr/bin/env node
/**
 * Minimal local verification: POST /api/compose with valid JSON;
 * expect 200 and JSON response (not HTML). Exits 0 on success, 1 on failure.
 */
const http = require('http');

const body = JSON.stringify({
  mode: 'sandbox',
  chartData: { date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.006 },
  controls: {}
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/compose',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const isJson = res.headers['content-type'] && res.headers['content-type'].includes('application/json');
    if (res.statusCode !== 200) {
      console.error('FAIL: POST /api/compose returned', res.statusCode, data.slice(0, 200));
      process.exit(1);
    }
    if (!isJson) {
      console.error('FAIL: response is not JSON:', data.slice(0, 100));
      process.exit(1);
    }
    console.log('OK: POST /api/compose returned 200 with JSON');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('FAIL: request error', e.message);
  process.exit(1);
});
req.write(body);
req.end();
