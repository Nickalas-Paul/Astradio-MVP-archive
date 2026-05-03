# Synastry S5 Stage B — Tier 1 library content audit (deliverable)

**Branch:** `beta-ui-vercel`  
**Methodology:** `docs/SYNASTRY-PROPOSAL.md` §9 (Tier 1 full review, P1–P4).  
**Foundations:** `docs/SYNASTRY-S5-LIBRARY-COVERAGE-INVENTORY.csv`, `docs/SYNASTRY-S5-STAGE-A-SPECIFICATION.md`.

---

## flag_followup framing decision (Path I vs II)

**Choice: Path I** — `flag_followup` verdicts are recorded **only** in the audit CSV; the kill-list module holds **P1 / P4 launch-blocking** (`revise`) keys only. **Reasoning:** Keeps the kill-list aligned with assembler suppression semantics and avoids non-blocking annotations living in shipping code.

---

## Aggregate results

| Verdict | Count |
|---------|-------|
| **accept** | 0 |
| **revise** | 38 |
| **flag_followup** | 0 |
| **Total rows** | 38 |

All rows sum to **38** (19 covered Tier 1 keys × **friendship** + **romantic** variants). The five uncovered Sun–Mercury Tier 1 keys are **out of scope** for this audit (v2 authoring queue).

### Per-criterion failures (row-level, Tier 1 covered renders)

| Criterion | fail count | pass count |
|-----------|------------|------------|
| **P1 pair clarity** | 38 | 0 |
| **P2 attribution** | 0 | 38 |
| **P3 tone** | 0 | 38 |
| **P4 safety** | 0 | 38 |

---

## Artifacts

| Artifact | Path | Notes |
|----------|------|--------|
| Audit CSV | `docs/audit-logs/synastry-tier1-audit-v1.csv` | **38** data rows + header; UTF-8 |
| Kill list (shipping) | `vnext/projection/insight-library/aspect-library-kill-list.ts` | **19** entries (`ASPECT_LIBRARY_KILL_LIST`); `isAspectLibraryKillListed` wired in `assemble-sections.ts` |
| Compose helper | `vnext/projection/insight-library/synastry-aspect-library-render.ts` | Shared MEP string = production `compat_pair` / `group` assembly |
| Render harness | `vnext/scripts/synastry-s5-tier1-audit-render.ts` | After `vnext:build`, emits JSON for both variants |

---

## Kill-list integration

- Each **revise** row with P1 failure maps to **one** kill-list entry per **`aspect_key`** (first friendship row carries `kill_list_action=added`; romantic row `none` — shared suppression).
- `reasonCode`: **`P1_PAIR_CLARITY`** for all entries.
- `auditArtifactRef`: `docs/audit-logs/synastry-tier1-audit-v1.csv:row N` pointing at the **friendship** row for that key (rows 2, 4, 6, … 38 — even numbers).

---

## Notable findings

1. **Systemic P1 pattern:** For every audited key, **`core` + `behavioral`** text is written in a **natal / single-chart ego fusion** register (`this person`, `their identity`, internal integration). Under synastry MEP assembly (`composeSynastryMepAspectParagraph`), that bulk is concatenated **before** the shorter friendship or romantic clause, so the **dominant read remains intrapsychic** unless v2 rewrites the core/behavioral layers or replaces them for synastry surfaces.
2. **Variant tails alone do not salvage P1:** Friendship and romantic closing paragraphs are often **dyad-flavored** (`Partners…`, `Friends…`), but they do not re-scope the preceding paragraphs to **Person A vs Person B chart attribution** as required by the audit rubric.
3. **JUPITER_SUN batch matches the same pattern** as personal Sun–personal planet entries (heavy `this person` in core/behavioral).
4. **Unanticipated vs framing:** The audit rubric treats **any** sustained intrapsychic sentence without explicit two-chart scope as P1 fail; given current authoring, **all** Tier 1 covered keys fail rather than a tail of outliers — this is a **content-system** finding, not a wiring defect.

---

## Render harness

**Script:** `vnext/scripts/synastry-s5-tier1-audit-render.ts`  
**npm:** `npm run audit:tier1-render -- <ASPECT_KEY>`  
**Example:** `npm run audit:tier1-render -- SUN_MOON_CONJUNCTION`

Output is **deterministic** JSON (`friendship.text` / `romantic.text`) for a fixed library version — byte-stable across repeated invocations for the same key.

---

## Verification

| Command | Result |
|---------|--------|
| `npx tsc -p vnext/tsconfig.json --noEmit` | Pass |
| `npm run test:synastry-compute` | Pass |
| `npm run test:unified-projection` | Pass |

---

## Next

**Stage C (Tier 2):** batch review of the next **46** proxy-ranked keys per Stage A ordering — separate prompt; use the same render harness pattern where keys are covered.

---

*Reviewer identifier in CSV / kill-list: `tier1-single-reviewer` — single-reviewer authority per proposal §9.*
