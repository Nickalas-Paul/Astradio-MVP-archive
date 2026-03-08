# Phase 8G — Full-stack audit: natal soundtrack regression

**Date:** 2026-03-08  
**Type:** Emergency regression audit and restore.

---

## 1. Last-known-good

- **Commit / deployment:** Frontend and engine at **d51dac3** (or earlier Phase 8E/8F) when the user personally verified playable natal soundtrack in both Profile (under chart) and Saved Tracks.
- **Behavior:** Fresh profile → chart + interpretation + natal compose → playable audio under chart and in Saved Tracks. No “Audio unavailable” for that flow.

---

## 2. Current broken state

- **Commit:** d3134f0 (rollback to pre–Phase 8G baseline).
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
