#!/usr/bin/env node

/**
 * Update Render service environment variables via API
 */

const https = require('https');

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'astradio-staging';
const API_BASE = 'https://api.render.com/v1';

if (!RENDER_API_KEY) {
  console.error('❌ RENDER_API_KEY environment variable not set');
  console.error('   Get your API key from: https://dashboard.render.com/account/api-keys');
  process.exit(1);
}

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject(new Error(`API error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function getServiceId() {
  console.log('📡 Fetching services...');
  const response = await makeRequest('GET', '/services');
  
  const service = response.data.find(s => 
    s.service.name === SERVICE_ID || 
    s.service.name.includes('astradio') ||
    s.service.name.includes('staging')
  );
  
  if (!service) {
    console.error(`❌ Service "${SERVICE_ID}" not found`);
    console.error('Available services:', response.data.map(s => s.service.name).join(', '));
    process.exit(1);
  }
  
  return service.service.id;
}

async function updateEnvVar(serviceId, key, value) {
  console.log(`🔧 Updating ${key}=${value}...`);
  
  // Get current env vars
  const envResponse = await makeRequest('GET', `/services/${serviceId}/env-vars`);
  const currentVars = envResponse.data || [];
  
  // Check if variable exists
  const existing = currentVars.find(v => v.envVar.key === key);
  
  if (existing && existing.envVar.value === value) {
    console.log(`✅ ${key} already set to ${value}`);
    return;
  }
  
  if (existing) {
    // Update existing
    await makeRequest('PATCH', `/services/${serviceId}/env-vars/${existing.envVar.id}`, {
      value: value
    });
    console.log(`✅ Updated ${key}=${value}`);
  } else {
    // Create new
    await makeRequest('POST', `/services/${serviceId}/env-vars`, {
      key: key,
      value: value
    });
    console.log(`✅ Created ${key}=${value}`);
  }
}

async function triggerDeploy(serviceId) {
  console.log('🚀 Triggering manual deploy...');
  await makeRequest('POST', `/services/${serviceId}/deploys`);
  console.log('✅ Deploy triggered');
}

async function main() {
  try {
    console.log('🔐 Authenticating with Render API...');
    
    const serviceId = await getServiceId();
    console.log(`✅ Found service ID: ${serviceId}`);
    
    await updateEnvVar(serviceId, 'DEPRECATE_LEGACY_ROUTES', 'false');
    
    console.log('\n✅ Environment variables updated successfully!');
    console.log('   Note: You may need to manually trigger a deploy in the Render dashboard');
    console.log('   or wait for auto-deploy if enabled.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

