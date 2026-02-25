# Phase 2 — Determinism & Repeatability

**Goal:** Prove that identical inputs produce stable outputs across multiple runs. This phase validates engine integrity under repetition before building social layers (community CRUD, compatibility mapping, phantom users, sandbox composition).

---

## What is being tested

- **Harness:** `scripts/phase2-determinism.js`
- **Input:** A fixed chart payload (sandbox mode, fixed `chartData` and `controls`) sent to `POST {WEB_URL}/api/compose` **N** times (default N=5).
- **Per run we capture:**
  - `hashes.plan_sha256`
  - Explanation section titles (`explanation.sections[].title`)
  - `export_id`
- **Per run we download:** WAV via `GET {WEB_URL}/api/exports/:id` and compute the SHA256 hash of the response body.

---

## What must be identical

- **Plan hash:** `plan_sha256` must be the same on every run for the same fixed payload. Variance here indicates non-determinism in the planner or upstream architecture/feature pipeline.
- **Explanation section titles:** The ordered list of section titles from `explanation.sections` must be identical across runs. Variance indicates non-determinism in the explainer or spec rendering.

If either differs, the script exits with **STATUS: FAIL**.

---

## What may vary

- **Export ID:** May be the same (e.g. cache key) or different per run; we do not assert on `export_id` equality.
- **WAV hash:** Audio may or may not be deterministic depending on renderer and provider. Phase 2 **reports** WAV hash equality but does **not** auto-fail the script on audio variance.

---

## PASS criteria

1. **Plan hashes identical:** All runs yield the same `plan_sha256`.
2. **Section titles identical:** All runs yield the same ordered list of explanation section titles.

Audio hash variance is reported (and if hashes differ, the script prints all WAV hashes, byte lengths, and the note "audio nondeterministic") but does **not** cause the script to fail.

---

## Known acceptable variance

- **Audio (WAV):** Provider- or implementation-dependent non-determinism in audio rendering is acceptable for Phase 2. We record and report it only. Future phases (e.g. Lyria validation) may tighten this.
- **Timestamps / request IDs:** Not part of the determinism contract; may vary.

---

## Usage

```bash
WEB_URL=https://your-app.vercel.app node scripts/phase2-determinism.js
WEB_URL=http://localhost:3000 ENGINE_URL=http://localhost:4000 node scripts/phase2-determinism.js
```

Optional: `PHASE2_RUNS=10` to run 10 compose cycles instead of 5. For protected Vercel previews, set `VERCEL_BYPASS_TOKEN`; the script sends `x-vercel-protection-bypass` on every WEB request (compose + exports) and logs only present/length, never the token value.

---

## LIVE evidence

| Field | Value |
|-------|--------|
| **date** | 2026-02-24 |
| **web_url** | `https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app` |
| **engine_url** | `https://astradio-mvp-archive.onrender.com` |
| **N runs** | 5 |
| **plan hash** | `006afac5f225f69363ba26de6c8cb9fb05c3e6254d47679000b252ea8e336b6b` |
| **wav hash summary** | identical across all 5 runs: `c3af5add683dfd4054cbbb376781a82c48c6316f61ffc50aaa43cc0b5c8b24a5` (1323044 bytes each) |

Phase 2 LIVE: **PASS** (plan hashes identical, section titles identical, WAV hashes identical).

---

## Why this matters

If determinism is unstable, compatibility scoring and saved compositions become unreliable. Phase 2 must pass before Phase 3 (Lyria validation) and Phase 4 (Community).
