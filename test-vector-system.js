/**
 * Test script for vector-based system
 * Run with: node test-vector-system.js
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testVectorSystem() {
  console.log('🧪 Testing Vector-Based System...\n');

  try {
    // Test 1: Vector-based composition
    console.log('1. Testing vector-based composition...');
    const composeResponse = await fetch(`${BASE_URL}/api/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'house-order',
        vector: [0.2, 0.3, 0.2, 0.4, 0.8, 0.3], // ambient vector
        natal: {
          date: '1990-01-01',
          time: '12:00',
          tz: 'UTC',
          lat: 40.7128,
          lon: -74.0060
        }
      })
    });

    if (composeResponse.ok) {
      const composeData = await composeResponse.json();
      console.log('✅ Vector composition successful');
      console.log(`   Mode: ${composeData.mode}`);
      console.log(`   Vector: [${composeData.vector.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`   Planets: ${composeData.analytics.planetCount}`);
    } else {
      console.log('❌ Vector composition failed:', await composeResponse.text());
    }

    // Test 2: V2 Engine presets
    console.log('\n2. Testing v2 engine presets...');
    const presetsResponse = await fetch(`${BASE_URL}/api/v2/engine/presets`);
    
    if (presetsResponse.ok) {
      const presetsData = await presetsResponse.json();
      console.log('✅ V2 presets available');
      console.log(`   Available presets: ${Object.keys(presetsData.presets).join(', ')}`);
    } else {
      console.log('❌ V2 presets failed:', await presetsResponse.text());
    }

    // Test 3: V2 Audition system
    console.log('\n3. Testing v2 audition system...');
    const auditionResponse = await fetch(`${BASE_URL}/api/v2/audition/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { testRuns: 1 },
        testCases: ['ambient', 'classical']
      })
    });

    if (auditionResponse.ok) {
      const auditionData = await auditionResponse.json();
      console.log('✅ V2 audition system ready');
      console.log(`   Run ID: ${auditionData.runId || 'N/A'}`);
    } else {
      console.log('❌ V2 audition failed:', await auditionResponse.text());
    }

    // Test 4: Legacy genre compatibility
    console.log('\n4. Testing legacy genre compatibility...');
    const legacyResponse = await fetch(`${BASE_URL}/api/v2/engine/compose-from-genre`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'house-order',
        genre: 'ambient',
        natal: {
          date: '1990-01-01',
          time: '12:00',
          tz: 'UTC',
          lat: 40.7128,
          lon: -74.0060
        }
      })
    });

    if (legacyResponse.ok) {
      console.log('✅ Legacy genre compatibility working');
    } else {
      console.log('❌ Legacy genre compatibility failed:', await legacyResponse.text());
    }

    console.log('\n🎉 Vector system test complete!');
    console.log('\nNext steps:');
    console.log('- Start the server: npm run dev');
    console.log('- Open http://localhost:3000');
    console.log('- Test the "Test Vector Audition" button');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure the server is running: npm run dev');
  }
}

// Run the test
testVectorSystem();
