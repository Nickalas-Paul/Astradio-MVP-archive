# Vercel Deployment Deliverables (beta-ui-vercel)

## 1. Git truth

| Field | Value |
|-------|-------|
| Repo | astradio-mvp |
| Path | c:\Users\nicka\OneDrive\Astradio_MVP |
| Origin | https://github.com/Nickalas-Paul/Astradio-MVP-archive.git |
| Branch | beta-ui-vercel |
| HEAD | c9238fc vercel: npm run build, API base wiring, geocode/overlay fixes |
| Status | Clean (no uncommitted changes on branch) |
| Pushed | Yes, origin/beta-ui-vercel |

## 2. Build truth

| Field | Value |
|-------|-------|
| Root directory | **`apps/web`** (Vercel Root Directory must be `apps/web`) |
| Install command | `pnpm install` (Vercel auto-detects pnpm from `apps/web/pnpm-lock.yaml`) |
| Build command | `pnpm run build` (runs `next build`) |
| Build success | Frontend-only deps in `apps/web`; no backend native deps (swisseph, tfjs-node). Vercel install no longer runs node-gyp. |

Evidence: `apps/web/package.json` has `"build": "next build"` and only UI deps (no swisseph, no @tensorflow/tfjs-node). next.config.js, app/, src/ live under `apps/web`. Env vars unchanged.

## 3. Wiring truth

| Env var | Usage |
|---------|-------|
| NEXT_PUBLIC_API_BASE_URL | Browser/client: `getApiBaseUrl()` returns this when set; all browser fetches use it as base |
| API_BASE_URL | Server (Next API routes): app/api/compose, app/api/geocode proxy to this base |

**Files changed:**
- `app/api/geocode/route.ts` – use API_BASE_URL (fallback BACKEND_URL, localhost:3000)
- `app/overlay/page.tsx` – use getApiBaseUrl(); when set, chart fetches go to Render `/chart`; else `/api/chart` (Next)
- `src/core/social/hooks.ts` – connect, saveTrack now use getApiBaseUrl()

**Already correct:** app/page.tsx, app/sandbox/page.tsx, CompatibilitySection, social hooks (useCompat, useTrending, etc.) already use getApiBaseUrl(). app/api/compose/route.ts uses API_BASE_URL.

**API base behavior:** Browser calls use NEXT_PUBLIC_API_BASE_URL when present → hit Render directly. When unset (local dev), relative `/api/*` uses Next rewrites → localhost:3000. No hardcoded Render/localhost in client code.

## 4. Commits and push

| Commit | Hash | Pushed |
|--------|------|--------|
| vercel: npm run build, API base wiring, geocode/overlay fixes | c9238fc | Yes to origin/beta-ui-vercel |

## 5. Vercel settings block (copy-paste)

```
Framework Preset: Next.js
Root Directory: apps/web
Build Command: pnpm run build  (or leave default; Next.js preset uses npm/pnpm from lockfile)
Install Command: pnpm install  (or leave default; Vercel detects pnpm when Root Directory is apps/web)
Output Directory: .next (default)

Environment Variables (Production + Preview):
  NEXT_PUBLIC_API_BASE_URL = https://astradio-mvp-archive.onrender.com
  API_BASE_URL = https://astradio-mvp-archive.onrender.com
```

No vercel.json required. **Vercel Root Directory must be `apps/web`** so only frontend dependencies are installed (no swisseph, no @tensorflow/tfjs-node).

## 6. Backend verification (Render)

| Check | Result | Evidence |
|-------|--------|----------|
| GET /api/ml-status 200, ml_used=true | PASS | Invoke-RestMethod returned ml_used: True, tf_backend: wasm |
| POST /api/compose 200, telemetry.ml_used=true | PASS | Invoke-RestMethod returned telemetry.ml_used: True |

## 7. Step-3 inventory

| Category | Item | PASS/FAIL | Verification | Evidence |
|----------|------|-----------|--------------|----------|
| **E2E Smoke** | Landing loads + nav tabs present | — | Open Vercel URL; confirm nav tabs Landing/Community/Sandbox/Education/Settings | Screenshot: landing-nav.png |
| | Sandbox loads | — | Navigate to /sandbox; no white screen | Screenshot: sandbox.png |
| | Community/Education/Settings load | — | Visit each route; each loads | Screenshot: community.png, education.png, settings.png |
| | Compose from UI hits Render (not Vercel) | — | Network tab: Request URL starts with https://astradio-mvp-archive.onrender.com/api/compose | Network: compose-request.png |
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
3. Expect: Request URL = `https://astradio-mvp-archive.onrender.com/api/compose` (not *.vercel.app).
4. Response: status 200, JSON with `telemetry.ml_used: true`.
5. If call goes to Vercel: NEXT_PUBLIC_API_BASE_URL is unset or wrong. Set it in Vercel env to `https://astradio-mvp-archive.onrender.com` and redeploy.
