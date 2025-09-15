// Integration Example - How to use Empty House System in Astradio
import { renderEmptyHouse, buildHouseContext, renderHouses, Genre } from '../index';

// Example: Integration with existing Astradio audio system
export class AstradioAudioWithEmptyHouses {
  private instrumentPool: any;
  private masterBus: any;
  private scheduler: any;
  private currentGenre: Genre = 'Classical';
  private currentKey = { tonic: 'C', mode: 'major' };
  private currentBpm = 120;
  private currentSwing = 0.1;
  private currentIntensity = 0.5;
  private rngSeed = Date.now();

  constructor() {
    // Initialize your audio system components
    this.instrumentPool = this.createInstrumentPool();
    this.masterBus = this.createMasterBus();
    this.scheduler = this.createScheduler();
  }

  /**
   * Main render function for astrological chart
   */
  public renderChart(chart: any, duration: number): void {
    const houses = chart.houses;
    const totalDuration = duration;
    const houseDuration = totalDuration / 12; // 5 seconds per house

    // Engine dependencies
    const deps = {
      pool: this.instrumentPool,
      bus: this.masterBus,
      sched: this.scheduler
    };

    // Render each house
    for (let i = 0; i < houses.length; i++) {
      const house = houses[i];
      const startTime = i * houseDuration;
      
      const ctx = buildHouseContext(
        house.number,
        chart,
        { startTime, duration: houseDuration },
        this.currentGenre,
        this.rngSeed,
        this.currentKey,
        this.currentBpm,
        this.currentSwing,
        this.currentIntensity
      );

      if (house.planets.length === 0) {
        // Render empty house content
        renderEmptyHouse(this.currentGenre, ctx, deps);
      } else {
        // Render planetary motifs (existing system)
        this.renderPlanetMotifs(house.planets, ctx, deps);
      }
    }
  }

  /**
   * Alternative: Use the integrated renderHouses function
   */
  public renderChartIntegrated(chart: any, duration: number): void {
    const houses = chart.houses;
    const houseDuration = duration / 12;

    const deps = {
      pool: this.instrumentPool,
      bus: this.masterBus,
      sched: this.scheduler
    };

    // Use the integrated function
    renderHouses(
      houses,
      chart,
      { startTime: 0, duration: houseDuration },
      this.currentGenre,
      this.rngSeed,
      this.currentKey,
      this.currentBpm,
      this.currentSwing,
      this.currentIntensity,
      deps,
      this.renderPlanetMotifs.bind(this)
    );
  }

  /**
   * Change genre and re-render
   */
  public setGenre(genre: Genre): void {
    this.currentGenre = genre;
    // Re-render with new genre
    this.rerenderCurrentChart();
  }

  /**
   * Change key and re-render
   */
  public setKey(tonic: string, mode: string): void {
    this.currentKey = { tonic, mode };
    this.rerenderCurrentChart();
  }

  /**
   * Change tempo and re-render
   */
  public setTempo(bpm: number): void {
    this.currentBpm = bpm;
    this.rerenderCurrentChart();
  }

  /**
   * Example: Render a specific empty house for testing
   */
  public renderEmptyHouseExample(): void {
    const ctx = buildHouseContext(
      1, // House 1
      { houses: [{ number: 1, planets: [] }] },
      { startTime: 0, duration: 5 },
      this.currentGenre,
      this.rngSeed,
      this.currentKey,
      this.currentBpm,
      this.currentSwing,
      this.currentIntensity
    );

    const deps = {
      pool: this.instrumentPool,
      bus: this.masterBus,
      sched: this.scheduler
    };

    renderEmptyHouse(this.currentGenre, ctx, deps);
  }

  /**
   * Example: Test all genres for a house
   */
  public testAllGenres(): void {
    const genres: Genre[] = ['Classical', 'Jazz', 'Electronic', 'House', 'Lo-Fi', 'Ambient'];
    
    genres.forEach((genre, index) => {
      const ctx = buildHouseContext(
        1,
        { houses: [{ number: 1, planets: [] }] },
        { startTime: index * 5, duration: 5 },
        genre,
        this.rngSeed,
        this.currentKey,
        this.currentBpm,
        this.currentSwing,
        this.currentIntensity
      );

      const deps = {
        pool: this.instrumentPool,
        bus: this.masterBus,
        sched: this.scheduler
      };

      renderEmptyHouse(genre, ctx, deps);
    });
  }

  // Private helper methods (implement based on your audio system)

  private createInstrumentPool(): any {
    // Initialize your instrument pool
    // This should provide instruments like:
    // - strings_ensemble, timpani, violin_solo, cello
    // - upright_bass, jazz_kit, jazz_piano
    // - tr909, synth_pad_warm, pluck_synth
    // - house_kit, house_bass, noise_fx
    // - vinyl_noise, lofi_kit, rhodes
    // - pad_choir, pad_shimmer, bell_mallet
    return {
      get: (name: string) => {
        // Return instrument instance
        console.log(`Getting instrument: ${name}`);
        return { name, type: 'mock' };
      }
    };
  }

  private createMasterBus(): any {
    // Initialize your master bus for FX sends
    return {
      send: (source: any, destination: string, amount: number) => {
        console.log(`Sending ${source.name} to ${destination} at ${amount}`);
      },
      setReverb: (amount: number) => {
        console.log(`Setting reverb to ${amount}`);
      },
      setDelay: (amount: number) => {
        console.log(`Setting delay to ${amount}`);
      }
    };
  }

  private createScheduler(): any {
    // Initialize your scheduler
    return {
      note: (instrument: any, note: string, time: number, duration: number, opts: any) => {
        console.log(`Scheduling note: ${note} on ${instrument.name} at ${time}s for ${duration}s`, opts);
      },
      chord: (instrument: any, notes: string[], time: number, duration: number, opts: any) => {
        console.log(`Scheduling chord: ${notes.join(',')} on ${instrument.name} at ${time}s for ${duration}s`, opts);
      },
      drum: (kit: any, drum: string, time: number, opts: any) => {
        console.log(`Scheduling drum: ${drum} on ${kit.name} at ${time}s`, opts);
      },
      sample: (sample: any, time: number, duration: number, opts: any) => {
        console.log(`Scheduling sample: ${sample.name} at ${time}s for ${duration}s`, opts);
      }
    };
  }

  private renderPlanetMotifs(planets: string[], ctx: any, deps: any): void {
    // Your existing planetary motif rendering logic
    console.log(`Rendering motifs for planets: ${planets.join(', ')}`);
  }

  private rerenderCurrentChart(): void {
    // Re-render the current chart with new settings
    console.log('Re-rendering chart with new settings');
  }
}

// Usage example
export function exampleUsage(): void {
  const audioSystem = new AstradioAudioWithEmptyHouses();
  
  // Example chart data
  const chart = {
    houses: [
      { number: 1, planets: [] },      // Empty house
      { number: 2, planets: ['Sun'] }, // House with Sun
      { number: 3, planets: [] },      // Empty house
      { number: 4, planets: ['Moon'] }, // House with Moon
      { number: 5, planets: [] },      // Empty house
      { number: 6, planets: [] },      // Empty house
      { number: 7, planets: ['Mercury'] }, // House with Mercury
      { number: 8, planets: [] },      // Empty house
      { number: 9, planets: [] },      // Empty house
      { number: 10, planets: ['Venus'] }, // House with Venus
      { number: 11, planets: [] },     // Empty house
      { number: 12, planets: [] }      // Empty house
    ]
  };

  // Render the chart
  audioSystem.renderChart(chart, 60); // 60 seconds total

  // Change genre and re-render
  audioSystem.setGenre('Jazz');
  
  // Test all genres
  audioSystem.testAllGenres();
}
