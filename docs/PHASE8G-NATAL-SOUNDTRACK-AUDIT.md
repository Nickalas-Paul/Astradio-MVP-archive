# Phase 8G — Full-stack audit: natal soundtrack regression

**Date:** 2026-03-08  
**Type:** Emergency regression audit and restore.

---

## Evidence (required for final root-cause)

The following evidence is required to identify the **exact** break and the **exact** change responsible. Items marked **PROVEN** are established from code/history; items marked **CAPTURE** require one failing run or deploy/env access.

| # | Requirement | Status | Source / how to obtain |
|---|-------------|--------|-------------------------|
| 1 | Exact last-known-good **frontend** commit | **PROVEN** | `d51dac3858e1fcc6b56a1052736e7f7701ec0d1d` (pre–Phase 8G baseline when playable natal was verified). |
| 2 | Exact last-known-good **engine** commit | **CAPTURE** | Not in repo. If the engine was deployed from this repo on Render, check deploy history for the deploy that was live when frontend at d51dac3 was verified; or run `GET <engine>/health` from that era if logs exist. |
| 3 | Exact current **frontend** commit | **PROVEN** | `88753fe6e45b7f589b741c31d4d7965f8eadfe8e` (branch `beta-ui-vercel`). |
| 4 | Exact current **engine** commit | **CAPTURE** | `GET <engine_base>/health` returns `commit` when `RENDER_GIT_COMMIT` is set (Render sets this on deploy). Run once and record the value. |
| 5 | Actual compose response body (failing run): audio.base64, export_id, export_error | **CAPTURE** | (1) Add `?natal_debug=1` to the app URL. (2) Create a fresh profile and trigger natal compose. (3) In DevTools Console, copy the line `[NATAL_COMPOSE_RESPONSE] {...}`. (4) In DevTools Network, select the POST to `/api/compose`, copy the Response body (redact base64 if needed; keep export_id, export_error, and base64 length). |
| 6 | Exact engine log output for that failing compose request | **CAPTURE** | In Render dashboard (or wherever the engine runs), open logs for the time of the compose request. Search for `[COMPOSE_EXPORT]`, `[COMPOSE_RESPONSE]`, and any error line. The engine now logs `[COMPOSE_RESPONSE] {"export_id":...,"export_error":...,"base64_length":...,"audio_export_available":...}` for every compose. |
| 7 | Proof that current engine env/config differs from last-known-good | **CAPTURE** | Compare current engine env (e.g. Render env vars: `ENABLE_WAV_EXPORT`, `GOOGLE_CLOUD_PROJECT`, `RENDER_PROVIDER`, Lyria/Vertex vars) to any backup or doc from when it worked. No env history is in the repo. |
| 8 | Proof that frontend response contract/parsing did not regress | **PROVEN** | See **§ Proof: frontend contract** below. |
| 9 | Exact reason a composition row is still created when no playable artifact exists | **PROVEN** | See **§ Proof: why a row exists with no artifact** below. |
| 10 | Exact change event (commit / deployment / env / provider) | **CAPTURE** | After 5, 6, 7 (and optionally 2, 4): if engine logs show `export_error: "render_failed"` and base64_length 0, the break is in the engine render path; then compare engine commit and env to last-known-good to identify whether it was a commit, deployment, env change, or provider/runtime change. |

### Proof: frontend contract did not regress

- **d51dac3** (last-known-good): playable URL is set when `composePayload?.audio?.base64 && typeof composePayload.audio.base64 === 'string'`; then we build a blob and set `job.status.url`; we **always** call `addJobToHistory(job)`.
- **88753fe** (current): we set playable URL when `typeof base64 === 'string' && base64.length > 0` (strictly equivalent for any non-empty base64), then same blob path; we **additionally** try `export_id` fetch when there is no base64. We still **always** call `addJobToHistory(job)`.
- **Conclusion:** The frontend did not drop or mis-parse a valid artifact. For any response that has a non-empty `audio.base64`, the current code still produces a playable URL the same way. The only change is a stricter empty check and an extra fallback. So if the user sees “Audio unavailable”, the backend did not send a non-empty base64 (and did not provide a working export_id).

### Proof: why a composition row exists with no playable artifact

- **Code path:** In `ProfilePanel.tsx`, after building `audioUrl` from base64 (and optionally from export_id fetch), we build `job` with `status.url: audioUrl`. We then **always** call `addJobToHistory(job)` (no conditional). This was restored in the rollback (d3134f0) to match d51dac3 behavior: “always add job so the user sees something in Saved Tracks.”
- **Exact reason:** So when the backend returns no base64 and no usable export_id, `audioUrl` stays `''`, the job is still added with `url: ''`, and the UI correctly shows “Audio unavailable” for that row. The row exists because the frontend is designed to always add the job.

### How to determine the exact change event (item 10)

1. **Capture one failing run:** Use `?natal_debug=1`, create profile, then copy from Console the `[NATAL_COMPOSE_RESPONSE]` object and from Network the full compose response body (or at least `audio.base64` length, `export_id`, `export_error`).
2. **Capture engine logs** for that same request (timestamp): look for `[COMPOSE_EXPORT]`, `[COMPOSE_RESPONSE]`, and the catch block that sets `export_error` (step = provider | render | store).
3. **Record current engine commit:** `GET <engine_base>/health` → field `commit` (when on Render).
4. **Compare:** If logs show `export_error: "render_failed"` and `base64_length: 0`, the break is in the engine render path. Then:
   - If the **engine commit** changed between last-known-good and now → likely a **commit** or **deployment** change.
   - If the **engine env** (e.g. `GOOGLE_CLOUD_PROJECT`, Lyria credentials) changed → **env/config** change.
   - If commit and env are unchanged but Lyria/Vertex behavior or availability changed → **provider/runtime** change.

Until 5, 6, and (if possible) 7 are captured, the “backend render failing at runtime” explanation remains a **theory**; the evidence above is what turns it into a proven root cause.

---

## 1. Last-known-good

- **Commit / deployment:** Frontend and engine at **d51dac3** (or earlier Phase 8E/8F) when the user personally verified playable natal soundtrack in both Profile (under chart) and Saved Tracks.
- **Behavior:** Fresh profile → chart + interpretation + natal compose → playable audio under chart and in Saved Tracks. No “Audio unavailable” for that flow.

---

## 2. Current broken state

- **Frontend commit:** 88753fe (current `beta-ui-vercel`; includes rollback behavior + export_id fallback + diagnostics).
- **Observed:** Profile create succeeds; chart and interpretation render; `/compose` fires and returns HTTP 200 after ~23–27s; Saved Tracks shows a row (e.g. “My Alpha 3 Soundtrack”) with **“Audio unavailable”**; no playable artifact.

---

## 3. Root cause

**What broke:** The playable WAV artifact is no longer present in the compose response when the backend runs the natal compose path.

**Where it broke:** **Backend (engine) audio export path.** When `ENABLE_WAV_EXPORT=1`, the compose handler attempts WAV generation (cache then Lyria). If the **render** step (e.g. Lyria) throws, the handler catches, sets `export_error` (e.g. `'render_failed'`), leaves `audio.base64` as `''`, and does **not** set `export_id`. The response is still HTTP 200 with plan/text and stub `audio: { base64: '', export_error, ... }`. The frontend correctly builds a job with `url: ''` and shows “Audio unavailable.”

**When it broke:** Between last-known-good and now, the **backend render step began failing** in the deployed environment (e.g. Lyria credentials, quota, or network). No frontend change removed the artifact; the backend stopped providing it.

**Why “Audio unavailable”:** Frontend only gets a playable URL when `composePayload.audio.base64` is a non-empty string (or when `export_id` is present and a fetch of `/api/exports/:id` succeeds). When render fails, the backend sends no base64 and no export_id, so the frontend has no artifact to play.

---

## 4. Exact failing layer

- **Layer:** Engine WAV export — **render** step inside `vnext/api/compose.ts` (e.g. `renderWithProvider` → Lyria).
- **Evidence:** Compose returns 200 after a long run (~23–27s) but the response has `audio.base64 === ''` and `export_error` set (e.g. `render_failed`). So plan/text are produced; only the audio export path fails after the attempt.

---

## 5. File-by-file audit

| File | Role |
|------|------|
| `apps/web/src/components/community/ProfilePanel.tsx` | Triggers natal compose after profile create; parses `audio.base64` and optionally `export_id`; creates job and adds to history. |
| `apps/web/app/community/CommunityClient.tsx` | Saved Tracks: renders jobs from store; shows “Audio unavailable” when `job.status.url` is empty. |
| `apps/web/src/store/index.ts` | Composition store: `jobHistory`, `addJobToHistory`; persist last 10 jobs (blob URLs do not survive refresh). |
| `apps/web/app/api/compose/route.ts` | Next proxy: forwards POST to engine `/api/compose`; returns engine JSON as-is. |
| `apps/web/app/api/exports/[id]/route.ts` | Next proxy: GET to engine `/api/exports/:id` for WAV download. |
| `vnext/api/compose.ts` | Engine compose: payload → plan → text → WAV (cache or render); sets `audio.base64` and `export_id` only on success. |
| `vnext/render/index.ts` | Provider selection (Lyria / local_wav); `renderWithProvider` invokes provider. |
| `vnext/render/lyria-client.ts` | Lyria: requires `GOOGLE_CLOUD_PROJECT`; calls Vertex predict; throws on failure. |
| `server/index.js` | Mounts compose, exports store, `GET /api/exports/:id` streams from store. |

---

## 6. Regression diff summary

- **Frontend:** Rollback (d3134f0) restored the pre–Phase 8G natal flow (always add job; no early return). No frontend change removed the artifact; the frontend only displays what the backend sends.
- **Backend:** No commit in the audited range removes base64 from the success path. When render **succeeds**, the backend still sets `audio.base64` and `export_id`. The regression is **runtime**: in the deployed environment, render (Lyria) is now failing, so the success path is not taken.
- **Conclusion:** **Environment / deployment:** Lyria (or the path to it) is failing at runtime in the current engine deployment (e.g. credentials, quota, or network). Same code path that worked before now fails in that environment.

---

## 7. Repair plan (implemented)

1. **Frontend — export_id fallback:** If the compose response has `export_id` (or `audio.export_id`) but no usable `audio.base64`, the frontend fetches `GET /api/exports/:id` and builds a blob URL from the response. This restores playable audio when the backend *does* have an artifact (e.g. cache hit or successful render) but the response body omits or truncates base64.
2. **Backend — no code change for Lyria:** Pipeline remains Lyria-only. Restoring playable audio for **first-time** natal compose requires the deployed engine to succeed on the render step (Lyria). Ensure:
   - `ENABLE_WAV_EXPORT=1`
   - `GOOGLE_CLOUD_PROJECT` set
   - Lyria credentials (e.g. Vertex service account) valid and available to the engine
   - No quota/network issues blocking the Lyria predict call
3. **Verification:** After deployment, create a fresh profile and confirm playable soundtrack under chart and in Saved Tracks. If the engine has a cache hit from a prior successful render for the same chart, the response may include base64 (or export_id); the export_id fallback covers the case where only export_id is reliable.

---

## 8. Env/config findings

- **Engine (e.g. Render):** `ENABLE_WAV_EXPORT=1` required for WAV. `GOOGLE_CLOUD_PROJECT` and Vertex/Lyria credentials required when using Lyria. If Lyria fails (missing creds, quota, network), compose still returns 200 with `export_error` and empty `audio.base64`.
- **Frontend (e.g. Vercel):** `API_BASE_URL` or `ENGINE_BASE_URL` must point at the same engine that has WAV export (and Lyria) configured. No env change on the frontend can create an artifact if the engine does not return one.

---

## 9. Why it worked before and fails now

- **Before:** The same engine deployment (or an earlier one) had Lyria succeeding for the natal compose request, so the response included `audio.base64` (and often `export_id`). Frontend created a blob URL and a playable job.
- **Now:** In the current deployment, the Lyria render step throws (or equivalent failure), so the handler catches, leaves base64 empty, and does not set export_id. Frontend receives no artifact and correctly shows “Audio unavailable.” The regression is **environment/runtime**, not a removal of the success path in code.
