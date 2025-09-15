# Empty House Logic System

The Empty House Logic System provides musical fallback content when astrological houses contain no planets. Instead of silence, it renders genre-specific background music, transitions, and pacing that maintains harmonic context and musical flow.

## Architecture

```
/src/audio/empty/
├── types.ts                    # Core type definitions
├── EmptyHouseEngine.ts         # Main engine and entry point
├── index.ts                    # Public exports
├── color/
│   └── SignColor.ts           # Astrological sign/ruler to musical mapping
├── utils/
│   └── density.ts             # Density and velocity utilities
├── behaviors/
│   ├── classical.ts           # Orchestral phrases and cadences
│   ├── jazz.ts               # Walking bass and ride patterns
│   ├── electronic.ts         # Four-on-floor and arpeggios
│   ├── house.ts              # DJ breaks and builds
│   ├── lofi.ts               # Dusty loops and Rhodes chords
│   └── ambient.ts            # Texture pads and swells
└── __tests__/
    └── EmptyHouseEngine.test.ts # Acceptance tests
```

## Core Concepts

### House Context
Each empty house is rendered with a `HouseContext` that includes:
- **Astrological data**: cusp sign, ruler planet, house index
- **Musical context**: global key, tempo, swing, intensity
- **Timing**: start time, duration (typically 5 seconds)
- **Deterministic seed**: for consistent generation

### Sign/Ruler Color System
Astrological signs and their ruling planets map to musical characteristics:
- **Chord qualities**: Venus → add6/sus2, Mars → V, etc.
- **Filter settings**: high-pass cutoff, brightness
- **Effects**: reverb send, ornamentation types
- **Timbre choices**: warm vs bright, transient vs sustained

### Genre Behaviors
Each genre has a specific musical approach for empty houses:

#### Classical
- Sustained strings pads with chord progressions
- Optional timpani cadences every 3rd house
- Voice-leading V→I mini-cadences
- Grace note ornamentation

#### Jazz
- Walking bass lines with ii-V-I turnarounds
- Ride cymbal patterns with swing
- Sparse piano comping (shell voicings)
- Brush snare backbeats

#### Electronic
- Four-on-floor drum patterns
- Sidechained pad sweeps
- Gated arpeggios with tempo delay
- Filter automation

#### House
- DJ-style groove patterns
- Bass ostinatos
- Riser noise sweeps
- Snare roll builds for transitions

#### Lo-Fi
- Vinyl noise beds
- Lazy drum patterns with swing
- Rhodes chords with spread voicings
- Wow/flutter effects

#### Ambient
- Layered pad swells
- No grid-locked rhythm
- Granular processing
- Bell accents

## Usage

### Basic Integration

```typescript
import { renderEmptyHouse, buildHouseContext } from './audio/empty';

// In your per-house render loop
for (const house of houses) {
  const ctx = buildHouseContext(
    house.number,
    chart,
    { startTime: currentTime, duration: 5 },
    genre,
    seed,
    globalKey,
    bpm,
    swing,
    intensity
  );
  
  if (house.planets.length === 0) {
    renderEmptyHouse(genre, ctx, deps);
  } else {
    renderPlanetMotifs(house.planets, ctx, deps);
  }
}
```

### Advanced Integration

```typescript
import { renderHouses } from './audio/empty';

// Complete house rendering with empty house logic
renderHouses(
  houses,
  chart,
  timing,
  genre,
  seed,
  globalKey,
  bpm,
  swing,
  intensity,
  deps,
  renderPlanetMotifs
);
```

### Direct Behavior Usage

```typescript
import { classical, jazz, electronic } from './audio/empty/behaviors';

// Use specific behaviors directly
classical(ctx, deps);
jazz(ctx, deps);
electronic(ctx, deps);
```

## API Reference

### Core Functions

#### `renderEmptyHouse(genre, ctx, deps)`
Main function to render empty house content.

**Parameters:**
- `genre`: Genre type ("Classical" | "Jazz" | "Electronic" | "House" | "Lo-Fi" | "Ambient")
- `ctx`: HouseContext with astrological and musical data
- `deps`: EngineDeps with pool, bus, and scheduler

#### `buildHouseContext(houseIndex, chart, timing, genre, seed, globalKey, bpm, swing, intensity)`
Builds a HouseContext from raw data.

**Returns:** HouseContext object

#### `getAvailableGenres()`
Returns array of supported genres.

#### `isGenreSupported(genre)`
Checks if a genre is supported.

### Types

#### `HouseContext`
```typescript
interface HouseContext {
  index: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  empty: boolean;
  cuspSign: number;           // 0-11 (Aries-Pisces)
  ruler: PlanetName;
  startTime: number;
  duration: number;
  globalKey: { tonic: string; mode: string };
  bpm: number;
  swing: number;
  intensity: number;
  seed: number;
}
```

#### `EngineDeps`
```typescript
interface EngineDeps {
  pool: InstrumentPool;       // get("instrument_name")
  bus: MasterBus;            // FX sends
  sched: Scheduler;          // schedule(note|chord|drum, time, opts)
}
```

#### `SignColor`
```typescript
interface SignColor {
  chord: "I" | "ii" | "iii" | "IV" | "V" | "vi" | "bVII" | "sus2" | "sus4" | "add6" | "min7" | "dim";
  padCutHz: number;
  brightness: number;
  reverbSend: number;
  ornaments: "none" | "mordent" | "turn" | "grace";
}
```

## Instrument Requirements

The system expects these instruments to be available in the pool:

### Classical
- `strings_ensemble` - String section pad
- `timpani` - Timpani drums
- `violin_solo` - Solo violin
- `cello` - Cello

### Jazz
- `upright_bass` - Acoustic bass
- `jazz_kit` - Jazz drum kit
- `jazz_piano` - Jazz piano

### Electronic
- `tr909` - TR-909 drum machine
- `synth_pad_warm` - Warm synth pad
- `pluck_synth` - Pluck synth

### House
- `house_kit` - House drum kit
- `house_bass` - House bass synth
- `noise_fx` - Noise samples

### Lo-Fi
- `vinyl_noise` - Vinyl crackle samples
- `lofi_kit` - Lo-fi drum kit
- `rhodes` - Rhodes electric piano

### Ambient
- `pad_choir` - Choir pad
- `pad_shimmer` - Shimmer pad
- `bell_mallet` - Bell mallet

## Acceptance Tests

The system includes comprehensive acceptance tests covering:

1. **No silence**: Empty houses always emit audible content
2. **Contrast**: Lower density/velocity than planetary houses
3. **Genre realism**: Genre-specific instruments and patterns
4. **Harmonic color**: Sign/ruler influences musical choices
5. **Deterministic**: Same seed produces identical results
6. **Performance**: Voice counts within limits
7. **API functionality**: All public functions work correctly
8. **Error handling**: Graceful handling of missing instruments

Run tests with:
```bash
npm test src/audio/empty/__tests__/EmptyHouseEngine.test.ts
```

## Design Principles

### Never Silence
Empty houses always render low-density but audible content to maintain musical flow.

### Harmonic Context
All content respects the global key and derives harmonic color from astrological data.

### Genre Authenticity
Each genre behavior produces musically authentic content using appropriate instruments and patterns.

### Deterministic Generation
All choices are deterministic based on the seed, ensuring consistent results.

### Performance Conscious
Voice counts and processing are kept within reasonable limits for real-time performance.

### Modular Design
Behaviors are independent and can be easily extended or modified.

## Extension

To add a new genre:

1. Create a new behavior file in `behaviors/`
2. Implement the `Behavior` type signature
3. Add to the `BEHAVIOR_MAP` in `EmptyHouseEngine.ts`
4. Add tests in the acceptance test suite
5. Document required instruments

Example new genre:
```typescript
// behaviors/rock.ts
export const rock: Behavior = (ctx, deps) => {
  // Implement rock-specific empty house logic
  // Power chords, rock drums, etc.
};
```
