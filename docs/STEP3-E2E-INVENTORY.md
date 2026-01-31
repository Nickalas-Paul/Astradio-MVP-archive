# Step-3 E2E Readiness Inventory

Verifiable checklist for beta UI (Next on Vercel) → Render backend.

## E2E Smoke (manual browser)

| Item | Status | How to verify |
|------|--------|----------------|
| Landing page loads with nav tabs present | PLACEHOLDER | Open Vercel URL; confirm nav shows Landing/Community/Sandbox/Education/Settings (or Home + tabs). |
| Sandbox page loads | PLACEHOLDER | Navigate to /sandbox; page renders without white screen. |
| Community/Education/Settings routes load | PLACEHOLDER | Visit /community, /education, /settings; each loads (placeholder OK). |
| Compose call succeeds from frontend | PLACEHOLDER | From landing or sandbox, trigger compose; Network tab shows POST {Render}/api/compose → 200. |
| Response includes telemetry.ml_used === true | PLACEHOLDER | In same compose response JSON, confirm telemetry.ml_used === true. |
| Chart/wheel renders (no blank state) | PLACEHOLDER | After compose, wheel/chart is visible. |
| Analysis panel resolves OR shows explicit error | PLACEHOLDER | Explanation/analysis appears or shows error message (no infinite loading). |
| No CSP blocks for Tone | PLACEHOLDER | Console has no CSP errors for tone/audio scripts. |
| "Enable Audio" works | PLACEHOLDER | Toggle Enable Audio; no exception. |
| Start/Restart triggers playback without exceptions | PLACEHOLDER | Click Start/Restart; playback logic runs; console clean. |

## Backend regression protection

| Item | Status | How to verify |
|------|--------|----------------|
| GET {Render}/api/ml-status returns 200 and ml_used: true | PLACEHOLDER | `curl -s {Render}/api/ml-status` → 200, body has ml_used: true. |
| POST {Render}/api/compose returns 200 and telemetry.ml_used: true | PLACEHOLDER | `curl -s -X POST {Render}/api/compose -H "Content-Type: application/json" -d '{"mode":"sky","skyParams":{...}}'` → 200, body has telemetry.ml_used: true. |

## Deployment correctness

| Item | Status | How to verify |
|------|--------|----------------|
| Vercel frontend points to Render backend | PLACEHOLDER | Browser Network tab: API requests go to Render origin (not Vercel). |
| No mixed frontend versions | PLACEHOLDER | Single UI: Vercel is canonical; Render serves API only (no legacy HTML at / as primary). |

Replace PLACEHOLDER with PASS or FAIL after execution.
