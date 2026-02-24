# Phase 1 smoke results

**Goal:** Prove the core backbone works end-to-end through the real product surfaces.

**Backbone:** User/Profile → Chart → Compose → Explainer → Export → Download

---

## How to run

1. **Profile persistence (Step 1)**  
   - Create a user via the real web flow (UI or `POST {WEB_URL}/api/profile`).  
   - Confirm `astradio_dev_user_id` cookie is set and `GET {WEB_URL}/api/profile` returns the same user.  
   - Restart the engine (or simulate statelessness), then call `GET {WEB_URL}/api/profile` again with the same cookie.  
   - Confirm user and primary chart persist (Postgres).

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

Manual Step 1.4 (persistence after restart): after running the script, restart the engine, then `GET {WEB_URL}/api/profile` with the same `astradio_dev_user_id` cookie and confirm same user + primary chart.

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
