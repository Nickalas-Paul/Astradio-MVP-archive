# Naming taxonomy contract (authoritative)

## Glossary (quick disambiguation)

- **Phase 6** → **Product:Phase-6** — sandbox composition system (delivery milestone).
- **Phase 6B** → **Proj:** aggregate expression wave (legacy naming); `P6B-*` **rule_id** family — not a product phase.
- **Stage 6** → **Acct:Stage-6** — sandbox compositions owner isolation (accounting / persistence).
- **Phase D / `phaseD`** → **Proj:** full projection post-process (legacy API flag) — not a product phase.
- **`phase5a-*` / `phase5b-*` modules** → **Proj:** deterministic expression filter engines (legacy filenames) — not Product phases.
- **`campaign/phase1/`** → **Campaign:** daily pressure resolver pipeline slice — not **Product:Phase-1**.
- **`vnext/compat/` vs `vnext/compatibility/`** → **Compat** = legacy chart/storage/routes; **compatibility** = scoring / relational field — same domain word, different trees (converge only in a versioned migration).

---

## 1. Four axes (orthogonal)

- **Product:Phase-N** — Shipped delivery milestones (docs, release, historical migrations). Not used for projection mechanics or DB stages.
- **Proj:** — Deterministic text projection (steps, layers, waves). New work must not introduce Product-style "Phase N" names.
- **Acct:Stage-N** — Persistence, ownership, canonical data milestones. Numbers are not aligned with Product:Phase-N.
- **Verify:** — Test and verification slices. Must not use bare "Stage N" without a Verify prefix and parent scope (e.g. Verify:P8-Slice-03).

## 2. Reserved words

- **Phase** → Product axis only (new prose and identifiers).
- **Stage** → Accounting axis only (new prose and identifiers).
- **Step / Layer / Wave** → Projection or architecture; never as shorthand for Product Phase or Acct Stage.

## 3. Immutable identifiers (do not rename without a versioned migration)

- Shipped **`rule_id`** strings and their ordering contracts.
- Public **API paths** and **table/column** names unless a major migration is approved.
- **Golden / hash baselines** tied to the above.

## 4. Interpretation of known collisions (until code renames)

- **"Phase 6"** means **Product:Phase-6** (sandbox composition) unless explicitly prefixed otherwise.
- **"Phase 6B" / `P6B-*`** means **Proj: expression wave** with frozen rule IDs; not a product phase.
- **"Stage 6"** means **Acct:Stage-6** (sandbox compositions owner isolation); not Product:Phase-6.

## 5. New work rules

- New modules/scripts/APIs: **semantic names**; no `phaseN` / `stageN` as the primary token unless adding to an existing grandfathered family with review.
- New **`rule_id`**: new prefix family; never recycle or rename shipped IDs.
- Documentation: first mention of any number must include **axis prefix**.

## 6. Governance

- This contract wins over informal comments and commit messages when they conflict.
- Changes to this contract require explicit review and changelog entry.

---

## Appendix A — Repository adoption (forward-only)

- Ambiguous comments in high-collision zones SHOULD use axis prefixes (`Product:`, `Acct:`, `Proj:`, `Verify:`) per this doc.
- Legacy filenames, `rule_id` values, public routes, and DB identifiers remain frozen until an explicit versioned migration.
- **Verify:P8-Slice-03** names the multi-profile / compose-orchestration verification slice historically tied to “Phase 8 — Stage 3” script titles (filenames unchanged).
- **DataGen:Step-N** in snapshot-generation logs names the ML/snapshot batch pipeline only — not **Acct:Stage-N** and not **Verify:**.
