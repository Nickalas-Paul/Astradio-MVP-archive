# Narrative Engine Integration Guide

## Overview

This guide provides recommendations for integrating the upgraded rulesets outlined in the prompt to create more melodic and thematic 60-second compositions across all four modes (House Order, Cluster, Elemental, Lunar) and six genres.

## Current State Analysis ✅

The codebase already has a solid foundation:

- ✅ **NarrativeEngine.ts** - Implements universal 60-second narrative approach
- ✅ **ContextEvaluator.ts** - Has ruler interval habits, aspect motifs, element phrasing, lunar effects
- ✅ **SegmentRenderer.ts** - Handles musical segment generation
- ✅ **GenrePresets.ts** - 6 genre configurations (Classical, Jazz, Electronic, Lo-Fi, House, Ambient)
- ✅ **PlanetMotifs.ts** - Planet-specific musical characteristics
- ✅ **EmptyHouseEngine.ts** - Handles empty houses (addressing the requirement for every house to produce audio)

## Key Integration Recommendations

### 1. **Enhanced Seed Motif Generation** ✅ IMPLEMENTED

**Location**: `src/audio/narrative/NarrativeEngine.ts` - `generateSeedMotif()`

**Improvements Made**:
- **Sun+Moon + Tightest Aspect**: Now properly calculates the tightest aspect between planets and uses it to shape the motif
- **Aspect-Specific Patterns**: 
  - Conjunction: Unison/doubling with emphasized rhythm
  - Opposition: Call-response pattern
  - Trine: Arpeggio sweep with flowing rhythm
  - Square: Syncopated jab with syncopated rhythm
  - Sextile: Grace notes with grace note rhythm
- **Enhanced Sun-Moon Relationship**: Analyzes interval distance to create appropriate motifs
- **Energy Calculation**: Based on aspect strength (tighter orbs = higher energy)

**Usage**:
```typescript
const motif = narrativeEngine.generateSeedMotif();
// Returns: { notes: [60, 64, 67, 71], contour: 'rising', rhythm: [1, 1, 1, 1], energy: 0.8 }
```

### 2. **Improved Aspect Finding Algorithm** ✅ IMPLEMENTED

**Location**: `src/audio/narrative/NarrativeEngine.ts` - `findTightestAspect()`

**Improvements Made**:
- **Real Aspect Calculation**: Calculates actual aspects between all planet pairs
- **Proper Orb Handling**: Uses traditional orbs (Conjunction: 8°, Opposition: 7°, Trine: 6°, etc.)
- **Tightest Aspect Selection**: Returns the aspect with the smallest orb for strongest influence

**Aspect Types Supported**:
- Conjunction (0° ± 8°)
- Opposition (180° ± 7°)
- Trine (120° ± 6°)
- Square (90° ± 6°)
- Sextile (60° ± 5°)

### 3. **Enhanced Melody Thread Evolution** ✅ IMPLEMENTED

**Location**: `src/audio/narrative/NarrativeEngine.ts` - `evolveMelodyThread()`

**Improvements Made**:
- **Ruler Interval Habits**: Each planet ruler influences interval choices
  - Sun: Up-arc intervals (0, 7, 12)
  - Moon: Oscillation intervals (0, 3, 7, 10)
  - Mercury: Quick steps (0, 2, 4, 7, 9, 11)
  - Venus: Stepwise smooth (0, 4, 7, 11, 14)
  - Mars: Leaps (0, 5, 8, 12)
  - Jupiter: Wide jumps (0, 4, 7, 11, 14, 17)
  - Saturn: Repeated tones/descending (0, 7, 12)
  - Uranus: Surprise leaps (0, 6, 10, 15)
  - Neptune: Unresolved tones (0, 2, 4, 6, 8, 10)
  - Pluto: Long sustains/sudden rests (0, 1, 3, 6, 9)

- **Aspect Micro-Motifs**: Injects small motifs based on active aspects
- **Element Phrasing**: Influences density and articulation
- **Lunar Phase Effects**: Modifies phrase length and cadence behavior

### 4. **Enhanced Cadence Planning** ✅ IMPLEMENTED

**Location**: `src/audio/narrative/NarrativeEngine.ts` - `planCadences()`

**Improvements Made**:
- **Small Cadences**: At 20s and 40s as specified in prompt
- **Major Cadence**: At 60s or Full/New Moon time
- **Conflict Resolution**: Adjusts cadence timing to avoid conflicts
- **Cadence Types**: Authentic, Plagal, or Deceptive based on lunar phase

### 5. **Mode-Specific Path Building** ✅ IMPLEMENTED

**Location**: `src/audio/narrative/NarrativeEngine.ts` - Path building methods

**House Order Mode**:
- Path = [1..12], each 5s
- Ruler of each house shapes that 5s segment

**Cluster Mode**:
- Finds planetary clusters by orb
- Weight duration by cluster mass
- Fill remaining time with nearest houses

**Elemental Mode**:
- Groups placements by element
- Orders elements by dominance
- Divides 60s proportionally

**Lunar Clock Mode**:
- Slices 60s into 8 lunar phases
- Waxing parts lengthen phrases and lift contour
- Waning parts tighten phrases and lower contour

## Integration Steps

### Step 1: Update Type Definitions

Ensure the following types are properly defined:

```typescript
// In types/astro.d.ts - Add if missing:
export interface AspectData {
  type: string;
  target: string;
  angle: number;
  orb: number;
}

// In src/audio/narrative/NarrativeEngine.ts - Already defined:
export interface SeedMotif {
  notes: number[];
  contour: 'rising' | 'falling' | 'oscillating' | 'static';
  rhythm: number[];
  energy: number;
}
```

### Step 2: Enhance Context Evaluation

The `ContextEvaluator.ts` already has most of the required functionality. Ensure these methods are properly implemented:

- `getRulerIntervalHabits()` - ✅ Implemented
- `getAspectMotif()` - ✅ Implemented  
- `getElementPhrasing()` - ✅ Implemented
- `getLunarPhaseEffects()` - ✅ Implemented

### Step 3: Update Segment Rendering

The `SegmentRenderer.ts` should be enhanced to use the new context evaluation:

```typescript
// In SegmentRenderer.ts - renderSegment()
const contextEvaluator = new ContextEvaluator(chart);
const rulerHabits = contextEvaluator.getRulerIntervalHabits(context.ruler);
const elementPhrasing = contextEvaluator.getElementPhrasing(context.element);
const lunarEffects = contextEvaluator.getLunarPhaseEffects(context.lunarPhase);
```

### Step 4: Integrate with Empty House Engine

The `EmptyHouseEngine.ts` should be updated to use the narrative approach:

```typescript
// In EmptyHouseEngine.ts - renderEmptyHouse()
export function renderEmptyHouse(genre: Genre, ctx: HouseContext, deps: EngineDeps) {
  // Use narrative engine for empty houses
  const narrativeEngine = new NarrativeEngine(chart, 'house-order', genre);
  const narrative = await narrativeEngine.generateNarrative();
  
  // Find the specific house segment
  const houseSegment = narrative.timeline.find(segment => 
    segment.id === `house-${ctx.index}`
  );
  
  if (houseSegment) {
    // Render the segment using existing infrastructure
    const segmentRenderer = new SegmentRenderer(contextEvaluator, genre, narrative.globalScale);
    const musicalSegment = segmentRenderer.renderSegment(houseSegment, narrative.melodyThread);
    
    // Schedule the musical segment
    scheduleMusicalSegment(musicalSegment, deps);
  }
}
```

## Testing and Validation

### Test Cases

1. **Seed Motif Generation**:
   ```typescript
   const chart = { positions: { Sun: { lon: 45 }, Moon: { lon: 135 } } };
   const engine = new NarrativeEngine(chart, 'house-order', 'ambient');
   const motif = engine.generateSeedMotif();
   // Should return motif with 2-4 notes based on Sun-Moon relationship
   ```

2. **Aspect Calculation**:
   ```typescript
   const chart = { positions: { Sun: { lon: 45 }, Mars: { lon: 135 } } };
   const engine = new NarrativeEngine(chart, 'house-order', 'ambient');
   const aspect = engine.findTightestAspect();
   // Should return opposition aspect with orb calculation
   ```

3. **60-Second Validation**:
   ```typescript
   const narrative = await engine.generateNarrative();
   const totalDuration = narrative.timeline.reduce((sum, stop) => sum + stop.duration, 0);
   // Should equal 60 seconds
   ```

### Expected Output

The enhanced system should produce:

1. **Melodic Coherence**: A single melody thread that evolves across all stops
2. **Thematic Development**: Motifs that grow and transform based on astrological influences
3. **60-Second Narratives**: Complete compositions that tell a musical story
4. **Mode-Specific Behavior**: Different path structures for each mode while maintaining the same core engine
5. **Genre Integration**: Proper genre-specific orchestration and styling

## Performance Considerations

1. **Caching**: Cache aspect calculations and ruler habits for performance
2. **Lazy Loading**: Load audio assets only when needed
3. **Memory Management**: Clean up unused audio contexts and buffers
4. **Real-time Generation**: Optimize for real-time composition generation

## Future Enhancements

1. **Advanced Harmony**: Implement more sophisticated chord progressions
2. **Rhythm Generation**: Add genre-specific rhythm patterns
3. **Dynamic Tempo**: Vary tempo based on astrological intensity
4. **Multi-layered Composition**: Add counterpoint and secondary voices
5. **Real-time Modulation**: Allow for dynamic key and mode changes

## Conclusion

The enhanced narrative engine successfully implements the universal approach outlined in the prompt:

- ✅ **Universal Engine**: One core engine drives all four modes
- ✅ **Seed Motif**: Sun+Moon + tightest aspect creates 2-4 note cells
- ✅ **Global Scale**: Chart tonality determines scale
- ✅ **Narrative Path**: Ordered stops with durations summing to 60s
- ✅ **Melody Thread**: Continuous evolution across stops
- ✅ **Cadence Planning**: Small cadences at 20s/40s, major at 60s
- ✅ **Mode-Specific Paths**: Different path builders for each mode

This implementation creates melodic, thematic 60-second compositions that users will enjoy, with every house wheel segment producing audio regardless of planetary placements.
