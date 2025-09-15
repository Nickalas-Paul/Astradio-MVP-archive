// vnext/scripts/smoke.ts
import fs from 'fs';
import path from 'path';

async function smokeTest() {
  try {
    // Load test chartContext from dev asset
    const chartPath = path.join(__dirname, '../../../datasets/dev-chart.json');
    const chartData = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
    
    // POST to vNext endpoint
    const response = await fetch('http://localhost:3000/api/vnext/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartContext: chartData })
    });
    
    const result = await response.json();
    console.log('✅ vNext smoke test result:', {
      ok: result.ok,
      source: result.source,
      eventCount: result.plan?.events?.length || 0,
      durationSec: result.plan?.durationSec || 0
    });
    
    if (!result.ok) {
      console.error('❌ vNext smoke test failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ vNext smoke test error:', error);
    process.exit(1);
  }
}

smokeTest();
