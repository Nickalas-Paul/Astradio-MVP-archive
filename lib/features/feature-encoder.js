// Shared FeatureEncoder: Swiss Ephemeris → normalized features
// Single source of truth for both audio and text engines

const { getChartData } = require('../ephemeris');
const { generateChartHashSync } = require('../hash/chartHash');
const crypto = require('crypto');

class FeatureEncoder {
  constructor() {
    this.featuresVersion = 'v1.1';
    this.cache = new Map(); // In production, use Redis
  }

  /**
   * Encode chart data to normalized features
   */
  async encode(chartData, options = {}) {
    const {
      houseSystem = 'placidus',
      tzDiscipline = 'utc',
      featuresVersion = this.featuresVersion,
      useCache = true
    } = options;

    // Generate deterministic chart hash
    const chartHash = generateChartHashSync({
      ...chartData,
      houseSystem,
      tzDiscipline,
      featuresVersion
    });

    // Check cache first
    if (useCache && this.cache.has(chartHash)) {
      return this.cache.get(chartHash);
    }

    try {
      // Get Swiss Ephemeris data
      const ephemerisData = await getChartData(chartData);
      
      // Normalize to standard feature vector
      const features = this.normalizeFeatures(ephemerisData, {
        houseSystem,
        tzDiscipline,
        featuresVersion
      });

      // Add metadata
      const result = {
        chartHash,
        featuresVersion,
        houseSystem,
        tzDiscipline,
        features,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'swiss_ephemeris',
          normalized: true
        }
      };

      // Cache result
      if (useCache) {
        this.cache.set(chartHash, result);
      }

      return result;
    } catch (error) {
      throw new Error(`Feature encoding failed: ${error.message}`);
    }
  }

  /**
   * Normalize Swiss Ephemeris data to standard feature vector
   */
  normalizeFeatures(ephemerisData, options) {
    const { houseSystem, tzDiscipline, featuresVersion } = options;
    
    // Extract planetary positions (normalized to 0-360 degrees)
    const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const positions = {};
    
    planets.forEach(planet => {
      const pos = ephemerisData.positions[planet];
      if (pos !== undefined) {
        positions[planet] = this.normalizeDegree(pos);
      }
    });

    // Extract house cusps
    const houses = ephemerisData.cusps.map(cusp => this.normalizeDegree(cusp));

    // Calculate aspects
    const aspects = this.calculateAspects(positions);

    // Calculate elemental balance
    const elements = this.calculateElements(positions);

    // Calculate modalities
    const modalities = this.calculateModalities(positions);

    // Calculate moon phase
    const moonPhase = this.calculateMoonPhase(positions.sun, positions.moon);

    // Generate feature vector (normalized 0-1 values)
    const featureVector = this.generateFeatureVector({
      positions,
      houses,
      aspects,
      elements,
      modalities,
      moonPhase
    });

    return {
      positions,
      houses,
      aspects,
      elements,
      modalities,
      moonPhase,
      featureVector,
      metadata: {
        houseSystem,
        tzDiscipline,
        featuresVersion,
        planetCount: Object.keys(positions).length,
        aspectCount: aspects.length
      }
    };
  }

  /**
   * Normalize degree to 0-360 range
   */
  normalizeDegree(degree) {
    return ((degree % 360) + 360) % 360;
  }

  /**
   * Calculate planetary aspects
   */
  calculateAspects(positions) {
    const aspects = [];
    const planets = Object.keys(positions);
    
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const planet1 = planets[i];
        const planet2 = planets[j];
        const pos1 = positions[planet1];
        const pos2 = positions[planet2];
        
        const angle = Math.abs(pos1 - pos2);
        const normalizedAngle = Math.min(angle, 360 - angle);
        
        // Check for major aspects
        const aspectTypes = [
          { name: 'conjunction', angle: 0, orb: 8 },
          { name: 'sextile', angle: 60, orb: 6 },
          { name: 'square', angle: 90, orb: 8 },
          { name: 'trine', angle: 120, orb: 8 },
          { name: 'opposition', angle: 180, orb: 8 }
        ];

        for (const aspect of aspectTypes) {
          if (Math.abs(normalizedAngle - aspect.angle) <= aspect.orb) {
            aspects.push({
              planet1,
              planet2,
              type: aspect.name,
              angle: normalizedAngle,
              orb: Math.abs(normalizedAngle - aspect.angle),
              strength: 1 - (Math.abs(normalizedAngle - aspect.angle) / aspect.orb)
            });
          }
        }
      }
    }
    
    return aspects;
  }

  /**
   * Calculate elemental balance
   */
  calculateElements(positions) {
    const elements = {
      fire: 0,
      earth: 0,
      air: 0,
      water: 0
    };

    const signs = {
      fire: [0, 30, 120, 150], // Aries, Leo, Sagittarius
      earth: [30, 60, 150, 180], // Taurus, Virgo, Capricorn
      air: [60, 90, 180, 210], // Gemini, Libra, Aquarius
      water: [90, 120, 210, 240] // Cancer, Scorpio, Pisces
    };

    Object.values(positions).forEach(degree => {
      const sign = Math.floor(degree / 30);
      const signDegree = degree % 30;
      
      // Find which element this sign belongs to
      for (const [element, signDegrees] of Object.entries(signs)) {
        if (signDegrees.includes(sign * 30)) {
          elements[element]++;
          break;
        }
      }
    });

    // Normalize to 0-1
    const total = Object.values(elements).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      Object.keys(elements).forEach(element => {
        elements[element] = elements[element] / total;
      });
    }

    return elements;
  }

  /**
   * Calculate modalities
   */
  calculateModalities(positions) {
    const modalities = {
      cardinal: 0,
      fixed: 0,
      mutable: 0
    };

    const signModalities = {
      cardinal: [0, 90, 180, 270], // Aries, Cancer, Libra, Capricorn
      fixed: [30, 120, 210, 300], // Taurus, Leo, Scorpio, Aquarius
      mutable: [60, 150, 240, 330] // Gemini, Virgo, Sagittarius, Pisces
    };

    Object.values(positions).forEach(degree => {
      const sign = Math.floor(degree / 30) * 30;
      
      for (const [modality, signDegrees] of Object.entries(signModalities)) {
        if (signDegrees.includes(sign)) {
          modalities[modality]++;
          break;
        }
      }
    });

    // Normalize to 0-1
    const total = Object.values(modalities).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      Object.keys(modalities).forEach(modality => {
        modalities[modality] = modalities[modality] / total;
      });
    }

    return modalities;
  }

  /**
   * Calculate moon phase
   */
  calculateMoonPhase(sunDegree, moonDegree) {
    if (sunDegree === undefined || moonDegree === undefined) {
      return 0;
    }

    const angle = Math.abs(moonDegree - sunDegree);
    const normalizedAngle = Math.min(angle, 360 - angle);
    
    // Convert to 0-1 scale (0 = new moon, 0.5 = full moon, 1 = new moon)
    return normalizedAngle / 180;
  }

  /**
   * Generate normalized feature vector for ML models
   */
  generateFeatureVector(data) {
    const { positions, houses, aspects, elements, modalities, moonPhase } = data;
    
    // Planetary positions (normalized to 0-1)
    const planetFeatures = Object.values(positions).map(pos => pos / 360);
    
    // House cusps (normalized to 0-1)
    const houseFeatures = houses.map(cusp => cusp / 360);
    
    // Elemental balance
    const elementFeatures = Object.values(elements);
    
    // Modalities
    const modalityFeatures = Object.values(modalities);
    
    // Moon phase
    const moonPhaseFeature = [moonPhase];
    
    // Aspect features (count and strength)
    const aspectFeatures = [
      aspects.filter(a => a.type === 'conjunction').length / 10,
      aspects.filter(a => a.type === 'sextile').length / 10,
      aspects.filter(a => a.type === 'square').length / 10,
      aspects.filter(a => a.type === 'trine').length / 10,
      aspects.filter(a => a.type === 'opposition').length / 10,
      aspects.reduce((sum, a) => sum + a.strength, 0) / aspects.length || 0
    ];

    // Combine all features
    return [
      ...planetFeatures,
      ...houseFeatures,
      ...elementFeatures,
      ...modalityFeatures,
      ...moonPhaseFeature,
      ...aspectFeatures
    ];
  }

  /**
   * Get feature vector for a specific chart
   */
  async getFeatureVector(chartData, options = {}) {
    const encoded = await this.encode(chartData, options);
    return encoded.features.featureVector;
  }

  /**
   * Validate feature vector
   */
  validateFeatureVector(features) {
    if (!Array.isArray(features)) {
      throw new Error('Feature vector must be an array');
    }

    if (features.length === 0) {
      throw new Error('Feature vector cannot be empty');
    }

    // Check for NaN or infinite values
    for (let i = 0; i < features.length; i++) {
      if (!isFinite(features[i])) {
        throw new Error(`Invalid feature at index ${i}: ${features[i]}`);
      }
    }

    return true;
  }
}

module.exports = { FeatureEncoder };
