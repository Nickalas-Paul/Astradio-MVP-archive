# MIDI Library Selection - Lock-in Documentation

**Date:** 2026-02-05  
**Status:** ✅ Locked - @tonejs/midi is the ONLY MIDI library

---

## Policy (Non-Negotiable)

- **Use `@tonejs/midi` as the ONLY MIDI library.**
- Do NOT introduce MidiWriterJS, custom MIDI encoders, or any alternative MIDI abstractions.
- MIDI is a deterministic serialization of the canonical Plan, not a generative or interpretive layer.

---

## Implementation

### Library: `@tonejs/midi` v2.0.28

**Location:** `vnext/midi/plan-to-midi.ts`

**Usage:**
```typescript
import { Midi } from '@tonejs/midi';

const midi = new Midi(); // PPQ defaults to 480
midi.header.setTempo(plan.bpm);
const track = midi.addTrack();
track.name = channel; // Stable track naming
track.addNote({ midi: pitch, ticks: startTicks, durationTicks, velocity });
const midiBytes = midi.toArray(); // Uint8Array
```

### Encoding Rules (Locked)

- **PPQ:** 480 (fixed, do not change)
- **Tempo:** Derived strictly from `plan.bpm` via `midi.header.setTempo(plan.bpm)`
- **Pitch:** `Plan.pitch` → MIDI note number directly (clamped 0-127)
- **Velocity:** `Plan.velocity ∈ [0,1]` → MIDI velocity `∈ [1,127]` via:
  ```typescript
  velocity_midi = clamp(round(plan.velocity * 127), 1, 127)
  velocity_normalized = velocity_midi / 127  // @tonejs/midi expects 0-1
  ```
- **Timing:** Convert `plan.t0` / `plan.t1` (seconds) → MIDI ticks using `bpm + PPQ`:
  ```typescript
  ticks = round(seconds * (bpm / 60) * PPQ)
  ```
  Uses canonical rounding (1ms precision) from plan hashing.
- **Tracks:** One deterministic track per `Plan.channel`:
  - Track naming: stable and predictable (e.g. "melody", "harmony", "bass", "rhythm")
  - Track order: `['melody', 'harmony', 'bass', 'rhythm']` (deterministic)
- **Event order:** Follows canonical Plan event ordering (same as plan hashing)

### Artifact Output

```typescript
artifacts.midi = {
  base64: string,      // Base64-encoded MIDI bytes
  sha256: string,     // SHA256 of raw MIDI bytes (before base64)
  ppq: 480,           // Fixed PPQ
  tracks: number,     // Number of tracks created
  bytes: number       // Size of MIDI file in bytes
}
```

**SHA256 computation:** From raw MIDI bytes (before base64 encoding) to ensure determinism.

### Gating

MIDI artifact is **OPTIONAL** and gated behind:
- `includeMidi=1` query flag in `ComposeRequest`, OR
- `ENABLE_MIDI_EXPORT=1` server environment variable

---

## Testing

**Test:** `npm run test:midi-determinism`

Asserts:
- Same plan → same MIDI SHA256
- Same plan → same MIDI base64
- Different plan → different MIDI SHA256
- MIDI has valid header (MThd)
- PPQ is 480 (fixed)
- MIDI structure (tracks, bytes) is valid

**Fixture:** Fixed Plan with known events → deterministic MIDI output.

---

## Constraints

- **Backend only:** MIDI export implemented in backend (`vnext/midi/plan-to-midi.ts`)
- **Frontend:** Must NOT generate MIDI
- **Derived exclusively:** MIDI must be derived from canonical Plan returned by engine
- **No alternatives:** Do NOT add MidiWriterJS, custom encoders, or other MIDI libraries

---

## Dependencies

**package.json:**
```json
{
  "dependencies": {
    "@tonejs/midi": "^2.0.28"
  }
}
```

**Do NOT:**
- Upgrade without explicit approval
- Substitute with other MIDI libraries
- Wrap or abstract @tonejs/midi

---

*MIDI library selection locked. Implementation complete.*
