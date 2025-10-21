// Compatibility Matcher
// Generates matches using scoring engine and feature vectors

import type { CompatMatch, CompatFacet, ChartID } from '../../src/core/compat/types';
import { scoreCompatibility } from './score';
import { getChartFeatures, getMultipleChartFeatures } from './features';
import { getCachedMatches } from './cache';

// Mock user database - replace with actual database
const MOCK_USERS = new Map<string, { userId: string; chartId: string; visibility: string }>();

// Initialize mock users
function initializeMockUsers() {
  const users = [
    { userId: 'user-1', chartId: 'natal-1', visibility: 'public' },
    { userId: 'user-2', chartId: 'natal-2', visibility: 'public' },
    { userId: 'user-3', chartId: 'natal-3', visibility: 'friends' },
    { userId: 'user-4', chartId: 'today-1', visibility: 'public' },
    { userId: 'user-5', chartId: 'today-2', visibility: 'private' },
  ];
  
  users.forEach(user => {
    MOCK_USERS.set(user.chartId, user);
  });
}

// Generate matches for a chart
export async function generateMatches({
  chartId,
  facets = ['overall'],
  limit = 10,
  forceRefresh = false
}: {
  chartId: ChartID;
  facets?: CompatFacet[];
  limit?: number;
  forceRefresh?: boolean;
}): Promise<CompatMatch[]> {
  try {
    // Get features for the source chart
    const sourceFeatures = await getChartFeatures(chartId);
    if (!sourceFeatures) {
      throw new Error(`Features not found for chart ${chartId}`);
    }

    // Get all available charts (excluding the source)
    const availableCharts = Array.from(MOCK_USERS.keys()).filter(id => id !== chartId);
    
    // Get features for all available charts
    const allFeatures = await getMultipleChartFeatures(availableCharts);
    
    // Score all pairs
    const scores: Array<{ chartId: string; score: number; rationale: string[] }> = [];
    
    for (const [targetChartId, targetFeatures] of allFeatures.entries()) {
      if (!targetFeatures) continue;
      
      // TODO: Compute actual synastry features
      // For now, use mock synastry features
      const synFeatures = generateMockSynastryFeatures();
      
      // Score for the primary facet (first in the list)
      const primaryFacet = facets[0];
      const result = scoreCompatibility({
        facet: primaryFacet,
        A: { features64: sourceFeatures },
        B: { features64: targetFeatures },
        syn: synFeatures
      });
      
      scores.push({
        chartId: targetChartId,
        score: result.score,
        rationale: result.rationale
      });
    }
    
    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);
    
    // Convert to CompatMatch format
    const matches: CompatMatch[] = scores.slice(0, limit).map(score => {
      const user = MOCK_USERS.get(score.chartId);
      return {
        targetUserId: user?.userId || 'unknown',
        targetChartId: score.chartId,
        facet: facets[0],
        score: score.score,
        rationale: score.rationale,
        previewCompId: undefined // TODO: Generate preview composition
      };
    });
    
    return matches;
    
  } catch (error) {
    console.error('Error generating matches:', error);
    return [];
  }
}

// Generate matches for multiple facets
export async function generateMultiFacetMatches({
  chartId,
  facets = ['overall'],
  limit = 10
}: {
  chartId: ChartID;
  facets?: CompatFacet[];
  limit?: number;
}): Promise<Map<CompatFacet, CompatMatch[]>> {
  const results = new Map<CompatFacet, CompatMatch[]>();
  
  for (const facet of facets) {
    const matches = await generateMatches({
      chartId,
      facets: [facet],
      limit
    });
    results.set(facet, matches);
  }
  
  return results;
}

// Get top matches across all facets
export async function getTopMatchesAcrossFacets({
  chartId,
  limit = 5
}: {
  chartId: ChartID;
  limit?: number;
}): Promise<CompatMatch[]> {
  const facets: CompatFacet[] = ['friends', 'lovers', 'creative', 'mentor', 'overall'];
  const allMatches: CompatMatch[] = [];
  
  for (const facet of facets) {
    const matches = await generateMatches({
      chartId,
      facets: [facet],
      limit: Math.ceil(limit / facets.length)
    });
    allMatches.push(...matches);
  }
  
  // Sort by score and return top matches
  return allMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Find matches with specific criteria
export async function findMatchesWithCriteria({
  chartId,
  facet,
  minScore = 0.5,
  maxResults = 20
}: {
  chartId: ChartID;
  facet: CompatFacet;
  minScore?: number;
  maxResults?: number;
}): Promise<CompatMatch[]> {
  const matches = await generateMatches({
    chartId,
    facets: [facet],
    limit: maxResults * 2 // Get more to filter
  });
  
  return matches
    .filter(match => match.score >= minScore)
    .slice(0, maxResults);
}

// Get match statistics
export async function getMatchStats(chartId: ChartID): Promise<{
  totalMatches: number;
  averageScore: number;
  topFacet: CompatFacet;
  facetBreakdown: Record<CompatFacet, number>;
}> {
  const facets: CompatFacet[] = ['friends', 'lovers', 'creative', 'mentor', 'conflict', 'overall'];
  const facetBreakdown: Record<CompatFacet, number> = {} as any;
  let totalMatches = 0;
  let totalScore = 0;
  let topFacet: CompatFacet = 'overall';
  let topScore = 0;
  
  for (const facet of facets) {
    const matches = await generateMatches({
      chartId,
      facets: [facet],
      limit: 10
    });
    
    facetBreakdown[facet] = matches.length;
    totalMatches += matches.length;
    
    if (matches.length > 0) {
      const avgScore = matches.reduce((sum, match) => sum + match.score, 0) / matches.length;
      totalScore += avgScore * matches.length;
      
      if (avgScore > topScore) {
        topScore = avgScore;
        topFacet = facet;
      }
    }
  }
  
  return {
    totalMatches,
    averageScore: totalMatches > 0 ? totalScore / totalMatches : 0,
    topFacet,
    facetBreakdown
  };
}

// Generate mock synastry features for testing
function generateMockSynastryFeatures() {
  const aspects = ['conj', 'trine', 'sextile', 'square', 'opp', 'quincunx'];
  const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const dignities = ['domicile', 'exalt', 'detriment', 'fall', null];
  
  const features = [];
  const numFeatures = Math.floor(Math.random() * 5) + 3; // 3-7 features
  
  for (let i = 0; i < numFeatures; i++) {
    const aspect = aspects[Math.floor(Math.random() * aspects.length)] as any;
    const planet1 = planets[Math.floor(Math.random() * planets.length)];
    const planet2 = planets[Math.floor(Math.random() * planets.length)];
    const orbDeg = Math.random() * 8; // 0-8 degrees
    const strength = Math.max(0, 1 - orbDeg / 8); // Orb falloff
    const dignity = dignities[Math.floor(Math.random() * dignities.length)] as any;
    
    features.push({
      aspect,
      bodies: [planet1, planet2] as [string, string],
      orbDeg,
      strength,
      dignity
    });
  }
  
  return features;
}

// Initialize mock users on module load
initializeMockUsers();
