# Phase 1 smoke results

**Goal:** Prove the core backbone works end-to-end through the real product surfaces (Next web layer, not direct engine calls).

**Backbone:** User/Profile → Chart → Compose → Explainer → Export → Download

---

## How to run

1. **Profile persistence (Step 1)**  
   - Create a user via the real web flow (UI or `POST {WEB_URL}/api/profile`).  
   - Confirm `astradio_dev_user_id` cookie is set and `GET {WEB_URL}/api/profile` returns the same user.  
   - Wait ~5 seconds, then call `GET {WEB_URL}/api/profile` again with the same cookie.  
   - Confirm both reads return the same `user_id` and `primary_chart_id` (Postgres-backed persistence, not in-memory).

2. **Compose via Web (Step 2)**  
   - Trigger compose from the web layer (e.g. Sandbox or Landing).  
   - Confirm response includes: `hashes.plan_sha256`, explanation sections (e.g. Astrology, Personal Significance, Music Theory), `export_id`, and no `audio_debug` errors.  
   - Capture one example response excerpt.

3. **Export through Web proxy (Step 3)**  
   - `GET {WEB_URL}/api/exports/:id` (must go through Next proxy, not directly to Render).  
   - Confirm: status 200, content-type audio/wav, non-zero byte length.

4. **Regression guards (Step 4)**  
   - Confirm `POST {ENGINE_URL}/api/render` returns 410.  
   - Confirm from existing logs: only one planner invoked (COMPOSE_PATH planner = generatePlanMLOnly), no duplicate provider calls.

**Automated script:**

```bash
WEB_URL=https://your-app.vercel.app ENGINE_URL=https://your-engine.onrender.com node scripts/phase1-smoke.js
```

**PASS definition:**

- `WEB_URL` host **must differ** from `ENGINE_URL` host (real web surface via Next → engine proxy).  
- Step 1–3 must hit `WEB_URL` only; the script refuses PASS when `WEB_URL` and `ENGINE_URL` hosts match unless `ALLOW_WEB_ENGINE_SAME_HOST_FOR_DEV=1` (local-only override).  
- If any WEB call returns 401/403 (e.g. Vercel Authentication), the script reports:
  - `PHASE 1 STATUS: BLOCKED`  
  - `reason: web auth gate (vercel protection)`  
  - `minimal next action: deploy an unprotected web environment for smoke`  

---

## Report (fill after run)

### If PASS

```
PHASE 1 STATUS: PASS

- commit deployed: <commit hash>
- engine_url: <url>
- web_url: <url>
- user_id: <evidence>
- primary_chart_id: <evidence>
- one compose excerpt: <plan_sha256, export_id, section_titles or paste JSON excerpt>
- one WAV proof: status 200, content-type audio/wav, byte length <N>
```

### If BLOCKED

```
PHASE 1 STATUS: BLOCKED

- exact failing step: <e.g. Step 2 — Compose via Web>
- exact endpoint: <e.g. POST /api/compose>
- minimal next action: <one sentence, no new scope>
```

---

## Constraints (no changes)

- Do not modify planner logic.
- Do not modify provider logic.
- Do not introduce new environment flags.
- Do not add debugging endpoints.
- Do not widen scope.

Phase 1 ends when the real product flow works through the web surface with persistence and export.
