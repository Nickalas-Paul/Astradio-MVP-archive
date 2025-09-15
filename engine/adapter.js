// Engine adapter to bridge the unified TypeScript Engine with the render worker
// This adapts the new unified Engine.ts for server-side rendering

const { spawn } = require('child_process');
const path = require('path');

// Import the unified Engine (we'll need to compile TS to JS or use ts-node)
let Engine;
try {
  // Try to import the compiled JS version
  const engineModule = require('../src/audio/Engine.js');
  Engine = engineModule.Engine;
} catch (error) {
  console.warn('Could not import compiled Engine.js, using fallback');
  Engine = null;
}

/**
 * Generate a track using the unified audio engine
 * @param {Object} chartData - Chart data from Swiss Ephemeris
 * @param {Object} options - Generation options
 * @param {string} options.mode - 'house', 'clusters', 'elemental', or 'lunar'
 * @param {string} options.genre - Genre name
 * @param {number} options.durationSec - Duration in seconds (default: 60)
 * @returns {Promise<Object>} - Returns timeline, audioBuffer, previewBuffer, ogPng
 */
async function generateTrack(chartData, options = {}) {
  const { mode = 'house', genre = 'electronic', durationSec = 60 } = options;
  
  console.log(`[AE] Generating track: ${mode} ${genre} (${durationSec}s)`);
  
  try {
    if (Engine) {
      // Use the unified Engine if available
      const engine = new Engine(chartData);
      await engine.play(mode, genre);
      
      // For now, return a timeline based on the engine's analysis
      const timeline = generateTimelineFromEngine(chartData, mode, genre, durationSec);
      const audioBuffer = await generateAudioBufferFromEngine(engine, durationSec);
      const previewBuffer = generatePreviewBuffer(audioBuffer);
      const ogPng = generateOGImage(chartData, mode, genre);
      
      return {
        timeline,
        audioBuffer,
        previewBuffer,
        ogPng
      };
    } else {
      // Fallback to simulation if Engine not available
      console.warn('[AE] Using fallback simulation - Engine not available');
      return await generateFallbackTrack(chartData, options);
    }
  } catch (error) {
    console.error('[AE] Engine generation failed, using fallback:', error);
    return await generateFallbackTrack(chartData, options);
  }
}

/**
 * Generate timeline events from engine analysis
 */
function generateTimelineFromEngine(chartData, mode, genre, durationSec) {
  const events = [];
  const step = durationSec / 12; // 12 events per track (like houses)
  
  // Analyze chart data similar to Engine.ts
  const positions = chartData.positions || {};
  const cusps = Array.isArray(chartData.cusps) && chartData.cusps.length === 12 
    ? chartData.cusps 
    : Array.from({length: 12}, (_, i) => i * 30);
  
  // Generate events based on mode
  if (mode === 'house') {
    for (let i = 1; i <= 12; i++) {
      const time = (i - 1) * step;
      events.push({
        time: Math.round(time * 100) / 100,
        event: `house_${i}`,
        mode,
        genre,
        intensity: 0.3 + (i / 12) * 0.7,
        chart_data: { house: i, cusp: cusps[i - 1] }
      });
    }
  } else if (mode === 'clusters') {
    // Analyze clusters
    const clusters = analyzeClusters(positions);
    const totalPlanets = clusters.reduce((sum, c) => sum + (c.planets?.length || 0), 0);
    
    clusters.forEach((cluster, i) => {
      const time = (i / clusters.length) * durationSec;
      const duration = (cluster.planets?.length || 1) / totalPlanets * durationSec;
      events.push({
        time: Math.round(time * 100) / 100,
        event: `cluster_${i + 1}`,
        mode,
        genre,
        intensity: 0.4 + (cluster.planets?.length || 1) * 0.1,
        chart_data: { planets: cluster.planets, duration }
      });
    });
  } else if (mode === 'elemental') {
    // Analyze elements
    const elements = analyzeElements(positions);
    Object.entries(elements).forEach(([element, weight]) => {
      if (weight > 0.1) {
        const time = events.length * step;
        events.push({
          time: Math.round(time * 100) / 100,
          event: `element_${element}`,
          mode,
          genre,
          intensity: 0.3 + weight * 0.7,
          chart_data: { element, weight }
        });
      }
    });
  } else {
    // Lunar mode - 8 phases
    for (let i = 1; i <= 8; i++) {
      const time = (i - 1) * (durationSec / 8);
      events.push({
        time: Math.round(time * 100) / 100,
        event: `lunar_phase_${i}`,
        mode,
        genre,
        intensity: 0.4 + (i / 8) * 0.6,
        chart_data: { phase: i }
      });
    }
  }
  
  return events;
}

/**
 * Generate audio buffer from engine (placeholder - would need Tone.js server-side)
 */
async function generateAudioBufferFromEngine(engine, durationSec) {
  // This would require Tone.js to work in Node.js environment
  // For now, return a dummy buffer with engine-like characteristics
  const sampleRate = 44100;
  const samples = durationSec * sampleRate;
  const buffer = Buffer.alloc(samples * 2); // 16-bit audio
  
  // Generate a more complex waveform based on engine characteristics
  const baseFreq = 220; // A3
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = baseFreq + Math.sin(t * 0.1) * 50; // Frequency modulation
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.3;
    const int16 = Math.round(sample * 32767);
    buffer.writeInt16LE(int16, i * 2);
  }
  
  return buffer;
}

/**
 * Fallback track generation (original dummy implementation)
 */
async function generateFallbackTrack(chartData, options = {}) {
  const { mode = 'clusters', genre = 'electronic', durationSec = 60 } = options;
  
  console.log(`[AE] Using fallback generation: ${mode} ${genre} (${durationSec}s)`);
  
  // Simulate processing time
  const processingTime = Math.min(durationSec * 50, 5000);
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  const timeline = generateTimeline(chartData, mode, genre, durationSec);
  const audioBuffer = generateAudioBuffer(durationSec);
  const previewBuffer = generatePreviewBuffer(audioBuffer);
  const ogPng = generateOGImage(chartData, mode, genre);
  
  return {
    timeline,
    audioBuffer,
    previewBuffer,
    ogPng
  };
}

/**
 * Generate timeline events for the track (fallback)
 */
function generateTimeline(chartData, mode, genre, durationSec) {
  const events = [];
  const step = durationSec / 10;
  
  for (let i = 0; i <= 10; i++) {
    const time = i * step;
    events.push({
      time: Math.round(time * 100) / 100,
      event: i === 0 ? 'start' : i === 10 ? 'end' : 'transition',
      mode,
      genre,
      intensity: 0.3 + (i / 10) * 0.7,
      chart_data: chartData
    });
  }
  
  return events;
}

/**
 * Generate a dummy audio buffer (fallback)
 */
function generateAudioBuffer(durationSec) {
  const sampleRate = 44100;
  const samples = durationSec * sampleRate;
  const buffer = Buffer.alloc(samples * 2);
  
  const frequency = 440;
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
    const int16 = Math.round(sample * 32767);
    buffer.writeInt16LE(int16, i * 2);
  }
  
  return buffer;
}

/**
 * Generate a preview buffer (first 15 seconds)
 */
function generatePreviewBuffer(audioBuffer) {
  const previewDuration = 15;
  const sampleRate = 44100;
  const previewSamples = previewDuration * sampleRate * 2;
  
  return audioBuffer.slice(0, Math.min(previewSamples, audioBuffer.length));
}

/**
 * Generate OpenGraph image
 */
function generateOGImage(chartData, mode, genre) {
  const width = 1200;
  const height = 630;
  const buffer = Buffer.alloc(width * height * 3);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      buffer[offset] = Math.floor((x / width) * 255);
      buffer[offset + 1] = Math.floor((y / height) * 255);
      buffer[offset + 2] = 128;
    }
  }
  
  return buffer;
}

/**
 * Generate comparison track (overlay mode)
 */
async function generateComparisonTrack(requesterChartData, targetChartData, options = {}) {
  const { mode = 'clusters', genre = 'electronic', durationSec = 60 } = options;
  
  console.log(`[AE] Generating comparison track: ${mode} ${genre} (${durationSec}s)`);
  
  const combinedChartData = {
    positions: { ...requesterChartData.positions, ...targetChartData.positions },
    cusps: requesterChartData.cusps || targetChartData.cusps,
    requester: requesterChartData,
    target: targetChartData,
    type: 'overlay'
  };
  
  return await generateTrack(combinedChartData, options);
}

// Helper functions from Engine.ts (simplified for Node.js)
function analyzeClusters(positions) {
  const names = Object.keys(positions).filter(p => typeof positions[p] === 'number');
  const visited = new Set();
  const clusters = [];
  
  for (let i = 0; i < names.length; i++) {
    const a = names[i];
    if (visited.has(a)) continue;
    
    const group = [a];
    visited.add(a);
    
    for (let j = i + 1; j < names.length; j++) {
      const b = names[j];
      if (visited.has(b)) continue;
      
      const distance = Math.min(
        Math.abs(positions[a] - positions[b]),
        Math.abs(360 - Math.abs(positions[a] - positions[b]))
      );
      
      if (distance <= 20) {
        group.push(b);
        visited.add(b);
      }
    }
    
    if (group.length) {
      clusters.push({ planets: group });
    }
  }
  
  return clusters;
}

function analyzeElements(positions) {
  const elements = { fire: 0, earth: 0, air: 0, water: 0 };
  let total = 0;
  
  for (const [planet, longitude] of Object.entries(positions)) {
    if (typeof longitude !== 'number') continue;
    total++;
    
    const sign = Math.floor(longitude / 30);
    const element = getElementFromSign(sign);
    elements[element]++;
  }
  
  // Normalize
  if (total > 0) {
    for (const element in elements) {
      elements[element] = elements[element] / total;
    }
  }
  
  return elements;
}

function getElementFromSign(sign) {
  const elementMap = {
    0: 'fire', 1: 'earth', 2: 'air', 3: 'water',
    4: 'fire', 5: 'earth', 6: 'air', 7: 'water',
    8: 'fire', 9: 'earth', 10: 'air', 11: 'water'
  };
  return elementMap[sign] || 'fire';
}

module.exports = {
  generateTrack,
  generateComparisonTrack
};
