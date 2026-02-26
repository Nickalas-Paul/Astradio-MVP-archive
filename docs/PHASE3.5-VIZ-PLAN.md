# Phase 3.5: Three.js Visualization Wiring

**Prerequisite:** Phase 3 closed (Lyria validation PASS, duration gate OK, harness evidence complete).

**Goal:** Deterministic snapshot + deterministic plan → deterministic viz payload → Three.js renderer that complements audio/text.

---

## Rules

- **No new backend dependencies.** Viz is derived only from data already generated (snapshot + plan + explain).
- **Determinism:** Payload checksum must be stable for same inputs.
- **Scope:** Viz wiring only. No Phase 4 scope (no new backend deps, no product UI changes beyond dev page).

---

## Deliverables

### 1. Viz payload contract (shared type)

```ts
interface VizPayload {
  chart: {
    houses: number[];           // cusp longitudes
    angles: { asc?: number; mc?: number; };
    planetLongitudes: Record<string, number>;
    aspects: Array<{ p1: string; p2: string; type: string; orb: number }>;
  };
  plan: {
    tempo?: number;
    density?: number;
    arc?: number;
    tension?: number;
    brightness?: number;
    // ... other plan fields already present
  };
  audioMeta?: {
    provider_used: string;
    duration_s?: number;
  };
  seed: string;  // compose_hash or plan_sha-derived
}
```

### 2. Payload builder

- `buildVizPayload(snapshot, plan, compose_meta): { payload: VizPayload; checksum: string }`
- Single function returning JSON + checksum.
- No side effects; pure from inputs.

### 3. Renderer adapter

- `renderViz(canvasEl, payload, t: number)` in a dedicated module.
- Use react-three-fiber in Next for integration.
- Frame loop uses explicit `t` (no `Math.random()` without seeded RNG).

### 4. Acceptance page

Dev page that loads a known chart seed and shows:

- Wheel ring + houses
- Planet points
- Aspect lines
- 1–2 “energy layers” driven by plan fields:
  - density → particle count
  - tension → line intensity
  - tempo → motion speed

---

## PASS gates for 3.5

| Gate | Criterion |
|------|-----------|
| Checksum stability | Same inputs → same payload checksum |
| No unseeded random | No `Math.random()` without seeded RNG |
| Explicit time | Frame loop uses explicit `t` |
| Isolation | Page renders without affecting compose/export endpoints |

---

## File layout (proposed)

```
vnext/viz/
  payload.ts      # VizPayload type + buildVizPayload
  renderer.tsx    # renderViz or React component
  types.ts        # shared types

apps/web/app/dev/viz/page.tsx   # acceptance page
```

---

## Implementation (Phase 3.5)

- `apps/web/src/viz/types.ts` — VizPayload contract
- `apps/web/src/viz/payload.ts` — buildVizPayload (canonical JSON, sha256 checksum)
- `apps/web/src/viz/seeded-rng.ts` — no Math.random
- `apps/web/src/viz/VizScene.tsx` — wheel, houses, planets, aspects, energy layers (explicit `t`)
- `apps/web/app/dev/viz/page.tsx` — dev page: compose + snapshot → payload → checksum + scene

**Run:** `npm run web:dev` (from repo root) or `cd apps/web && npm run dev`, then open `/dev/viz`.
**Deps:** Run `npm install --legacy-peer-deps` in apps/web if needed for @react-three/fiber.
