# Synastry S5 Stage C — Tier 2 sampling audit (deliverable)

**Branch:** `beta-ui-vercel`  
**Inputs:** `docs/SYNASTRY-S5-LIBRARY-COVERAGE-INVENTORY.csv` (Tier 2 flags), `docs/SYNASTRY-S5-STAGE-B-DELIVERABLE.md`, `vnext/scripts/synastry-s5-tier1-audit-render.ts` (unchanged harness).

---

## Tier 2 inventory verification (from CSV)

In `docs/SYNASTRY-S5-LIBRARY-COVERAGE-INVENTORY.csv`, **`tier_2_candidate=true`** applies to **46** contiguous keys from `JUPITER_SUN_OPPOSITION` through `JUPITER_MOON_OPPOSITION` (proxy ordering per Stage A).

| Segment | Keys | `coverage_state` |
|---------|------|------------------|
| `JUPITER_SUN_OPPOSITION` | 1 | covered |
| `SATURN_SUN` × 5 | 5 | covered |
| `URANUS_SUN` × 5 | 5 | covered |
| `NEPTUNE_SUN` × 5 | 5 | covered |
| `PLUTO_SUN` × 5 | 5 | covered |
| `SUN_SUN` × 5 | 5 | **uncovered** (no library objects) |
| `MOON_MERCURY` × 5 | 5 | **uncovered** |
| `MOON_VENUS` × 5 | 5 | covered |
| `MOON_MARS` × 5 | 5 | covered |
| `JUPITER_MOON` × 5 | 5 | covered |

**Eligible for Tier 2 content audit (covered):** **36** keys (46 − 10 uncovered). *(Any prior “42 / 4” split does not match this inventory; the CSV is authoritative.)*

---

## Sample selection (12 covered keys)

**Goals:** (1) **Body-combination diversity** across outer-to-Sun, Saturn-Sun, Moon–personal, Jupiter–Moon; (2) **≥2 keys per aspect type** across the 12 picks; (3) **Tier transition** — include keys just after the Tier 1/Tier 2 boundary and keys near the end of Tier 2.

**Reproducible rule set:** From the **36** covered Tier 2 keys only, choose exactly one key per listed slot below (fixed aspect keys). Anyone applying the same slot table to the same inventory recovers this set.

| # | `aspect_key` | Body family | Aspect type | Tier position note |
|---|--------------|-------------|-------------|-------------------|
| 1 | `JUPITER_SUN_OPPOSITION` | Jupiter–Sun | opposition | First Tier 2 key (immediate post–Tier 1 boundary) |
| 2 | `SATURN_SUN_CONJUNCTION` | Saturn–Sun | conjunction | Early Tier 2 |
| 3 | `SATURN_SUN_SQUARE` | Saturn–Sun | square | Emphatic hard aspect |
| 4 | `URANUS_SUN_SEXTILE` | Uranus–Sun | sextile | Outer–Sun, lighter aspect |
| 5 | `URANUS_SUN_TRINE` | Uranus–Sun | trine | Outer–Sun, flowing aspect |
| 6 | `NEPTUNE_SUN_SEXTILE` | Neptune–Sun | sextile | Second outer sextile (diversity vs Uranus) |
| 7 | `NEPTUNE_SUN_TRINE` | Neptune–Sun | trine | Outer–Sun trine |
| 8 | `PLUTO_SUN_CONJUNCTION` | Pluto–Sun | conjunction | Outer–Sun, fusion tone |
| 9 | `PLUTO_SUN_OPPOSITION` | Pluto–Sun | opposition | Outer–Sun polarity |
| 10 | `MOON_VENUS_OPPOSITION` | Moon–Venus | opposition | Lunar–personal, late Tier 2 band |
| 11 | `MOON_MARS_SQUARE` | Moon–Mars | square | Lunar–personal tension |
| 12 | `JUPITER_MOON_CONJUNCTION` | Jupiter–Moon | conjunction | Last body family in Tier 2 covered block |

**Aspect-type coverage across the 12:** conjunction ×3, sextile ×2, square ×2, trine ×2, opposition ×3 — each type appears **≥2** times except conjunction/sextil… wait: conjunction 3, sextile 2, square 2, trine 2, opposition 3 — all five types ≥2? conjunction 3 ✓, sextile 2 ✓, square 2 ✓, trine 2 ✓, opposition 3 ✓.

**Uncovered families not in sample:** `SUN_SUN_*`, `MOON_MERCURY_*` — excluded by definition (no `getAspectInsight` row); noted for v2 authoring queue.

---

## Methodology

Same as Stage B (`docs/SYNASTRY-S5-STAGE-B-DELIVERABLE.md`): composed MEP string = `core` + `behavioral` + (`friendship` | `romantic`) via `npm run audit:tier1-render -- <ASPECT_KEY>`. **Path I** unchanged: `flag_followup` would be CSV-only (none in this sample).

---

## Aggregate results (24 renders = 12 keys × 2 variants)

| Verdict | Count |
|---------|-------|
| **accept** | 0 |
| **revise** | 24 |
| **flag_followup** | 0 |

| Criterion | fail (rows) | pass (rows) |
|-----------|-------------|-------------|
| **P1** | 24 | 0 |
| **P2** | 0 | 24 |
| **P3** | 0 | 24 |
| **P4** | 0 | 24 |

---

## Pattern outcome

**Confirmed:** All **12** sampled covered Tier 2 keys fail **P1** on **both** variants for the **same structural reason** as Stage B Tier 1: **natal-authored `core` + `behavioral` bulk** dominates the composed render; **friendship / romantic** tails add dyadic color but **do not** re-scope the main text to **Person A vs Person B** cross-chart ownership.

**Counterexamples:** **None** in the sample (no `accept` verdicts).

**Interpretation:** Not mixed; the Stage B structural assumption **generalizes** to this Tier 2 slice. v2 synastry authoring should still plan for **broad library rework**, not only Tier 1 keys.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Tier 2 sample audit CSV | `docs/audit-logs/synastry-tier2-sample-audit-v1.csv` (**24** data rows + header) |
| Kill list (extended) | `vnext/projection/insight-library/aspect-library-kill-list.ts` |

**Kill-list state after Stage C:** **31** entries total (**19** Stage B Tier 1 + **12** Stage C sample). Each Stage C `revise` maps to one new `aspectKey` row; `auditArtifactRef` points at the **friendship** row in the Tier 2 CSV (`rows 2, 4, …, 24`).

---

## Post-S5 / v2 handoff recommendation

1. **Treat natal-frame `core` + `behavioral` as non-shipping for synastry MEP** until rewritten or replaced with synastry-scoped copy (or a dedicated synastry field split), consistent with Stage B + Stage C findings.  
2. **Kill-list** currently blocks **31** keys; v2 passes should remove entries after P1–P4 re-audit with evidence in the audit CSV.  
3. **Uncovered Tier 2 keys** (`SUN_SUN_*`, `MOON_MERCURY_*`): author net-new objects; no kill-list row until published.  
4. **Remaining Tier 2 covered keys** (36 − 12 = **24** not sampled): sampling did not audit them; if product risk tolerance is low, optional **Stage C+** full Tier 2 pass or spot-check before trusting pattern on every row — sampling supports but does not **prove** all 36 identical without reading each.

---

## Render harness

Unchanged: `npm run audit:tier1-render -- <ASPECT_KEY>` (builds via `vnext:build`, emits JSON for friendship and romantic composed bodies).

---

## Verification

| Command | Result |
|---------|--------|
| `npx tsc -p vnext/tsconfig.json --noEmit` | Pass (run locally after edits) |
| `npm run test:synastry-compute` | Pass |
| `npm run test:unified-projection` | Pass |

---

*Reviewer: `s5-tier2-sampler` — single-reviewer authority for this sampling pass.*
