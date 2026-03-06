# Phase 8 Sandbox UX/Input Contract — Audit Note & Implementation Plan

**Date:** 2026-03-06  
**Scope:** Sandbox only. No Phase 9 polish. Minimal changes for closed-beta usability.

---

## 1. Current Sandbox State Machine

| State | Condition | UI |
|-------|-----------|-----|
| `idle` | birth=null | Birth form (date, time, lat, lon); empty placeholder |
| `loading_base` | birth submitted, snapshot pending | "Loading chart..." |
| `ready_builder` | snapshot loaded | Wheel + DegreePanel + Generate |
| `syncing_overrides` | override change, snapshot debounce | Wheel + "Updating..." |
| `ready_report` | snapshot synced | Same as ready_builder |
| `generating` | Generate clicked | Loading states |
| `error` | API failure | Error message + Reset |

**Flow:** Single path — birth first → wheel → edit planets → generate.

---

## 2. New States/Modes Required

### Mode A: Birth-first (existing, enhanced)
- User selects mode "Birth-first"
- User enters date, time, **location** (city/region/country via geocode)
- Geocode resolves to lat/lon; fail closed if geocode fails
- Submit → snapshot → wheel → edit → generate

### Mode B: Free-build (new)
- User selects mode "Free-build"
- User sees blank wheel (no houses or equal-house reference with explicit label)
- User places planets via drag or DegreePanel
- **Generate disabled** until birth data exists — explicit message: "Add birth data (date, time, location) to generate report and audio."
- When user adds birth data later → snapshot with overrides → generate enabled

### State machine additions
- `mode`: `'birth_first' | 'free_build'`
- `free_build_idle`: mode=free_build, birth=null, overrides may have planets
- `free_build_with_birth`: mode=free_build, birth set, snapshot loaded — same as ready_builder

---

## 3. API/Contract Changes

### No backend changes required
- `POST /api/sandbox/snapshot` — requires birth (date, time, lat, lon). Unchanged.
- `POST /api/sandbox/report` — requires birth. Unchanged.
- `POST /api/compose` — requires overriddenSnapshot from snapshot. Unchanged.

### Free-build engine contract
- **Without birth:** Cannot call snapshot/report/compose. No engine support for overrides-only.
- **With birth:** Same as birth-first. Overrides applied to base snapshot.
- **Houses in free-build UI:** Use equal-house (0,30,60,...) as **display-only reference** with label: "Equal house (reference). Add birth data for actual house positions." Never passed to engine as birth-derived.

---

## 4. Can Free-build Generate Report/Audio Before Birth?

**No.** The architecture engine requires EphemerisSnapshot with houses. Houses come from birth geometry (Swiss Ephemeris). Without birth, we cannot produce a truthful snapshot.

**Fail-closed behavior:** Generate button disabled. Message: "Add birth data (date, time, location) to generate report and audio."

---

## 5. What Must Be Disabled Until Birth Exists

| Feature | Birth-first | Free-build (no birth) |
|---------|-------------|------------------------|
| Wheel display | After birth submit | Immediately (overrides only) |
| Planet drag | Yes | Yes |
| DegreePanel | Yes | Yes |
| Generate | After snapshot | **Disabled** |
| Save | After generate | **Disabled** |
| Report | After generate | **Disabled** |
| Audio | After generate | **Disabled** |

---

## 6. Implementation Checklist

1. **Location finder** — Replace lat/lon inputs with LocationFinder (geocode autocomplete). Advanced disclosure for manual lat/lon.
2. **Mode selector** — Radio/tabs: Birth-first | Free-build. At top of Sandbox.
3. **BirthDataForm** — Use LocationFinder. Geocode on selection. Fail closed on geocode error.
4. **WheelCanvasBuilder** — Support `snapshot=null` when mode=free_build: build display from overrides + equal-house reference (labeled).
5. **Free-build planet palette** — When no planets placed, show planet glyphs to add. Or rely on DegreePanel (already supports adding by degree).
6. **Generate guard** — In free-build without birth: disabled + explicit message.
7. **Constrain-to-house** — In free-build without birth: N/A (no real houses). When constrainToHouse=true and we have equal-house reference, allow full 360° drag (constrain makes no sense without real houses).
8. **Planet placement UX** — Ensure drag is primary. DegreePanel secondary. Add sign labels on wheel when dragging (optional, minimal).
