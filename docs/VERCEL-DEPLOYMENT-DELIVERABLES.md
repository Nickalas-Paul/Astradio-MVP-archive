# Vercel Deployment Deliverables (beta-ui-vercel)

## 1. Git truth

| Field | Value |
|-------|-------|
| Repo | astradio-mvp |
| Path | c:\Users\nicka\OneDrive\Astradio_MVP |
| Origin | https://github.com/Nickalas-Paul/Astradio-MVP-archive.git |
| Branch | beta-ui-vercel |
| HEAD | (see latest: `git log -1 --oneline origin/beta-ui-vercel`) |
| Remote | origin/beta-ui-vercel |
| Pushed | Yes; ensure Vercel Production Branch = beta-ui-vercel so it matches Render SHA. |

## 2. Build truth

| Field | Value |
|-------|-------|
| Root directory | **`apps/web`** (Vercel Root Directory must be `apps/web`) |
| Install command | `pnpm install` (Vercel auto-detects pnpm from `apps/web/pnpm-lock.yaml`) |
| Build command | `pnpm run build` (runs `next build`) |
| Build success | Frontend-only deps in `apps/web`; no backend native deps (swisseph, tfjs-node). Vercel install no longer runs node-gyp. |

Evidence: `apps/web/package.json` has `"build": "next build"` and only UI deps (no swisseph, no @tensorflow/tfjs-node). next.config.js, app/, src/ live under `apps/web`. Env vars unchanged.

## 3. Wiring truth (same-origin, no CORS)

| Env var | Usage |
|---------|-------|
| API_BASE_URL | Server (Next API routes): all proxy routes use this to call Render (compose, chart, ip-geo, geocode, ml-status) |
| NEXT_PUBLIC_API_BASE_URL | **Do not set on Vercel.** Client uses relative URLs only. |

**Architecture:** Vercel client calls relative `/api/compose`, `/api/chart`, `/api/ip-geo`, etc. Next API route handlers proxy to Render using `API_BASE_URL` server-side. No browser cross-origin requests → no CORS in console.

**Proxy routes:** `app/api/compose/route.ts`, `app/api/chart/route.ts`, `app/api/ip-geo/route.ts`, `app/api/ml-status/route.ts`, `app/api/geocode/route.ts` all proxy to `${API_BASE_URL}/...`.

**Client:** `getApiBaseUrl()` always returns `''` so all fetches use relative paths. Telemetry uses `/api/telemetry`. No hardcoded Render URL in client code.

## 4. Commits and push

| Commit | Hash | Pushed |
|--------|------|--------|
| (latest) | Run `git log -1 --oneline origin/beta-ui-vercel` | Yes to origin/beta-ui-vercel |

Ensure Render and Vercel both deploy from **beta-ui-vercel** so they use the same SHA (see RUNBOOK: "Single deployment branch").

## 5. Vercel settings block (copy-paste)

```
Framework Preset: Next.js
Root Directory: apps/web
Build Command: pnpm run build  (or leave default; Next.js preset uses npm/pnpm from lockfile)
Install Command: pnpm install  (or leave default; Vercel detects pnpm when Root Directory is apps/web)
Output Directory: .next (default)

Environment Variables (Production + Preview):
  API_BASE_URL = https://astradio-mvp-archive.onrender.com
  (Do NOT set NEXT_PUBLIC_API_BASE_URL; client uses same-origin /api/* only.)
```

No vercel.json required. **Vercel Root Directory must be `apps/web`** so only frontend dependencies are installed (no swisseph, no @tensorflow/tfjs-node).

**Expected behavior:** Network tab shows requests to `https://<your-vercel-app>.vercel.app/api/compose`, `/api/chart`, `/api/ip-geo` (same-origin). No CORS errors. Legacy script 404s (/tone.js, /wheel.js, /tf.min.js) removed; Tone loaded via dynamic import.

## 6. Backend CORS (Render)

Render Express uses allowlist from env: `CORS_ORIGINS` (comma-separated). Localhost is always allowed in dev. `https://*.vercel.app` origins are allowed. Set `CORS_ORIGINS=https://your-app.vercel.app` on Render if needed; with same-origin proxy, browser never hits Render directly so CORS is rarely needed.

## 7. Backend verification (Render)

| Check | Result | Evidence |
|-------|--------|----------|
| GET /api/ml-status 200, ml_used=true | PASS | Invoke-RestMethod returned ml_used: True, tf_backend: wasm |
| POST /api/compose 200, telemetry.ml_used=true | PASS | Invoke-RestMethod returned telemetry.ml_used: True |

## 8. Step-3 inventory

| Category | Item | PASS/FAIL | Verification | Evidence |
|----------|------|-----------|--------------|----------|
| **E2E Smoke** | Landing loads + nav tabs present | — | Open Vercel URL; confirm nav tabs Landing/Community/Sandbox/Education/Settings | Screenshot: landing-nav.png |
| | Sandbox loads | — | Navigate to /sandbox; no white screen | Screenshot: sandbox.png |
| | Community/Education/Settings load | — | Visit each route; each loads | Screenshot: community.png, education.png, settings.png |
| | Compose from UI hits Vercel same-origin (Next proxies to Render) | — | Network tab: Request URL = *.vercel.app/api/compose; no CORS errors | Network: compose-request.png |
| | Compose returns 200 | — | Response status 200 | Network: compose-response.png |
| | telemetry.ml_used === true | — | Response JSON has telemetry.ml_used: true | Same as above |
| | Chart/wheel renders (no blank) | — | After compose, wheel visible | Screenshot: wheel.png |
| | Analysis panel resolves or explicit error | — | Explanation appears or error message; no infinite loading | Screenshot: analysis.png |
| **Audio** | No CSP blocks for Tone | — | Console: no CSP errors for tone/cdn scripts | Console: csp-check.png |
| | "Enable Audio" works without exception | — | Toggle on; no JS error | Console: audio-enable.png |
| | Start/Restart triggers playback | — | Click Start/Restart; playback; console clean | Console: playback.png |
| **Backend** | ml-status OK at start and end | PASS | `Invoke-RestMethod https://astradio-mvp-archive.onrender.com/api/ml-status` | ml_used: True |
| | compose OK and ml_used true | PASS | POST compose with sky params | telemetry.ml_used: True |
| **Deployment** | Vercel is canonical UI | — | Single user-facing URL is Vercel | URL check |
| | Render is API-only | — | No mixed UI; Render serves /api/*, /chart only | Architecture |

---

**Frontend verification plan (when Vercel is deployed):**

1. In Network tab, filter by Fetch/XHR.
2. Trigger compose from landing or sandbox.
3. Expect: Request URL = `https://<vercel-app>.vercel.app/api/compose` (same-origin, not Render).
4. Response: status 200, JSON with `telemetry.ml_used: true`. No CORS errors in Console.
5. No 404s for /tone.js, /wheel.js, /tf.min.js (legacy script tags removed).
6. **Wheel visual:** After compose, confirm glyph readability and house line visibility on dark background (palette in `apps/web/src/components/WheelCanvas.tsx` WHEEL_COLORS).
