#!/usr/bin/env node
// Smoke test script for server health checks

const http = require('http');

const endpoints = [
  { path: '/health', expectedStatus: 200 },
  { path: '/api/chart?date=1990-01-01&time=12:00&lat=40.7128&lon=-74.0060', expectedStatus: 200 },
  { path: '/api/compose', method: 'POST', body: JSON.stringify({
    controlSurface: { date: '1990-01-01', time: '12:00', lat: 40.7128, lon: -74.0060 },
    seed: 424242
  }), expectedStatus: 200 }
];

async function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint.path,
      method: endpoint.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': endpoint.body ? Buffer.byteLength(endpoint.body) : 0
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === endpoint.expectedStatus) {
          console.log(`✅ ${endpoint.path} - ${res.statusCode}`);
          resolve({ success: true, status: res.statusCode, data });
        } else {
          console.log(`❌ ${endpoint.path} - Expected ${endpoint.expectedStatus}, got ${res.statusCode}`);
          reject(new Error(`Status mismatch: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${endpoint.path} - Connection error: ${err.message}`);
      reject(err);
    });

    if (endpoint.body) {
      req.write(endpoint.body);
    }
    req.end();
  });
}

async function runSmokeTest() {
  console.log('🚀 Starting smoke test...');
  
  try {
    for (const endpoint of endpoints) {
      await testEndpoint(endpoint);
    }
    console.log('✅ All smoke tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Smoke test failed:', error.message);
    process.exit(1);
  }
}

runSmokeTest();
