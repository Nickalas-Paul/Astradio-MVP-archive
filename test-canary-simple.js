// Simple canary test to verify 10% distribution
const testChart = {
  chartContext: {
    ts: '2024-01-15T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.0060,
    houseSystem: 'placidus',
    planets: [
      {name: 'sun', lon: 285.5},
      {name: 'moon', lon: 45.2},
      {name: 'mercury', lon: 270.1},
      {name: 'venus', lon: 300.8},
      {name: 'mars', lon: 120.3},
      {name: 'jupiter', lon: 15.7},
      {name: 'saturn', lon: 90.4},
      {name: 'uranus', lon: 180.9},
      {name: 'neptune', lon: 210.6},
      {name: 'pluto', lon: 240.2}
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [{a: 'sun', b: 'moon', type: 'trine', orb: 2.1}],
    moonPhase: 0.75,
    dominantElements: {fire: 0.3, earth: 0.2, air: 0.25, water: 0.25}
  }
};

async function testCanaryDistribution() {
  console.log('🧪 Testing 10% Canary Distribution');
  console.log('==================================');
  
  const results = { v1: 0, v2: 0, errors: 0 };
  
  // Test 20 requests to check distribution
  for (let i = 0; i < 20; i++) {
    try {
      const response = await fetch('http://localhost:3000/api/vnext/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testChart)
      });
      
      const data = await response.json();
      
      if (data.ok) {
        const modelVersion = data.modelVersion || 'v1';
        results[modelVersion]++;
        console.log(`Request ${i + 1}: ${modelVersion.toUpperCase()} | Quality: ${data.quality?.toFixed(3) || 'N/A'}`);
      } else {
        results.errors++;
        console.log(`Request ${i + 1}: Error - ${data.error || 'Unknown'}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      results.errors++;
      console.log(`Request ${i + 1}: Network error - ${error.message}`);
    }
  }
  
  console.log('\n📊 CANARY DISTRIBUTION RESULTS:');
  console.log(`  V1 requests: ${results.v1} (${(results.v1/20*100).toFixed(1)}%)`);
  console.log(`  V2 requests: ${results.v2} (${(results.v2/20*100).toFixed(1)}%)`);
  console.log(`  Errors: ${results.errors} (${(results.errors/20*100).toFixed(1)}%)`);
  
  // Check if canary is working (should be ~10% V2)
  const v2Percentage = results.v2 / 20 * 100;
  if (v2Percentage >= 5 && v2Percentage <= 20) {
    console.log('✅ Canary deployment working correctly!');
  } else if (v2Percentage === 0) {
    console.log('⚠️ No V2 requests detected - canary may not be active');
  } else {
    console.log('⚠️ Unexpected distribution - check canary configuration');
  }
  
  console.log('\n🎯 Expected: ~10% V2, ~90% V1');
  console.log(`🎯 Actual: ${v2Percentage.toFixed(1)}% V2, ${(100-v2Percentage).toFixed(1)}% V1`);
}

testCanaryDistribution().catch(console.error);
