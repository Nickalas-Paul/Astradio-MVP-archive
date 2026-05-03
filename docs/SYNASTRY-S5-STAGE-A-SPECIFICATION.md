# Synastry S5 Stage A — Specification (kill-list + duplicate-key rendering)

**Status:** Stage A design and inventory only — no shipping implementation of kill-list or dedupe in this phase.  
**Branch:** `beta-ui-vercel`  
**Inputs:** `docs/PHASE-S5-STAGE-A-PRE-AUDIT.md`, `docs/SYNASTRY-PROPOSAL.md` §9, `docs/SYNASTRY-S5-LIBRARY-COVERAGE-INVENTORY.csv`  
**Verify:** `tsc -p vnext/tsconfig.json --noEmit` (documentation + inventory only; no runtime source edits required for Stage A).

---

## Resolutions log (Stage A decisions)

| # | Topic | Decision | Rationale (short) |
|---|--------|----------|-------------------|
| 1 | **Kill-list assembler behavior** (Subsection B) | **(a)** For a kill-listed key, treat as if `getAspectInsight(key)` returned **`undefined` for that row** — the row contributes **no** library block; existing `.filter` / absence path applies. | Avoids authoring and maintaining fallback copy in Stage A–B; minimizes compounding with web forbidden-substring / Jaccard policy layers; matches “suppress this library entry” semantics without new prose paths. |
| 2 | **Kill-list consumer path scoping** | **Primary:** behavior is defined at the **vnext assembler** boundary (same path as today’s MEP slice). **Visibility:** kill-list vs uncovered is **not** user-distinguishable under (a); **diagnostics** (optional dev flag or structured diagnostics field) carry `kind: 'kill_list' \| 'uncovered'` per suppressed row. | With (a), web and vnext both omit library prose for that row — **aligned outcomes**. If a future phase adopts (b), fallback strings must be validated against `SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN` and near-duplicate risk against template/MEP clauses under `finalizeRelationalReadingSurfaces`. |
| 3 | **Duplicate-key rendering** (Subsection C) | **(b)** **Deduplicate by `buildAspectKey`**, render **once**; **first ranked row** among duplicates wins (subsequent same-key rows skipped for library purposes). | Avoids repeated identical paragraphs (broken UX when v2 fills gaps); does not require chart-pair plumbing (rejects (c) for Stage A scope). |
| 4 | **Dedupe vs slice ordering** | **Dedupe-then-fill-to-three-distinct:** walk **`pairInteractionAspects` (or anchor fallback list) in R1 rank order**; skip a row if its `buildAspectKey` was already selected; stop when **three distinct keys** are collected **or** the list ends. Then run `getAspectInsight` on those ≤3 keys. | Maximizes use of the three library slots for **distinct** interpretive angles while respecting global rank; contrasts with slice-then-dedupe, which can waste slots on duplicates and never surface row 4’s distinct key. |

---

## Subsection A — Library coverage inventory (reference)

### Artifact

- **`docs/SYNASTRY-S5-LIBRARY-COVERAGE-INVENTORY.csv`** — one row per canonical `buildAspectKey` over **CORE_BODIES × CORE_BODIES** unordered pairs (55) × **five aspect types** (275). UTF-8.

### Regeneration

- Maintainer script (non-shipping): `vnext/scripts/generate-s5-library-coverage-inventory.mjs`  
- Run: `node vnext/scripts/generate-s5-library-coverage-inventory.mjs`  
- **Covered** membership is asserted against the merged aspect modules that populate `ASPECT_INSIGHTS` in `vnext/projection/insight-library/insight-library-index.ts` (personal + Saturn + Jupiter + Uranus + Neptune + Pluto batches). Update the `COVERED_KEYS` construction in that script if library files change.

### Verification totals (reconciliation)

| Check | Expected | How to verify |
|-------|----------|-----------------|
| Total rows | **275** | Line count minus header |
| `coverage_state == covered` | **130** | Must equal distinct keys in merged `ASPECT_INSIGHTS` (current repo) |
| `coverage_state == uncovered` | **145** | `275 − 130` |
| `coverage_state == reserved` | **0** | No reserved members today; state is **defined-but-empty** for forward use (e.g. authored-but-quarantined keys without deleting objects) |
| `tier_1_candidate == true` | **24** | Matches proposal v2 §9 Tier 1 count |
| `tier_2_candidate == true` | **46** | Matches proposal v2 §9 Tier 2 count |
| Tier overlap | **0** rows with both tier flags true | Mutually exclusive slices of the global proxy ordering |

### Proxy rank ordering (Tier 1 / Tier 2 membership)

**Source:** `docs/SYNASTRY-PROPOSAL.md` §9 (proxy rank; no production telemetry assumed).

**Salience buckets (body-pair level, applied to canonical pair `body_a` / `body_b` in `PLANET_ORDER` — same ordering as `buildAspectKey` in `insight-library-index.ts`):**

1. **Salience 1:** Pair involves **Sun** or **Moon** (any core body, including luminaries with outers or self-pairs).  
2. **Salience 2:** Not salience 1, and pair involves **Venus** or **Mars**.  
3. **Salience 3:** Not salience 1–2, and pair involves **Mercury**.  
4. **Salience 4:** Not salience 1–3, and pair involves **Jupiter** or **Saturn**.  
5. **Salience 5:** **Outer–outer** only (Uranus, Neptune, Pluto among themselves).

**Aspect-type order within each pair (fixed for proxy list):**  
`conjunction` → `sextile` → `square` → `trine` → `opposition` (major-to-minor teaching cadence; matches inventory column `aspect_type`).

**Within salience 1 — teaching volume (canonical pair tokens):**  
`SUN_MOON`, then `SUN_MERCURY`, `SUN_VENUS`, `SUN_MARS`, then outers-to-Sun by increasing traditional “personal first” distance: `JUPITER_SUN`, `SATURN_SUN`, `URANUS_SUN`, `NEPTUNE_SUN`, `PLUTO_SUN`, then `SUN_SUN`, then Moon personal ladder: `MOON_MERCURY`, `MOON_VENUS`, `MOON_MARS`, `JUPITER_MOON`, `SATURN_MOON`, `URANUS_MOON`, `NEPTUNE_MOON`, `PLUTO_MOON`, `MOON_MOON`.  
Any salience-1 pair not in that explicit table is ordered **lexicographically by canonical pair token** after the table (stability guard).

**Salience 2–5:** Canonical pair tokens sorted **ASCII ascending** within the salience bucket.

**Global key order:** Concatenate: all keys (5 aspects each) for salience **1** pairs in the order above, then salience **2** pairs, then **3**, **4**, **5**.

**Tier boundaries on that global list:**

- **Tier 1 candidates:** global indices **0–23** (first **24** `buildAspectKey` values).  
- **Tier 2 candidates:** global indices **24–69** (next **46** keys).  
- **Remainder:** Tier 3 long tail (not flagged in CSV).

**Inventory note:** Tier 1 currently includes **five uncovered keys** (`SUN_MERCURY_*`) — flagged in CSV `notes` as `tier_1_proxy_scope_library_gap_v2` so Stage B and v2 authoring see audit priority vs library gap.

---

## Subsection B — Kill-list mechanism (design only)

### Three states (conceptual)

| State | `ASPECT_INSIGHTS` | Runtime meaning |
|-------|-------------------|-----------------|
| **Covered (passing)** | Entry exists | Normal path: library prose eligible for MEP slice. |
| **Kill-listed** | Entry exists | **Audit failure (P1 or P4)** — entry must **not** surface; assembler applies **Resolution (a)**. |
| **Uncovered** | No entry | **Content gap** — assembler already drops via `.filter`; **not** kill-list. |

**Why distinguish kill-listed vs uncovered:** Same user-visible omission under (a), but **telemetry**, **ship gates**, and **v2 authoring** differ: kill-listed implies “copy exists but is blocked”; uncovered implies “no copy authored yet.”

### Storage location (convention)

- **New file:** `vnext/projection/insight-library/aspect-library-kill-list.ts`  
- **Export:** `ASPECT_LIBRARY_KILL_LIST` — `ReadonlyArray<AspectLibraryKillListEntry>` or `ReadonlySet<string>` **plus** optional parallel array for metadata (sets alone lose reason codes).  
- **Rationale:** Matches pre-audit pattern for engine-adjacent rules (**TS const** / frozen objects), colocated with insight library, imported only from assembler or a thin helper — **not** JSON literals (those are used for feed/surfacing buckets, not per-key operational blocks).

### Entry shape

```ts
// Spec-only illustrative shape (not shipping in Stage A)
type KillListReasonCode = 'P1_PAIR_CLARITY' | 'P4_SAFETY' | 'P1_P4' | 'OTHER';

type AspectLibraryKillListEntry = {
  /** Canonical `buildAspectKey` output */
  aspectKey: string;
  /** Required for Stage B audit traceability */
  reasonCode: KillListReasonCode;
  /** ISO date string YYYY-MM-DD — optional but recommended */
  addedAt?: string;
  /** Optional short id (e.g. initials or handle) */
  reviewer?: string;
  /** Pointer to Stage B CSV row id or artifact path */
  auditArtifactRef?: string;
};
```

- **Required:** `aspectKey`, `reasonCode`.  
- **Recommended:** `auditArtifactRef`, `addedAt`, `reviewer` for ship-gate and blameless revert.  
- **Optional:** free-text `notes` only if kept short (avoid duplicating full audit prose in repo).

### Assembler behavior (Resolution 1a)

When building the MEP aspect-library slice, **after** `buildAspectKey` for a `SnapshotAspect` row:

1. If `getAspectInsight(key) === undefined` → existing **uncovered** path (row dropped from insight array).  
2. Else if `key` ∈ kill-list → **treat as uncovered for that row** (do not add insight object for that row; **do not** substitute anchor or generic prose in Stage A design).  
3. Else → use library insight as today.

**Policy interaction:** Under (a), no new strings — **web** and **vnext** omit that row’s library contribution. **No additional** forbidden-substring surface beyond today’s template/MEP stream. If a future phase adopts substitution (b), specify copy review against `apps/web/src/lib/reading-presentation-filter.ts` (`SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN`) and Jaccard / paragraph dedupe in `community-feed-reading-layout.ts` / `relational-reading-enforcement.ts`.

### Diagnostic distinction (kill-listed vs uncovered)

- **Minimum (Stage B friendly):** kill-list file carries **comments** referencing `auditArtifactRef` per key.  
- **Recommended (implementation phase):** when `options.projectionDiagnostics?.aspectLibrary === true` (or `NODE_ENV === 'development'`), emit a **structured** array on the returned sections’ meta or a side-channel log line per row: `{ aspectKey, resolution: 'covered' | 'uncovered' | 'kill_list' }`.  
- **Not required for Stage A:** persistent server telemetry schema.

### Operational process — adding a key

1. **Tier 1 audit** (Stage B) records a row in the structured CSV (e.g. under `docs/audit-logs/…`) with verdict failing **P1** or **P4** per proposal §9.  
2. **Escalation decision:** patch copy **or** kill-list per proposal.  
3. **Authority:** single reviewer sign-off on the audit row (per proposal methodology).  
4. **Code update:** developer adds an `AspectLibraryKillListEntry` to `ASPECT_LIBRARY_KILL_LIST` in `aspect-library-kill-list.ts`, referencing the CSV **row id / path@line** in `auditArtifactRef`.  
5. **Ship gate:** proposal §9 — zero open P1/P4 for shipped keys **or** explicit kill-list entry.

### Removal / unblock

1. Library content rewritten and merged (v2 authoring).  
2. **Re-audit** same key → **pass** P1–P4 (or at minimum P1/P4 per ship gate).  
3. Remove entry from `ASPECT_LIBRARY_KILL_LIST` in the same PR as content fix, with PR description citing audit verdict id.  
4. **Optional:** retain a line in the Stage B CSV history noting “previously kill-listed” — do **not** keep dead keys in the TS kill-list once cleared.

### Test surface (recommendation only)

- **No new tests in Stage A.**  
- **Stage B / implementation PR:** add unit tests when the kill-list module ships: (1) kill-listed key with defined `ASPECT_INSIGHTS` row → no library paragraph; (2) uncovered key → same omission; (3) diagnostics flag → resolutions differ where specified.  
- **Optional:** extend unified projection harness once diagnostics hook exists.

---

## Subsection C — Duplicate-key rendering (forward-looking design)

### Trigger condition

Activate when **multiple** ranked synastry (or anchor) rows in the **candidate stream** map to the **same** `buildAspectKey`, **`getAspectInsight(key)` is defined**, and the assembler is assembling the **MEP insight-library slice**.  
Today, **uncovered** duplicates collapse by filter-miss; this spec governs the **v2** case where the key becomes **covered**.

### Behavior (Resolution 3b + 4)

- **Walk rows in rank order** (post–cap-32 order from `computeSynastryAspects` for group matrix, or analogous ordered list for pair mode / anchor list).  
- **Maintain a `Set` of seen `buildAspectKey` values.**  
- For each row: compute `key`; if `key` already seen, **skip** for library purposes; if not seen and insight exists and key not kill-listed, **accept** and add `key` to seen.  
- **Stop** when **three distinct accepted keys** have been collected **or** the list is exhausted.  
- Render joined library text from those insights in acceptance order (`'\n\n'` join unchanged from current assembler).

### Implementation surface (recommendation)

- **New helper** e.g. `selectAspectLibraryRowsForMep(aspects: readonly SnapshotAspect[], opts): { rows: SnapshotAspect[]; keys: string[] }` in `vnext/projection/insight-library/select-aspect-library-mep-rows.ts` (or under `rule-layer/` if preferred for proximity to `assemble-sections.ts`).  
- **Called from** `assemblePhaseDSections` in `assemble-sections.ts` **replacing** the raw `.slice(0, 3)` for the MEP library path.  
- **Rationale:** Isolated, unit-testable, keeps `assemble-sections.ts` thinner.

### Interaction with cap-32

- Cap remains on **rows** in `synastry-compute.ts`.  
- **Dedupe-then-fill** may read beyond the first three **rows** to find three **distinct** keys (still bounded by list length ≤ 32 for group matrix).  
- **Distinct keys surfaced** can exceed what “first three rows only” would have allowed when duplicates dominated the head of the list.

### Backward compatibility / fixture drift

- **Today:** filter-miss and duplicate-covered interaction rarely expose three full library blocks.  
- **After v2 coverage + dedupe spec:** signatures may show **up to three distinct** library blocks where previously fewer or none — **expected improvement**, not a regression.  
- **S5 verification:** when comparing fixtures after v2 lands, assert **keys collected** and **dedupe invariants**, not byte-identical legacy strings conflated with “dedupe broke.”

### Test surface (recommendation only)

- **Not added in Stage A.**  
- **Implementation phase:** unit tests on the helper with synthetic `SnapshotAspect[]`: duplicates at head, distinct lower-ranked row should surface third slot; kill-list interaction; uncovered skips.  
- `synastry-compute.test.ts` remains the authority for **cap/rank**, not MEP dedupe.

---

## Out of scope (Stage A reminder)

- No keys kill-listed in TS until Stage B decisions.  
- No library authoring, no fixture regeneration, no golden hash updates.  
- No shipping code for kill-list or dedupe until follow-on implementation work.

---

*End of S5 Stage A specification.*
