# Location Architecture — Corrective Implementation Report

**Date:** 2026-03-16  
**Corrective push:** Fix for `@/types/location` build failure and dependency addendum.

---

## 1. Build failure and fix

### What went wrong

The initial push reported that the Next.js web build succeeded. In reality the build **failed** with:

- **File:** `apps/web/app/api/compose/route.ts`
- **Error:** `Cannot find module '@/types/location'`

That made the earlier “build succeeded” and “ready” claims incorrect.

### Root cause

- The shared type module lives at `apps/web/src/types/location.ts`.
- `tsconfig.json` has `"@/*": ["./src/*"]`, so `@/types/location` should resolve to `./src/types/location`.
- `apps/web/src/types/location.ts` was **never committed** (it was untracked), so the module was missing in the repo and the build failed.
- Relying on the `@/` alias from under `app/api/` may also be brittle depending on how Next resolves paths during the build.

### Fix applied

1. **Use relative imports for the location type in API routes** so the build does not depend on alias resolution for this module:
   - `apps/web/app/api/compose/route.ts`:  
     `import type { CanonicalLocation } from '../../../src/types/location';`
   - `apps/web/app/api/sandbox/snapshot/route.ts`:  
     `import type { CanonicalLocation } from '../../../../src/types/location';`
   - `apps/web/app/api/sandbox/report/route.ts`:  
     `import type { CanonicalLocation } from '../../../../src/types/location';`
2. **Add and commit** `apps/web/src/types/location.ts` so the module exists in the repo for all consumers (e.g. `src/components/sandbox/BirthDataForm.tsx`, `src/types/sandbox.ts`, `app/page.tsx`).

No other code changes were made in this corrective push.

---

## 2. Build verification (post-fix)

**Command run:** `cd apps/web && npm run build`

**Result:** **PASSED** (exit code 0).

**Relevant output:**

```
Creating an optimized production build ...
 ✓ Compiled successfully
 Skipping linting
 Checking validity of types ...
 ...
 ✓ Generating static pages (38/38)
 Finalizing page optimization ...
```

All 38 static pages generated; no compile or type errors. The previous report was wrong; this one reflects the actual build state after the fix.

---

## 3. Current implementation state (unchanged from first push)

- **Home:** Browser geolocation only; no default/fallback coords; read-only location; compose and wheel use the same canonical location; compose blocked when location unavailable; browser timezone used.
- **Compose route (Next):** Canonical location required for sky mode; invalid payloads get 4xx with details; no coordinate defaults in Next.
- **Engine `extractChartInput`:** No NYC/default fallbacks; missing chart input throws.
- **Profile creation:** Next enforces `source: 'geofinder'` and canonical shape; engine receives lat/lon/timezone only after validation.
- **Sandbox:** Birth data is canonical location only (geofinder); Next sandbox snapshot/report routes validate and adapt to engine `birth` shape.
- **Cleanup:** NYC fallbacks removed from engine compose chart-input path; manual raw lat/lon removed from sandbox BirthDataForm.

---

## 4. Dependency accounting addendum

### 4.1 Shared location type — import path / alias

- **Definition:** `apps/web/src/types/location.ts`  
  Exports: `LocationSource`, `CanonicalLocation`, `GeoPermissionStatus`.
- **Resolution:**
  - **Before fix:** API routes under `app/api/` used `@/types/location`. The file was untracked, so the module was missing and the build failed.
  - **After fix:** API routes use **relative** imports:
    - From `app/api/compose/route.ts`: `../../../src/types/location`
    - From `app/api/sandbox/snapshot/route.ts` and `app/api/sandbox/report/route.ts`: `../../../../src/types/location`
  - **Alias:** `@/*` → `./src/*` (tsconfig) is still used elsewhere (e.g. `@/lib/engine-base`). Only the location type imports in the three API route files were changed to relative paths to guarantee resolution regardless of alias behavior from `app/`.
- **Dependency:** No new npm or workspace dependency. The shared type is a local module; the fix is path + ensuring the file is committed.

### 4.2 Where provenance is enforced: Next vs engine

- **Next (provenance enforced):**
  - **Compose:** Sky-mode payloads must include canonical `location` (source `browser_geo` or `geofinder`); invalid or missing location → 4xx.
  - **Profile POST:** If `chart.location` is present, Next requires `source === 'geofinder'` and valid lat/lon/timezone; then forwards only `chart: { label, date, time, lat, lon, timezone }` to the engine.
  - **Sandbox snapshot/report:** Request body must include `birth.location` with `source: 'geofinder'` and full canonical shape; Next maps to engine `birth: { date, time, lat, lon, tz, houseSystem }`.
- **Engine (vnext):**
  - **Chart input for compose:** `extractChartInput()` no longer applies any default coordinates; missing or invalid sky/overlay/chartData → throws. So for compose entry points that go through this path, provenance is effectively enforced by “no defaults”.
  - **Profile (vnext/compat/routes.ts):** POST `/api/profile` accepts `chart: { label, date, time, lat, lon }` (optionally timezone from Next). The engine does **not** validate canonical source or shape; it trusts the Next layer to have already enforced it.
  - **Overlay explainer (vnext/api/compose.ts):** The overlay text branch that builds `natalInput` for `fetchChartSnapshot` still uses `request.overlayParams.natalLatitude ?? 40.7128` and `request.overlayParams.natalLongitude ?? -74.006`. So engine-side overlay explainer still has a default for natal coords; provenance is **not** enforced there. Overlay callers that omit natal coords get NYC implicitly.

**Summary:** Provenance is enforced in Next for home (sky), profile, and sandbox. Engine enforces “no defaults” for the main compose chart-input path; engine profile and overlay explainer do not enforce canonical provenance.

### 4.3 Active callers of `/api/ip-geo`

- **Next route:** `apps/web/app/api/ip-geo/route.ts` — GET handler that proxies to the backend `getEngineBaseUrl() + '/api/ip-geo'` with forwarded headers (e.g. x-forwarded-for, x-real-ip). This is the only **runtime** definition of the `/api/ip-geo` endpoint in the web app.
- **Call sites:** Grep of the repo (apps/web, server, scripts, docs) shows **no** client or server code that calls `fetch('/api/ip-geo')` or otherwise invokes `/api/ip-geo`. References are:
  - The route file itself.
  - Express `server/index.js`: implements `GET /api/ip-geo` (used when Next proxies to it).
  - Docs/checklists: BETA-READY-CHECKLIST.md, VERCEL-DEPLOYMENT-DELIVERABLES.md, RUNBOOK.md, DIAG-SANDBOX-404.md, PRE-SOUND-DESIGN-STABILIZATION-AUDIT.md — describe or list the endpoint for deployment/health checks only.

**Conclusion:** There are **no active callers** of `/api/ip-geo` in the application code. The route exists as a proxy for the engine and for documentation/checklist purposes; it is not used as an authoritative location source anywhere in the current location architecture.

### 4.4 Scripts / docs / tests updated for default/fallback removal

- **No scripts or tests were changed** in the location-architecture push or in this corrective push. Scripts and tests that still use hardcoded coordinates (e.g. 40.7128, -74.006) for **test payloads** (e.g. phase1-smoke.js, phase7-rpg-campaign-ui-test.ts, RUNBOOK.md curl examples, docs/API_CONTRACT_EXAMPLES.md, vnext eval/golden sets) were left as-is. Those are explicit test/example values, not “defaults” in the product code path.
- **Docs:** No doc was updated to describe the removal of NYC/BA fallbacks or the canonical model. The only new doc is this corrective report (and optionally a short “location architecture” note if you add one).
- **Behavioral impact:** Any script or E2E test that calls the **engine** compose (or Next compose) with missing or partial chart/location data will now get an **error** instead of a default-NYC result. If such scripts exist and assume defaults, they would need to be updated to pass full chart input (or canonical location where required). That has not been done in this push.

---

## 5. Commit and push (corrective)

- **Commit:** Fix location type import and add shared module so `apps/web` build passes.
- **Files:** `apps/web/src/types/location.ts` (added), `apps/web/app/api/compose/route.ts`, `apps/web/app/api/sandbox/snapshot/route.ts`, `apps/web/app/api/sandbox/report/route.ts` (relative imports).
- **Push:** To the same branch as the prior location-architecture push.

---

## 6. Readiness

- **Build:** `apps/web` build **passes** after this fix; the report now matches the actual build state.
- **Recommendation:** Do **not** treat as “ready for runtime testing” solely on the basis of this report. Run your own runtime and E2E checks (including geo-denied and sandbox/profile flows) before considering the location architecture ready for production or beta.
