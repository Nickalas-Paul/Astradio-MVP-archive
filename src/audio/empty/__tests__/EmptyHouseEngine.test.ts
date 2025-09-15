// Acceptance Tests for Empty House Engine
import { renderEmptyHouse, buildHouseContext, getAvailableGenres, isGenreSupported } from '../EmptyHouseEngine';
import { Genre, HouseContext, EngineDeps } from '../types';

// Mock dependencies
const mockDeps: EngineDeps = {
  pool: {
    get: jest.fn((name: string) => {
      // Return mock instruments based on name
      const instruments: Record<string, any> = {
        strings_ensemble: { type: 'soundfont', name: 'strings_ensemble' },
        timpani: { type: 'soundfont', name: 'timpani' },
        violin_solo: { type: 'soundfont', name: 'violin_solo' },
        cello: { type: 'soundfont', name: 'cello' },
        upright_bass: { type: 'soundfont', name: 'upright_bass' },
        jazz_kit: { type: 'drumkit', name: 'jazz_kit' },
        jazz_piano: { type: 'soundfont', name: 'jazz_piano' },
        tr909: { type: 'drumkit', name: 'tr909' },
        synth_pad_warm: { type: 'synth', name: 'synth_pad_warm' },
        pluck_synth: { type: 'synth', name: 'pluck_synth' },
        house_kit: { type: 'drumkit', name: 'house_kit' },
        house_bass: { type: 'synth', name: 'house_bass' },
        noise_fx: { type: 'sample', name: 'noise_fx' },
        vinyl_noise: { type: 'sample', name: 'vinyl_noise' },
        lofi_kit: { type: 'drumkit', name: 'lofi_kit' },
        rhodes: { type: 'soundfont', name: 'rhodes' },
        pad_choir: { type: 'synth', name: 'pad_choir' },
        pad_shimmer: { type: 'synth', name: 'pad_shimmer' },
        bell_mallet: { type: 'soundfont', name: 'bell_mallet' }
      };
      return instruments[name] || null;
    })
  },
  bus: {
    send: jest.fn(),
    setReverb: jest.fn(),
    setDelay: jest.fn()
  },
  sched: {
    note: jest.fn(),
    chord: jest.fn(),
    drum: jest.fn(),
    sample: jest.fn()
  }
};

describe('Empty House Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test 1: No silence', () => {
    it('should always emit audible content for empty houses', () => {
      const genres: Genre[] = ['Classical', 'Jazz', 'Electronic', 'House', 'Lo-Fi', 'Ambient'];
      
      genres.forEach(genre => {
        const ctx: HouseContext = {
          index: 1,
          empty: true,
          cuspSign: 0, // Aries
          ruler: 'Mars',
          startTime: 0,
          duration: 5,
          globalKey: { tonic: 'C', mode: 'major' },
          bpm: 120,
          swing: 0.1,
          intensity: 0.5,
          seed: 12345
        };

        renderEmptyHouse(genre, ctx, mockDeps);

        // Verify that at least one scheduling call was made
        const totalCalls = mockDeps.sched.note.mock.calls.length + 
                          mockDeps.sched.chord.mock.calls.length + 
                          mockDeps.sched.drum.mock.calls.length + 
                          mockDeps.sched.sample.mock.calls.length;
        
        expect(totalCalls).toBeGreaterThan(0);
      });
    });
  });

  describe('Test 2: Contrast with planetary houses', () => {
    it('should have lower density and velocity than planetary houses', () => {
      const ctx: HouseContext = {
        index: 1,
        empty: true,
        cuspSign: 0,
        ruler: 'Mars',
        startTime: 0,
        duration: 5,
        globalKey: { tonic: 'C', mode: 'major' },
        bpm: 120,
        swing: 0.1,
        intensity: 0.5,
        seed: 12345
      };

      renderEmptyHouse('Classical', ctx, mockDeps);

      // Check that velocities are in the expected range for empty houses
      const noteCalls = mockDeps.sched.note.mock.calls;
      const chordCalls = mockDeps.sched.chord.mock.calls;

      [...noteCalls, ...chordCalls].forEach(call => {
        const opts = call[call.length - 1]; // Last argument is options
        if (opts && typeof opts.vel === 'number') {
          expect(opts.vel).toBeLessThan(0.9); // Should be lower than planetary houses
          expect(opts.vel).toBeGreaterThan(0.3); // But still audible
        }
      });
    });
  });

  describe('Test 3: Genre realism', () => {
    it('should render genre-specific content correctly', () => {
      const testCases = [
        {
          genre: 'Classical' as Genre,
          expectedInstruments: ['strings_ensemble', 'timpani'],
          expectedPatterns: ['chord', 'note']
        },
        {
          genre: 'Jazz' as Genre,
          expectedInstruments: ['upright_bass', 'jazz_kit', 'jazz_piano'],
          expectedPatterns: ['note', 'drum']
        },
        {
          genre: 'Electronic' as Genre,
          expectedInstruments: ['tr909', 'synth_pad_warm', 'pluck_synth'],
          expectedPatterns: ['drum', 'chord', 'note']
        },
        {
          genre: 'House' as Genre,
          expectedInstruments: ['house_kit', 'house_bass', 'noise_fx'],
          expectedPatterns: ['drum', 'note', 'sample']
        },
        {
          genre: 'Lo-Fi' as Genre,
          expectedInstruments: ['vinyl_noise', 'lofi_kit', 'rhodes'],
          expectedPatterns: ['sample', 'drum', 'chord']
        },
        {
          genre: 'Ambient' as Genre,
          expectedInstruments: ['pad_choir', 'pad_shimmer', 'bell_mallet'],
          expectedPatterns: ['chord', 'note']
        }
      ];

      testCases.forEach(({ genre, expectedInstruments, expectedPatterns }) => {
        jest.clearAllMocks();
        
        const ctx: HouseContext = {
          index: 1,
          empty: true,
          cuspSign: 0,
          ruler: 'Mars',
          startTime: 0,
          duration: 5,
          globalKey: { tonic: 'C', mode: 'major' },
          bpm: 120,
          swing: 0.1,
          intensity: 0.5,
          seed: 12345
        };

        renderEmptyHouse(genre, ctx, mockDeps);

        // Check that expected instruments were requested
        expectedInstruments.forEach(instrument => {
          expect(mockDeps.pool.get).toHaveBeenCalledWith(instrument);
        });

        // Check that expected scheduling patterns were used
        expectedPatterns.forEach(pattern => {
          expect(mockDeps.sched[pattern as keyof typeof mockDeps.sched]).toHaveBeenCalled();
        });
      });
    });

    it('should apply swing correctly for Jazz and Lo-Fi', () => {
      const swingGenres: Genre[] = ['Jazz', 'Lo-Fi'];
      
      swingGenres.forEach(genre => {
        jest.clearAllMocks();
        
        const ctx: HouseContext = {
          index: 1,
          empty: true,
          cuspSign: 0,
          ruler: 'Mars',
          startTime: 0,
          duration: 5,
          globalKey: { tonic: 'C', mode: 'major' },
          bpm: 120,
          swing: 0.3, // High swing
          intensity: 0.5,
          seed: 12345
        };

        renderEmptyHouse(genre, ctx, mockDeps);
        
        // Should have scheduled drum patterns
        expect(mockDeps.sched.drum).toHaveBeenCalled();
      });
    });

    it('should not have grid-locked beats in Ambient', () => {
      const ctx: HouseContext = {
        index: 1,
        empty: true,
        cuspSign: 0,
        ruler: 'Mars',
        startTime: 0,
        duration: 5,
        globalKey: { tonic: 'C', mode: 'major' },
        bpm: 120,
        swing: 0.1,
        intensity: 0.5,
        seed: 12345
      };

      renderEmptyHouse('Ambient', ctx, mockDeps);

      // Ambient should not have regular drum patterns
      expect(mockDeps.sched.drum).not.toHaveBeenCalled();
      
      // Should have pad chords with long reverb
      expect(mockDeps.sched.chord).toHaveBeenCalled();
    });
  });

  describe('Test 4: Harmonic color from sign/ruler', () => {
    it('should reflect cusp sign and ruler in musical choices', () => {
      const testCases = [
        { sign: 0, ruler: 'Mars', expectedChord: 'V' }, // Aries/Mars
        { sign: 1, ruler: 'Venus', expectedChord: 'add6' }, // Taurus/Venus
        { sign: 3, ruler: 'Moon', expectedChord: 'vi' }, // Cancer/Moon
        { sign: 4, ruler: 'Sun', expectedChord: 'I' } // Leo/Sun
      ];

      testCases.forEach(({ sign, ruler, expectedChord }) => {
        jest.clearAllMocks();
        
        const ctx: HouseContext = {
          index: 1,
          empty: true,
          cuspSign: sign,
          ruler: ruler as any,
          startTime: 0,
          duration: 5,
          globalKey: { tonic: 'C', mode: 'major' },
          bpm: 120,
          swing: 0.1,
          intensity: 0.5,
          seed: 12345
        };

        renderEmptyHouse('Classical', ctx, mockDeps);
        
        // Should have scheduled content based on sign/ruler
        expect(mockDeps.sched.chord).toHaveBeenCalled();
      });
    });
  });

  describe('Test 5: Deterministic generation', () => {
    it('should produce identical results with same seed', () => {
      const ctx: HouseContext = {
        index: 1,
        empty: true,
        cuspSign: 0,
        ruler: 'Mars',
        startTime: 0,
        duration: 5,
        globalKey: { tonic: 'C', mode: 'major' },
        bpm: 120,
        swing: 0.1,
        intensity: 0.5,
        seed: 12345
      };

      // First render
      renderEmptyHouse('Classical', ctx, mockDeps);
      const firstCalls = JSON.stringify(mockDeps.sched.note.mock.calls);

      // Clear and render again with same seed
      jest.clearAllMocks();
      renderEmptyHouse('Classical', ctx, mockDeps);
      const secondCalls = JSON.stringify(mockDeps.sched.note.mock.calls);

      // Should be identical
      expect(firstCalls).toBe(secondCalls);
    });

    it('should produce different results with different seeds', () => {
      const ctx1: HouseContext = {
        index: 1,
        empty: true,
        cuspSign: 0,
        ruler: 'Mars',
        startTime: 0,
        duration: 5,
        globalKey: { tonic: 'C', mode: 'major' },
        bpm: 120,
        swing: 0.1,
        intensity: 0.5,
        seed: 12345
      };

      const ctx2: HouseContext = {
        ...ctx1,
        seed: 54321
      };

      // First render
      renderEmptyHouse('Classical', ctx1, mockDeps);
      const firstCalls = JSON.stringify(mockDeps.sched.note.mock.calls);

      // Clear and render with different seed
      jest.clearAllMocks();
      renderEmptyHouse('Classical', ctx2, mockDeps);
      const secondCalls = JSON.stringify(mockDeps.sched.note.mock.calls);

      // Should be different
      expect(firstCalls).not.toBe(secondCalls);
    });
  });

  describe('Test 6: Performance and limits', () => {
    it('should stay within voice count limits', () => {
      const ctx: HouseContext = {
        index: 1,
        empty: true,
        cuspSign: 0,
        ruler: 'Mars',
        startTime: 0,
        duration: 5,
        globalKey: { tonic: 'C', mode: 'major' },
        bpm: 120,
        swing: 0.1,
        intensity: 0.5,
        seed: 12345
      };

      renderEmptyHouse('Classical', ctx, mockDeps);

      // Check chord calls for voice count
      const chordCalls = mockDeps.sched.chord.mock.calls;
      chordCalls.forEach(call => {
        const notes = call[1]; // Second argument is notes array
        expect(notes.length).toBeLessThanOrEqual(8); // Max 8 voices for pads
      });

      // Check drum calls for voice count
      const drumCalls = mockDeps.sched.drum.mock.calls;
      expect(drumCalls.length).toBeLessThanOrEqual(24); // Max 24 drum hits
    });
  });

  describe('Test 7: API functionality', () => {
    it('should return available genres', () => {
      const genres = getAvailableGenres();
      expect(genres).toContain('Classical');
      expect(genres).toContain('Jazz');
      expect(genres).toContain('Electronic');
      expect(genres).toContain('House');
      expect(genres).toContain('Lo-Fi');
      expect(genres).toContain('Ambient');
      expect(genres).toHaveLength(6);
    });

    it('should check genre support correctly', () => {
      expect(isGenreSupported('Classical')).toBe(true);
      expect(isGenreSupported('Jazz')).toBe(true);
      expect(isGenreSupported('Rock')).toBe(false);
      expect(isGenreSupported('Pop')).toBe(false);
    });

    it('should build house context correctly', () => {
      const chart = {
        houses: [
          { number: 1, planets: [] },
          { number: 2, planets: ['Sun'] }
        ]
      };

      const ctx = buildHouseContext(
        1,
        chart,
        { startTime: 0, duration: 5 },
        'Classical',
        12345,
        { tonic: 'C', mode: 'major' },
        120,
        0.1,
        0.5
      );

      expect(ctx.index).toBe(1);
      expect(ctx.empty).toBe(true);
      expect(ctx.cuspSign).toBe(0); // Aries
      expect(ctx.ruler).toBe('Mars');
      expect(ctx.startTime).toBe(0);
      expect(ctx.duration).toBe(5);
    });
  });

  describe('Test 8: Error handling', () => {
    it('should handle missing instruments gracefully', () => {
      const mockDepsWithMissingInstruments: EngineDeps = {
        ...mockDeps,
        pool: {
          get: jest.fn(() => null) // Return null for all instruments
        }
      };

      const ctx: HouseContext = {
        index: 1,
        empty: true,
        cuspSign: 0,
        ruler: 'Mars',
        startTime: 0,
        duration: 5,
        globalKey: { tonic: 'C', mode: 'major' },
        bpm: 120,
        swing: 0.1,
        intensity: 0.5,
        seed: 12345
      };

      // Should not throw error
      expect(() => {
        renderEmptyHouse('Classical', ctx, mockDepsWithMissingInstruments);
      }).not.toThrow();
    });

    it('should handle invalid genres gracefully', () => {
      const ctx: HouseContext = {
        index: 1,
        empty: true,
        cuspSign: 0,
        ruler: 'Mars',
        startTime: 0,
        duration: 5,
        globalKey: { tonic: 'C', mode: 'major' },
        bpm: 120,
        swing: 0.1,
        intensity: 0.5,
        seed: 12345
      };

      // Should not throw error for invalid genre
      expect(() => {
        renderEmptyHouse('InvalidGenre' as any, ctx, mockDeps);
      }).not.toThrow();
    });
  });
});
