# Beta-Ready Checklist and Testing Plan

## A) Beta-ready checklist

### Deploy wiring
- [ ] Vercel build passes from latest commit on `beta-ui-vercel`
- [ ] Vercel Root Directory = `apps/web`
- [ ] Node pinned to 20.x (e.g. `apps/web/.nvmrc` or Vercel project settings / `engines` in `apps/web/package.json`)
- [ ] Environment vars present in Vercel (names only): `API_BASE_URL`; do **not** set `NEXT_PUBLIC_API_BASE_URL` (client uses same-origin only)
- [ ] All browser network calls go to same-origin `/api/*` (compose, chart, ip-geo, ml-status, telemetry)

### API health
- [ ] `/api/ml-status` returns 200 with expected payload
- [ ] `/api/ip-geo` returns 200 and does not 502
- [ ] `/api/chart` returns 200 for a known date/time/lat/lon
- [ ] `/api/compose` returns 200 and returns specVersion + audio url/base64 + `telemetry.ml_used === true`
- [ ] `/api/health` returns 200 with `{ status: "ok", build?, timestamp }` (Vercel-side only)

### UI behavior
- [ ] Home page renders and wheel is visible with readable glyphs (contrast)
- [ ] Play/Stop works without console errors
- [ ] Community page loads without RSC crash (no “Cannot access … before initialization”)
- [ ] No CORS errors in console

### Observability
- [ ] Telemetry endpoint reachable (`/api/telemetry`) and backend logs include request ids or minimal diagnostics
- [ ] Rate limit behavior documented: on 429, response includes `Retry-After`; client should back off and retry after that window (no formal policy in app yet)

---

## B) Testing plan

### Quick Smoke (5 min)
1. Load `/`.
2. Confirm network requests are only to same-origin `/api/*` (no direct Render URLs).
3. Generate chart; wheel visible; no red console errors.
4. Click Play, confirm audio starts; Stop stops.

### API Contract Smoke (10 min)
- **`/api/compose` (POST):** Expect keys: `controls`, `explanation` (spec, sections), `audio` (url or base64), `telemetry` (ml_used). Optional: viz, hashes, astro.
- **`/api/chart` (GET):** Expect keys: `positions`, `cusps`. Optional: seed, controlHash.
- **`/api/ml-status` (GET):** Expect keys: ml_used, tf_backend, model_version (or similar). Optional: model_sha, inference_ms.
- **`/api/ip-geo` (GET):** Expect keys: lat, lon, city, country (or nulls if unavailable).
- **Acceptable variants:** audio.base64 vs audio.url; explanation.text vs explanation.sections.

### Soak Lite (30 min)
- Run N requests (e.g. 20–30) to `/api/compose` spaced to avoid rate limit (e.g. 1/min or 2/min).
- Success criteria: ≥ 99% 200s; `telemetry.ml_used === true`; average latency within acceptable threshold (e.g. &lt; 15s per compose).

### Regression watchlist
- Community RSC crash (“Cannot access ‘v’ before initialization”).
- `/api/ip-geo` 502.
- Wheel glyph visibility on dark background.
- Any 404s for legacy assets (`/tone.js`, `/wheel.js`, `/tf.min.js` must **not** be requested).

---

## Next fix targets (paths only)

- `apps/web/app/community/page.tsx` (and any dynamically imported panels used there)
- `apps/web/app/api/ip-geo/route.ts` (proxy handling, timeout, env var usage)
