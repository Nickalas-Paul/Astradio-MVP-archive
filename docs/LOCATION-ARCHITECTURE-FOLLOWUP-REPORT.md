# Location Architecture — Follow-up Corrective Report

**Date:** 2026-03-16  
**Scope:** Overlay fallback removal + engine-side profile validation only.

---

## A. Files changed

| File | Change |
|-----|--------|
| `vnext/api/compose.ts` | Removed overlay natal NYC fallbacks; require natalLatitude, natalLongitude, natalDatetime. |
| `vnext/compat/routes.ts` | Tightened POST /api/profile chart validation; reject incomplete or out-of-range location. |

---

## B. Exact code paths changed

**1. vnext/api/compose.ts**

- **Location:** Overlay ExplainSpec branch (`useOverlayExplainSpec === '1'`), ~lines 315–333 (after edit).
- **Before:** `natalInput` used `request.overlayParams.natalLatitude ?? 40.7128` and `natalLongitude ?? -74.006`; date/time had fallbacks.
- **After:** 
  - Require `natalLatitude` and `natalLongitude` to be finite numbers; else throw `Error('Overlay mode requires natalLatitude and natalLongitude; no default coordinates.')`.
  - Require `natalDatetime` to be a non-empty ISO string containing `'T'`; else throw.
  - Require parsed date and time from `natalDatetime`; else throw.
  - Build `natalInput` from validated values only (no defaults).

**2. vnext/compat/routes.ts**

- **Location:** POST `/api/profile` handler, ~lines 155–218 (after edit).
- **Before:** If `chartInput` was present, chart was created when `label`, `date`, `time`, and finite `lat`/`lon` were present; otherwise default chart was used. No range or completeness checks.
- **After:** 
  - When `chartInput` is present, validate **before** creating the user: require `chart.label`, `chart.date`, `chart.time` (non-empty strings); require `chart.lat` and `chart.lon` (finite numbers, lat in [-90, 90], lon in [-180, 180]). On failure return 400 with a specific error message.
  - Create user only after validation (so invalid chart does not create a user).
  - Create chart from validated fields; optional `chart.timezone` passed through to `storage.createChart` when present.

---

## C. Overlay fallback removal

- **Removed:** All use of `40.7128` and `-74.006` as defaults for overlay natal coordinates in `vnext/api/compose.ts`.
- **Behavior now:** Overlay ExplainSpec path requires explicit `natalLatitude`, `natalLongitude`, and `natalDatetime`. Missing or invalid values cause a thrown error (compose request fails with 500 and message), not silent NYC substitution.

---

## D. Engine-side profile validation change

- **Before:** Engine accepted any body with `chart: { label, date, time, lat, lon }`; if any of those were missing or non-finite, the engine created the user and linked the default chart (no 400).
- **After:** When `chart` is provided, the engine validates up front: `label`, `date`, `time` required and non-empty; `lat`/`lon` required, finite, and in valid ranges. If validation fails, the engine returns **400** with a clear error and does **not** create the user. No default chart is used when the client sent an incomplete or invalid chart object.

---

## E. Other active engine-side location defaults/fallbacks

- **Compose (vnext/api/compose.ts):** None remaining in the request path. `extractChartInput` already required explicit coordinates (previous push). Overlay ExplainSpec branch no longer uses NYC defaults.
- **Profile (vnext/compat/routes.ts):** None. Chart is either valid (create chart) or absent (default chart); invalid chart is rejected with 400.
- **Elsewhere in vnext:** The only remaining uses of `40.7128` / `-74.006` in the repo are in **scripts** (test/verification fixtures) and in **vnext/compat/memory-store.ts** (demo match-candidate specs and default profile chart fixture). Those are not request-handling fallbacks; they are test/fixture data. No other active engine-side location defaults or fallbacks in the compose or profile paths.

---

## F. Build verification

- **vnext:** `npm run vnext:build` — **PASSED** (exit code 0). TypeScript compile and asset copy completed.
- **apps/web:** `npm run build` (from `apps/web`) — **PASSED** (exit code 0). Next.js production build completed; all 38 pages generated; no compile or type errors.

---

## G. Commit hash

`dfd25d9bef38e0094d3852cfe37cf10d623f10dc`

---

## H. Push confirmation

Pushed to `beta-ui-vercel`: `89c4be7..dfd25d9 beta-ui-vercel -> beta-ui-vercel`.
