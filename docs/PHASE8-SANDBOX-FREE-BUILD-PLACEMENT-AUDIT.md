# Phase 8 Sandbox Free-Build Placement — Audit and Fix

**Date:** 2026-03-06

---

## 1. Audit: Current Interaction Model (Before Fix)

### State controlling planet placement
- **Source of truth:** `draft.overrides` in `apps/web/app/sandbox/page.tsx` (page state).
- **Wheel:** Receives `overrides` and builds `positions` in `WheelCanvasBuilder` from `overrides.planets` (and snapshot when birth-first). So placement state is page-owned; wheel is a view + event source.

### Click-on-wheel
- **Code:** `WheelCanvasBuilder.tsx` `handlePointerDown`: when `freeBuild` and no planet hit, computes `angle = Math.atan2(dy, dx)`, `lonDeg = angleToLonDeg(angle)` (pointer-to-angle), then `unplaced = PLANET_ORDER.find((p) => positions[p] === undefined)`, `toPlace = unplaced ?? 'sun'`, calls `onOverrideChange(toPlace, lonDeg)`.
- **Behavior:** Click **does** compute position from pointer and **does** commit via `onOverrideChange`. So click-on-wheel is authoritative for *where*.
- **Gap:** *Which* planet is placed is **not** user-chosen on the wheel. It is fixed to “first unplaced in PLANET_ORDER (sun → moon → …)”. So to place e.g. Jupiter you must either place Sun–Mars first by clicking, or use the degree panel to set Jupiter’s degree. So **click-to-place is incomplete**: position is wheel-driven, planet choice was implicit/panel-driven.

### Drag-on-wheel
- **Code:** On pointer down on a planet glyph, `setDraggingPlanet(planet)`; on move, `lonDeg = angleToLonDeg(angle)`, `onOverrideChange(draggingPlanet, lonDeg)`.
- **Behavior:** Drag **does** compute position from pointer and commit. Drag is fully authoritative and works.

### Side degree panel
- **Role:** Lists all 10 planets; each has a degree input (and sign/degree display). User can set any planet’s longitude by typing 0–360.
- **Required for placement?** Yes, if the user wanted to place a *specific* planet (e.g. Jupiter) at a chosen position without first placing Sun–Mercury in order. So the panel was **required** to instantiate placement for any planet out of order, and was the **only** way to choose “which planet.”

### Selected-planet model
- **Before:** There was no “selected planet” state. Effectively “next unplaced” was the implicit selection. So selection was **panel-driven** (editing a planet in the panel) or **order-driven** (next in PLANET_ORDER). Not wheel-driven.

### Why the UX felt panel-dependent
1. **No explicit “which planet” on the wheel:** Choosing which planet to place could only be done by (a) accepting the fixed order (click to place sun, then moon, …) or (b) using the degree panel. So the panel was the only way to pick an arbitrary planet.
2. **Panel as primary for “which”:** The only control that listed all planets and let you pick one was the side panel (degree inputs). So the **selection model was panel-first**.
3. **Discoverability:** “Click wheel to place next planet” was not obvious and the fixed order was not communicated; users naturally looked at the panel to choose a planet.
4. **Wheel not authoritative for “which”:** The wheel was authoritative for *where* (angle → lonDeg) but not for *which planet*; that came from order or panel.

---

## 2. Root Cause

- **Selected-planet model was wrong:** It was implicit (next unplaced) and panel-driven (degree input), not wheel-adjacent and explicit.
- **Wheel interaction was not authoritative for placement flow:** Position was from the wheel; planet choice was not, so the wheel was not the primary control surface for “place a planet.”
- **Panel and wheel state coupling was panel-first:** To place an arbitrary planet you had to use the panel; the wheel could not be used alone for “choose Jupiter, then click here.”

So: **selected-planet model wrong** and **wheel not authoritative** for the full “choose planet → place on chart” flow.

---

## 3. Fix Implemented

- **Planet palette (wheel-adjacent):** New component `PlanetPalette` above the wheel in free-build: one button per planet (glyph + label). Clicking a planet selects it (no degree input).
- **Selected-planet state:** Page state `selectedPlanetForPlacement: PlanetKey | null`. Palette sets it; wheel uses it for click-to-place.
- **Click-on-wheel:** If `selectedPlanetForPlacement` is set, place that planet at pointer angle; else fallback to first unplaced. Position is always from pointer (`angleToLonDeg`). After any `onOverrideChange` in free-build, selection is cleared.
- **Copy:** “Select a planet, then click the wheel to place it. Drag a planet to move it. Degree panel is for precision only.”
- **Panel:** Unchanged; remains secondary for precision. It still reflects and can edit the same `draft.overrides`.

Result: **Choose planet (palette) → click wheel (place)** is the primary path; no 0–360 typing required. Drag remains direct. Panel is secondary.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `apps/web/src/components/sandbox/PlanetPalette.tsx` | **New.** Wheel-adjacent planet selector (glyph + label per planet; selected state). |
| `apps/web/src/components/sandbox/WheelCanvasBuilder.tsx` | `selectedPlanetForPlacement` prop; click-to-place uses it when set; hint text updated. |
| `apps/web/app/sandbox/page.tsx` | `selectedPlanetForPlacement` state; `PlanetPalette` in free-build layout; clear selection on override and on mode switch. |
| `docs/PHASE8-SANDBOX-FREE-BUILD-PLACEMENT-AUDIT.md` | **New.** This audit and fix report. |

---

## 5. Behavior Now Supported

- **Free-build, blank start:** Palette shows all 10 planets; wheel shows equal-house reference.
- **Select then place (wheel-first):** User clicks a planet in the palette (e.g. Jupiter), then clicks the wheel; Jupiter is placed at that angle. Position is from pointer only; no degree input.
- **Drag to move:** User drags a planet glyph; position updates from pointer; panel updates to reflect.
- **Panel secondary:** Panel still shows and edits degrees; it reflects wheel placement and can be used for precision only.
- **Generate:** Still disabled until birth data; message unchanged.
- **Add birth:** Overrides preserved when adding birth in free-build; unchanged.

---

## 6. Remaining Limitations

- Palette is above the wheel (not drag-from-palette onto wheel). Click planet → click wheel is the supported flow.
- Degree panel still shows 0 for unplaced planets until they are placed on the wheel or by typing.

---

## 7. Verification

- Next.js build: passed.
- No new fixtures; no change to generate gating or birth-backed contracts.
