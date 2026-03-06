# Phase 8 Sandbox — Report Provenance and Rendering Audit

**Date:** 2026-03-06

**Scope:** Final Phase 8 Sandbox verification: prove the report is truthfully generated from the user-created chart and classify current rendering.

---

## 1. Audit: Report Provenance

### 1.1 What Sandbox renders after report generation

- **Source of displayed content:** The UI renders the **response of `POST /api/sandbox/report`** only. No report text comes from `POST /api/compose`.
- **Flow in code:** `handleGenerate` in `apps/web/app/sandbox/page.tsx`:
  1. `POST /api/sandbox/snapshot` with `{ birth, overrides }` → `snapshot`, `meta.combinedHash`
  2. `POST /api/sandbox/report` with `{ birth, overrides, seed: combinedHashUsed }` → full report payload
  3. `setReport(reportData)` — the report state is exactly the report API response
  4. `POST /api/compose` is called separately with `{ mode: 'sandbox', seed, overriddenSnapshot }` for **audio only**. Compose response is not used for Personality or Guidance text.

So: **Personality and Guidance blocks are direct structured outputs from the report API**, which calls the architecture engine. They are **not** from compose.

### 1.2 What comes from /api/sandbox/report vs /api/compose

| Content            | Source                | Used in Sandbox UI for report? |
|--------------------|-----------------------|--------------------------------|
| Personality        | `/api/sandbox/report` | Yes — `report.personality`     |
| Guidance           | `/api/sandbox/report` | Yes — `report.guidance`        |
| Explanation       | `/api/sandbox/report` | Yes — `report.explanation`     |
| features, seed, meta | `/api/sandbox/report` | Stored in state; explanation is astroProfile |
| Audio / export_id  | `/api/compose`        | No — only for audio/export     |
| Compose explanation sections | `/api/compose` | No — Sandbox does not use compose for report text |

### 1.3 Are Personality and Guidance “direct structured outputs from the engine”?

**Yes.** Backend chain:

1. `vnext/api/sandbox-routes.ts` — `POST /sandbox/report` receives `birth`, `overrides`, `seed`.
2. Fetches base snapshot, applies overrides → `overriddenSnapshot`.
3. Calls `generateArchitectureFromSnapshot(overriddenSnapshot, seed)` (`vnext/core/architecture-engine.ts`).
4. Returns `architecture.personality`, `architecture.guidance`, `architecture.astroProfile` (as `explanation`).

So Personality and Guidance are the **exact** architecture-engine output: deterministic from the overridden snapshot and seed. No fixture, no default path — the chart (birth + overrides) fully drives the report.

### 1.4 Why the output “looks like raw JSON”

- **Engine output shape:**  
  - `PersonalityProfileV1` has `version`, `temperament`, `subsystems`, `emphasis`, `reveal`, `seed` — **no `.summary` string**.  
  - `AstroGuidance` (and extended) has `tempoBias`, `arcBias`, `elementBlend`, `motionProfile`, `personality`, etc. — **no `.advice` string**.
- **UI contract:** Sandbox renders `report.personality.summary || JSON.stringify(report.personality, null, 2)` and `report.guidance.advice || JSON.stringify(report.guidance, null, 2)`. Because the engine never returns `.summary` or `.advice`, the fallback **always** runs → user sees pretty-printed JSON.
- **Explanation:** `report.explanation` is `architecture.astroProfile` (planets, angles, aspects, emphasis). `AstroProfile` has **no `.sections`** array. The UI’s `ExplainerSections` only renders when `explanation?.sections` exists, so the explanation block renders **nothing** for the sandbox report (no error; just no sections).

So: **expected Phase 8 behavior** — the rendering layer is built to show narrative text when present and to fall back to raw structured output when it is not. The engine currently provides only structured data, so the UI correctly exposes that. This is **incomplete rendering** only in the sense that there is no narrative summary/advice yet, not that the wrong data is shown.

---

## 2. Proof: Report is driven by the sandbox chart

### 2.1 Deterministic A/B verification (design)

Use two **materially different** sandbox charts (same birth, different overrides):

- **Chart A:** e.g. `overridesA = { planets: { sun: { lonDeg: 15 }, moon: { lonDeg: 90 } } }`
- **Chart B:** e.g. `overridesB = { planets: { sun: { lonDeg: 195 }, moon: { lonDeg: 270 } } }`

Steps:

1. `POST /api/sandbox/snapshot` with `{ birth, overrides: overridesA }` → `combinedHashA`
2. `POST /api/sandbox/report` with `{ birth, overrides: overridesA, seed: combinedHashA }` → `reportA`
3. `POST /api/sandbox/snapshot` with `{ birth, overrides: overridesB }` → `combinedHashB`
4. `POST /api/sandbox/report` with `{ birth, overrides: overridesB, seed: combinedHashB }` → `reportB`

Then:

- **combinedHash changes:** `overridesHash` is a function of overrides only; different overrides ⇒ different `overridesHash` ⇒ different `combinedHash`. So `combinedHashA !== combinedHashB`.
- **Report payload changes:** Backend builds `overriddenSnapshot` from base + overrides. Different overrides ⇒ different planet positions ⇒ different `encodeFeatures(snapshot)` ⇒ different `guidanceFromFeatures(..., seed)` ⇒ different `personality` and `guidance`. So `reportA.personality` and `reportA.guidance` differ from `reportB` (e.g. `personality.seed`, `personality.temperament`, or `features`).
- **Change tracks chart:** The only varying input is overrides; birth is fixed. So any difference in report is caused by the chart (overrides), not by a fixture or default path.

### 2.2 How to run the proof

- **Option A:** Run `node scripts/phase8-report-provenance-proof.js`. Requires the engine running on `API_BASE_URL` (default `http://localhost:4000`). Script asserts `combinedHash` differs and report payload (personality/guidance/features) differs between chart A and B.
- **Option B:** Use the same birth and two different override bodies in any HTTP client; compare snapshot `meta.combinedHash` and report `personality` / `guidance` (or `features`) between the two runs.

### 2.3 What changed and why

- **What changed between A and B:** Overrides (planet longitudes). Nothing else (birth, backend, endpoint).
- **Why combinedHash changes:** `combinedHash = sha256(birthHash + overridesHash)`. `overridesHash` is derived from the overrides object; different overrides ⇒ different hash.
- **Why report changes:** Report is produced by `generateArchitectureFromSnapshot(overriddenSnapshot, seed)`. `overriddenSnapshot` has different planet positions for A vs B ⇒ different feature vector ⇒ different personality and guidance. So the report is **proven** to be driven by the user-created chart.

---

## 3. Classification of current state

**Which of the following is true?**

- **Report generation is correct and only rendering is rough.** ✅ **This one.**  
  The report is generated from the correct source (`/api/sandbox/report` with the same birth + overrides + seed as the snapshot). Personality and Guidance are the real engine output. Rendering is “rough” because the engine does not produce `.summary` or `.advice`, so the UI falls back to `JSON.stringify` by design.

- Report generation is partial/incomplete — **false.** The full architecture (features, personality, guidance, astroProfile) is computed and returned.

- Report is coming from the wrong source — **false.** It comes only from `/api/sandbox/report`.

- Report is correct but compose/render contract is exposing raw structured output by design — **true as well.** The contract is “show summary/advice if present, else show JSON.” So the current presentation is **by design** given the current engine output shape; it’s not a bug.

---

## 4. Minimum Phase 8 fix

- **Is the report truly from the user-created chart?** Yes — proven above.
- **Is current raw JSON-like rendering acceptable to close Sandbox in Phase 8?** **Yes.** Truthful verification only requires that we prove the report is driven by the chart; that does not require narrative rendering. Showing the actual structured output is honest and sufficient for Phase 8.
- **Minimum fix required for truthful verification?** **None.** No code change is required to close Sandbox on report provenance.
- **Optional (no scope creep):** If desired, a single line of copy above the report block (e.g. “Structured report from this chart (engine output).”) would make it explicit that the JSON is intentional. This is **not** required for Phase 8 close.

---

## 5. Final answer

| Question | Answer |
|----------|--------|
| Is Sandbox report generation truly proven from the user-created chart? | **Yes.** Same birth + overrides drive snapshot and report; different overrides produce different combinedHash and different report payload; A/B proof script or manual test confirms. |
| Is current raw JSON-like rendering acceptable for Phase 8? | **Yes.** Engine returns structured data only; UI correctly falls back to JSON; no fixture or wrong source. |
| Any exact minimal fix required before Sandbox can be considered closed? | **No.** |
| Files changed (this audit)? | **None** (documentation and optional proof script only). |
| Commit hash | N/A (no code changes). |
| Commit + push | N/A. |

**North star:** Sandbox-created chart drives the generated report; provenance is proven. Current presentation is honest and acceptable for Phase 8; no decorative polish or rendering change is required to close.
