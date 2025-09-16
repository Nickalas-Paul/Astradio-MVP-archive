// feature-encoder.ts - Swiss-Ephemeris chart to feature vector encoding

import { ChartContext, FeatureVector } from './contracts';
import { FEATURE_LEN } from './scaler';

/**
 * Feature order (46 features total):
 * 0-9: Planet positions (sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto)
 * 10-21: House cusps (12 houses)
 * 22-31: Aspect counts (sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto)
 * 32-35: Element dominance (fire, earth, air, water)
 * 36-38: Cluster counts (cardinal, fixed, mutable)
 * 39: Moon phase
 * 40-43: Sign positions (ascendant, midheaven, sun, moon)
 * 44-45: Additional features (aspect tension, harmonic balance)
 */
export const FEATURE_ORDER = [
  'sun_position', 'moon_position', 'mercury_position', 'venus_position', 'mars_position',
  'jupiter_position', 'saturn_position', 'uranus_position', 'neptune_position', 'pluto_position',
  'house_1_cusp', 'house_2_cusp', 'house_3_cusp', 'house_4_cusp', 'house_5_cusp', 'house_6_cusp',
  'house_7_cusp', 'house_8_cusp', 'house_9_cusp', 'house_10_cusp', 'house_11_cusp', 'house_12_cusp',
  'sun_aspects', 'moon_aspects', 'mercury_aspects', 'venus_aspects', 'mars_aspects',
  'jupiter_aspects', 'saturn_aspects', 'uranus_aspects', 'neptune_aspects', 'pluto_aspects',
  'fire_element', 'earth_element', 'air_element', 'water_element',
  'cardinal_cluster', 'fixed_cluster', 'mutable_cluster',
  'moon_phase', 'ascendant_sign', 'midheaven_sign', 'sun_sign', 'moon_sign',
  'aspect_tension', 'harmonic_balance'
];

export class FeatureEncoder {
  static readonly FEATURE_LEN = FEATURE_LEN;
  static readonly FEATURE_ORDER = FEATURE_ORDER;

  constructor() {
    console.log(`[FeatureEncoder] Initialized with FEATURE_LEN=${FEATURE_LEN}`);
    console.log(`[FeatureEncoder] Feature order:`, FEATURE_ORDER.slice(0, 5), '...', FEATURE_ORDER.slice(-5));
  }

  encode(chart: ChartContext): FeatureVector {
    const features: number[] = [];

    // 0-9: Planet positions (normalized to 0-1)
    const planetOrder = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    planetOrder.forEach(planet => {
      const position = chart.planets[planet as keyof typeof chart.planets] || 0;
      features.push(this.normalizeAngle(position));
    });

    // 10-21: House cusps (normalized to 0-1)
    chart.houses.forEach(cusp => {
      features.push(this.normalizeAngle(cusp));
    });

    // 22-31: Aspect counts (normalized by max possible aspects)
    planetOrder.forEach(planet => {
      const aspectCount = this.countAspectsForPlanet(chart, planet);
      features.push(Math.min(aspectCount / 10, 1)); // Max 10 aspects per planet
    });

    // 32-35: Element dominance (0-1)
    const elements = ['fire', 'earth', 'air', 'water'] as const;
    elements.forEach(element => {
      const dominance = chart.dominantElements?.[element] || 0;
      features.push(Math.max(0, Math.min(1, dominance)));
    });

    // 36-38: Cluster counts (normalized)
    const clusters = this.analyzeClusters(chart);
    features.push(Math.min(clusters.cardinal / 4, 1)); // Max 4 cardinal signs
    features.push(Math.min(clusters.fixed / 4, 1));   // Max 4 fixed signs
    features.push(Math.min(clusters.mutable / 4, 1)); // Max 4 mutable signs

    // 39: Moon phase (0-1)
    features.push(chart.moonPhase || 0);

    // 40-43: Sign positions (ascendant, midheaven, sun, moon)
    const ascendant = chart.houses[0] || 0;
    const midheaven = chart.houses[9] || 0; // 10th house cusp
    const sunSign = Math.floor(chart.planets.sun / 30);
    const moonSign = Math.floor(chart.planets.moon / 30);
    
    features.push(this.normalizeAngle(ascendant));
    features.push(this.normalizeAngle(midheaven));
    features.push(sunSign / 12);
    features.push(moonSign / 12);

    // 44-45: Additional features
    features.push(this.calculateAspectTension(chart));
    features.push(this.calculateHarmonicBalance(chart));

    // Ensure exact length
    if (features.length !== FEATURE_LEN) {
      throw new Error(`Feature encoding error: expected ${FEATURE_LEN}, got ${features.length}`);
    }

    return features;
  }

  private normalizeAngle(degrees: number): number {
    // Normalize to 0-1 range
    return ((degrees % 360) + 360) % 360 / 360;
  }

  private countAspectsForPlanet(chart: ChartContext, planet: string): number {
    if (!chart.aspects) return 0;
    return chart.aspects.filter(aspect => aspect.a === planet || aspect.b === planet).length;
  }

  private analyzeClusters(chart: ChartContext): { cardinal: number; fixed: number; mutable: number } {
    const clusters = { cardinal: 0, fixed: 0, mutable: 0 };
    
    // Analyze planet positions for sign clusters
    Object.values(chart.planets).forEach(position => {
      const sign = Math.floor(position / 30);
      if ([0, 3, 6, 9].includes(sign)) clusters.cardinal++;
      else if ([1, 4, 7, 10].includes(sign)) clusters.fixed++;
      else if ([2, 5, 8, 11].includes(sign)) clusters.mutable++;
    });

    return clusters;
  }

  private calculateAspectTension(chart: ChartContext): number {
    if (!chart.aspects) return 0.5;
    
    const tensionAspects = chart.aspects.filter(aspect => 
      ['square', 'opposition', 'quincunx'].includes(aspect.type)
    ).length;
    
    return Math.min(tensionAspects / 10, 1);
  }

  private calculateHarmonicBalance(chart: ChartContext): number {
    if (!chart.aspects) return 0.5;
    
    const harmonicAspects = chart.aspects.filter(aspect => 
      ['trine', 'sextile', 'conjunction'].includes(aspect.type)
    ).length;
    
    return Math.min(harmonicAspects / 10, 1);
  }
}
