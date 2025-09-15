// Planet Motifs - Contains planet-specific musical motifs
export interface PlanetMotif {
  planet: string;
  role: string;
  baseFreq: number;
  energy: number;
  element: string;
  qualities: string[];
  intervals: number[];
  rhythm: {
    pattern: string;
    velocity: number[];
  };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
}

export class PlanetMotifs {
  private static motifs: Map<string, PlanetMotif> = new Map();

  static {
    // Initialize all planet motifs
    PlanetMotifs.initializeMotifs();
  }

  private static initializeMotifs(): void {
    // Sun
    PlanetMotifs.motifs.set('sun', {
      planet: 'sun',
      role: 'lead',
      baseFreq: 264,
      energy: 0.9,
      element: 'fire',
      qualities: ['leadership', 'vitality', 'creativity'],
      intervals: [0, 7, 12, 19],
      rhythm: {
        pattern: 'x---x---x---x---',
        velocity: [0.9, 0.7, 0.8, 0.6]
      },
      envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.8,
        release: 1.0
      }
    });

    // Moon
    PlanetMotifs.motifs.set('moon', {
      planet: 'moon',
      role: 'pad',
      baseFreq: 294,
      energy: 0.7,
      element: 'water',
      qualities: ['emotion', 'intuition', 'nurturing'],
      intervals: [0, 3, 7, 10],
      rhythm: {
        pattern: 'x-x-x-x-x-x-x-x-',
        velocity: [0.6, 0.5, 0.7, 0.4, 0.6, 0.5, 0.7, 0.4]
      },
      envelope: {
        attack: 0.3,
        decay: 0.5,
        sustain: 0.9,
        release: 2.0
      }
    });

    // Mercury
    PlanetMotifs.motifs.set('mercury', {
      planet: 'mercury',
      role: 'arp',
      baseFreq: 392,
      energy: 0.6,
      element: 'air',
      qualities: ['communication', 'intellect', 'adaptability'],
      intervals: [0, 2, 4, 7, 9, 11],
      rhythm: {
        pattern: 'x-x-x-x-x-x-x-x-',
        velocity: [0.7, 0.5, 0.6, 0.4, 0.7, 0.5, 0.6, 0.4]
      },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.6,
        release: 0.8
      }
    });

    // Venus
    PlanetMotifs.motifs.set('venus', {
      planet: 'venus',
      role: 'harmony',
      baseFreq: 349,
      energy: 0.8,
      element: 'earth',
      qualities: ['beauty', 'harmony', 'relationships'],
      intervals: [0, 4, 7, 11, 14],
      rhythm: {
        pattern: 'x---x---x---x---',
        velocity: [0.8, 0.6, 0.7, 0.5]
      },
      envelope: {
        attack: 0.2,
        decay: 0.4,
        sustain: 0.7,
        release: 1.5
      }
    });

    // Mars
    PlanetMotifs.motifs.set('mars', {
      planet: 'mars',
      role: 'percussive',
      baseFreq: 330,
      energy: 0.9,
      element: 'fire',
      qualities: ['action', 'passion', 'courage'],
      intervals: [0, 5, 8, 12],
      rhythm: {
        pattern: 'x--x--x--x--x--x-',
        velocity: [0.9, 0.3, 0.8, 0.4, 0.9, 0.3]
      },
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.5
      }
    });

    // Jupiter
    PlanetMotifs.motifs.set('jupiter', {
      planet: 'jupiter',
      role: 'chordExp',
      baseFreq: 440,
      energy: 0.8,
      element: 'fire',
      qualities: ['wisdom', 'expansion', 'optimism'],
      intervals: [0, 4, 7, 11, 14, 17],
      rhythm: {
        pattern: 'x-------x-------',
        velocity: [0.8, 0.7]
      },
      envelope: {
        attack: 0.4,
        decay: 0.6,
        sustain: 0.8,
        release: 2.0
      }
    });

    // Saturn
    PlanetMotifs.motifs.set('saturn', {
      planet: 'saturn',
      role: 'drone',
      baseFreq: 220,
      energy: 0.5,
      element: 'earth',
      qualities: ['discipline', 'structure', 'limitation'],
      intervals: [0, 7, 12],
      rhythm: {
        pattern: 'x---------------',
        velocity: [0.6]
      },
      envelope: {
        attack: 1.0,
        decay: 0.2,
        sustain: 0.9,
        release: 3.0
      }
    });

    // Uranus
    PlanetMotifs.motifs.set('uranus', {
      planet: 'uranus',
      role: 'modulate',
      baseFreq: 523,
      energy: 0.7,
      element: 'air',
      qualities: ['innovation', 'rebellion', 'freedom'],
      intervals: [0, 6, 10, 15],
      rhythm: {
        pattern: 'x-x---x-x---x-x-',
        velocity: [0.7, 0.4, 0.6, 0.3, 0.7, 0.4]
      },
      envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.6,
        release: 1.2
      }
    });

    // Neptune
    PlanetMotifs.motifs.set('neptune', {
      planet: 'neptune',
      role: 'ambient',
      baseFreq: 494,
      energy: 0.6,
      element: 'water',
      qualities: ['spirituality', 'illusion', 'compassion'],
      intervals: [0, 2, 4, 6, 8, 10],
      rhythm: {
        pattern: 'x-x-x-x-x-x-x-x-',
        velocity: [0.5, 0.3, 0.6, 0.2, 0.5, 0.3, 0.6, 0.2]
      },
      envelope: {
        attack: 0.8,
        decay: 0.5,
        sustain: 0.8,
        release: 2.5
      }
    });

    // Pluto
    PlanetMotifs.motifs.set('pluto', {
      planet: 'pluto',
      role: 'bass',
      baseFreq: 147,
      energy: 0.4,
      element: 'water',
      qualities: ['transformation', 'power', 'regeneration'],
      intervals: [0, 1, 3, 6, 9],
      rhythm: {
        pattern: 'x---x---x---x---',
        velocity: [0.8, 0.2, 0.7, 0.3]
      },
      envelope: {
        attack: 0.2,
        decay: 0.8,
        sustain: 0.5,
        release: 1.5
      }
    });
  }

  static getMotif(planet: string): PlanetMotif | null {
    return PlanetMotifs.motifs.get(planet.toLowerCase()) || null;
  }

  static getAllPlanets(): string[] {
    return Array.from(PlanetMotifs.motifs.keys());
  }

  static getPlanetsByElement(element: string): string[] {
    return Array.from(PlanetMotifs.motifs.values())
      .filter(motif => motif.element === element)
      .map(motif => motif.planet);
  }

  static getPlanetsByRole(role: string): string[] {
    return Array.from(PlanetMotifs.motifs.values())
      .filter(motif => motif.role === role)
      .map(motif => motif.planet);
  }

  static isValidPlanet(planet: string): boolean {
    return PlanetMotifs.motifs.has(planet.toLowerCase());
  }
}
