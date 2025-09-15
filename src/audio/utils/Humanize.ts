// Humanize - Adds human-like variations to timing and velocity
export interface HumanizeConfig {
  timingJitter: number; // milliseconds
  velocityCurve: 'linear' | 'exponential' | 'logarithmic';
  velocityRange: [number, number];
  detuneRange: number; // cents
  roundRobin: boolean;
}

export class Humanize {
  private config: HumanizeConfig;
  private roundRobinIndex = 0;

  constructor(config: HumanizeConfig) {
    this.config = config;
  }

  humanizeTiming(baseTime: number): number {
    const jitter = (Math.random() - 0.5) * this.config.timingJitter / 1000; // Convert to seconds
    return baseTime + jitter;
  }

  humanizeVelocity(baseVelocity: number): number {
    const [min, max] = this.config.velocityRange;
    const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
    
    let humanizedVelocity = baseVelocity + variation;
    
    // Apply velocity curve
    switch (this.config.velocityCurve) {
      case 'exponential':
        humanizedVelocity = Math.pow(humanizedVelocity, 1.5);
        break;
      case 'logarithmic':
        humanizedVelocity = Math.log(humanizedVelocity + 1) / Math.log(2);
        break;
      case 'linear':
      default:
        // No transformation
        break;
    }
    
    return Math.max(min, Math.min(max, humanizedVelocity));
  }

  humanizeDetune(baseFreq: number): number {
    const detuneCents = (Math.random() - 0.5) * this.config.detuneRange;
    const detuneRatio = Math.pow(2, detuneCents / 1200);
    return baseFreq * detuneRatio;
  }

  getRoundRobinIndex(): number {
    if (this.config.roundRobin) {
      this.roundRobinIndex = (this.roundRobinIndex + 1) % 4; // 4 round-robin voices
    }
    return this.roundRobinIndex;
  }

  humanizeNote(note: any): any {
    return {
      ...note,
      time: this.humanizeTiming(note.time),
      velocity: this.humanizeVelocity(note.velocity),
      frequency: note.frequency ? this.humanizeDetune(note.frequency) : note.frequency,
      roundRobin: this.getRoundRobinIndex()
    };
  }

  humanizeChord(chord: any[]): any[] {
    return chord.map(note => this.humanizeNote(note));
  }

  humanizeGroove(groove: any): any {
    const humanizedGroove = { ...groove };
    
    // Humanize each hit in the groove
    for (const [instrument, pattern] of Object.entries(groove)) {
      if (Array.isArray(pattern)) {
        humanizedGroove[instrument] = pattern.map(hit => ({
          ...hit,
          time: this.humanizeTiming(hit.time),
          velocity: this.humanizeVelocity(hit.velocity)
        }));
      }
    }
    
    return humanizedGroove;
  }

  resetRoundRobin(): void {
    this.roundRobinIndex = 0;
  }
}
