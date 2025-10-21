// Chart Features Integration
// Read-only tap into engine's feature encoder

import type { ChartID } from '../../src/core/compat/types';

// Mock feature encoder - replace with actual engine integration
const MOCK_FEATURES = new Map<string, number[]>();

// Initialize with some mock data
function initializeMockFeatures() {
  const charts = ['natal-1', 'natal-2', 'natal-3', 'today-1', 'today-2'];
  charts.forEach(chartId => {
    MOCK_FEATURES.set(chartId, generateMockFeatures());
  });
}

function generateMockFeatures(): number[] {
  // Generate 64-D feature vector with realistic astrological patterns
  const features = new Array(64).fill(0);
  
  // Elemental features (0-15)
  for (let i = 0; i < 16; i++) {
    features[i] = Math.random() * 2 - 1; // -1 to 1
  }
  
  // Modal features (16-31)
  for (let i = 16; i < 32; i++) {
    features[i] = Math.random() * 2 - 1;
  }
  
  // Planetary features (32-47)
  for (let i = 32; i < 48; i++) {
    features[i] = Math.random() * 2 - 1;
  }
  
  // Aspect features (48-63)
  for (let i = 48; i < 64; i++) {
    features[i] = Math.random() * 2 - 1;
  }
  
  return features;
}

// Get chart features from engine encoder
export async function getChartFeatures(chartId: ChartID): Promise<number[] | null> {
  try {
    // TODO: Replace with actual engine integration
    // This would call the engine's feature encoder/teacher
    // const features = await engineEncoder.encodeChart(chartId);
    
    // For now, use mock features
    if (!MOCK_FEATURES.has(chartId)) {
      MOCK_FEATURES.set(chartId, generateMockFeatures());
    }
    
    return MOCK_FEATURES.get(chartId) || null;
    
  } catch (error) {
    console.error(`Error fetching features for chart ${chartId}:`, error);
    return null;
  }
}

// Get multiple chart features
export async function getMultipleChartFeatures(chartIds: ChartID[]): Promise<Map<ChartID, number[]>> {
  const features = new Map<ChartID, number[]>();
  
  for (const chartId of chartIds) {
    const chartFeatures = await getChartFeatures(chartId);
    if (chartFeatures) {
      features.set(chartId, chartFeatures);
    }
  }
  
  return features;
}

// Validate feature vector
export function validateFeatures(features: number[]): boolean {
  if (!Array.isArray(features) || features.length !== 64) {
    return false;
  }
  
  // Check that all values are in valid range
  return features.every(val => typeof val === 'number' && val >= -1 && val <= 1);
}

// Normalize feature vector
export function normalizeFeatures(features: number[]): number[] {
  if (!validateFeatures(features)) {
    throw new Error('Invalid feature vector');
  }
  
  // L2 normalization
  const magnitude = Math.sqrt(features.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) {
    return features; // Already normalized
  }
  
  return features.map(val => val / magnitude);
}

// Get feature similarity between two charts
export function getFeatureSimilarity(featuresA: number[], featuresB: number[]): number {
  if (!validateFeatures(featuresA) || !validateFeatures(featuresB)) {
    throw new Error('Invalid feature vectors');
  }
  
  // Cosine similarity
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < 64; i++) {
    dotProduct += featuresA[i] * featuresB[i];
    normA += featuresA[i] * featuresA[i];
    normB += featuresB[i] * featuresB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get feature distance (1 - similarity)
export function getFeatureDistance(featuresA: number[], featuresB: number[]): number {
  return 1 - getFeatureSimilarity(featuresA, featuresB);
}

// Initialize mock features on module load
initializeMockFeatures();
