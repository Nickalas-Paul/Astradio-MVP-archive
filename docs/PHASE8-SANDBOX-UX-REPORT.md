# Phase 8 Sandbox UX/Input Contract — Final Report

**Date:** 2026-03-06  
**Scope:** Sandbox only. No Phase 9 polish. Minimal changes for closed-beta usability.

---

## Files Changed

| File | Change |
|------|--------|
| `docs/PHASE8-SANDBOX-UX-AUDIT.md` | **New.** Implementation plan and audit note |
| `docs/PHASE8-SANDBOX-UX-REPORT.md` | **New.** This final report |
| `apps/web/src/components/sandbox/LocationFinder.tsx` | **New.** Geocode autocomplete for city/state/country |
| `apps/web/src/components/sandbox/BirthDataForm.tsx` | **Replaced.** LocationFinder primary; Advanced disclosure for manual lat/lon |
| `apps/web/src/components/sandbox/WheelCanvasBuilder.tsx` | **Updated.** freeBuild mode; click-to-place; equal-house reference label |
| `apps/web/app/sandbox/page.tsx` | **Updated.** Mode selector (Birth-first | Free-build); free-build layout; preserve overrides when adding birth |

---

## Exact Behavior Now Supported

### 1. Location Input
- **Primary:** City, State, Country style input with geocode autocomplete
- **Geocode:** Uses existing `/api/geocode?q=...` (Nominatim via engine)
- **Fail closed:** If user submits without selecting a location, explicit error: "Select a location from the search results, or use Advanced to enter coordinates"
- **Advanced:** Collapsible disclosure for manual latitude/longitude entry
- **Deterministic:** Resolved coordinates passed to backend; canonical snapshot contract unchanged

### 2. Two Entry Modes

**Mode A: Birth-first**
- User selects "Birth-first"
- User enters date, time, location (geocode)
- Submit → snapshot → wheel with natal positions
- User may override planets via drag or DegreePanel
- Generate enabled when snapshot loaded

**Mode B: Free-build**
- User selects "Free-build"
- Blank wheel with equal-house reference (labeled)
- User places planets: click on wheel or type degrees in panel
- Generate **disabled** until birth data added — explicit message: "Add birth data (date, time, location) to generate report and audio."
- User may add birth data at any time; overrides preserved and applied to base snapshot

### 3. Planet Editing UX
- **Click-to-place:** In free-build, click on wheel to place next unplaced planet
- **Drag:** Primary interaction for moving placed planets
- **DegreePanel:** Secondary for precision; supports adding planets by typing degrees
- **Constrain-to-house:** Disabled in free-build (no real birth houses); enabled in birth-first

### 4. Truthful Handling of Missing Birth Geometry
- Free-build without birth: Generate disabled; no snapshot/report/compose calls
- Equal-house divisions shown as "reference only" with explicit label
- No fake houses passed to engine; no silent defaults

---

## Contract Limitations That Remain

1. **Free-build cannot generate without birth:** Engine requires EphemerisSnapshot with houses from birth geometry. No overrides-only snapshot endpoint.
2. **Geocode dependency:** Location finder requires `/api/geocode` (Nominatim). If geocode fails, user must use Advanced manual coordinates.
3. **Constrain-to-house:** In birth-first, constrain applies. In free-build, full 360° drag (no real houses to constrain to).

---

## Phase 8 Usability for Closed Beta

**Sandbox is now Phase 8-usable for closed beta.**

- Location input is human-readable (city/state/country)
- Two modes support both birth-first and free-build workflows
- Direct wheel placement (click + drag) is primary
- Fail-closed behavior preserved; no fixtures or silent fallbacks
- Deterministic behavior unchanged where supported

---

## Verification

- `npm run phase6:verify-sandbox-compose` — PASS
- `apps/web` Next.js build — PASS
- No linter errors
