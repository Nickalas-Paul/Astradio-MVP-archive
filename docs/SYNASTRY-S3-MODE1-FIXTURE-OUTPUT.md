# S3 Mode 1 — three Static A+B fixture outputs (pre vs post synastry)

This document summarizes a local run of `vnext/scripts/synastry-fixture-pre-post.ts`: three **synthetic** full snapshots, comparison aggregate pipeline, and **signatures** + **relational_field** (aspect-library–backed slices) with vs without `pair_interaction_aspects`. **No database** is required; the Postgres URL in the handoff is optional for real chart IDs.

**Full machine-readable output:** [SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json](./SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json) (captured from the same run as the `generatedAt` inside that file).

**Regenerate**

```bash
npm run fixture:synastry-s3-pre-post
# or, to overwrite the JSON snapshot:
npm run fixture:synastry-s3-pre-post > docs/SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json
```

## Side-by-side summary

| Fixture | Pre top aspect keys (anchor natal) | Post top aspect keys (synastry) | `keysDifferFromAnchor` | Signatures text changed | Relational field changed |
|--------|-------------------------------------|----------------------------------|--------------------------|-------------------------|--------------------------|
| `fixture_1_spread_cross_emphasis` | `SUN_MOON_TRINE`, `JUPITER_MERCURY_SQUARE`, `NEPTUNE_JUPITER_TRINE` | `SUN_MERCURY_OPPOSITION`, `SUN_MERCURY_OPPOSITION`, `MOON_MERCURY_SEXTILE` | yes | yes | no |
| `fixture_2_tight_personal_cross` | `SUN_MARS_SQUARE`, `PLUTO_SUN_OPPOSITION`, `JUPITER_MARS_SEXTILE` | `SUN_SUN_OPPOSITION`, `SUN_SUN_OPPOSITION`, `SUN_MOON_CONJUNCTION` | yes | yes | no |
| `fixture_3_outer_vs_inner` | `JUPITER_MERCURY_SEXTILE`, `URANUS_MOON_TRINE`, `JUPITER_MARS_SQUARE` | `SUN_SUN_OPPOSITION`, `SUN_SUN_OPPOSITION`, `JUPITER_MARS_SQUARE` | yes | yes | no |

## Interpretation

- **Assembler branch:** In all three runs, **pre** reports `aspectSource: "anchor_natal"` and **post** reports `aspectSource: "synastry"` with **different** `aspectLibraryKeysFirst3`, so the insight-library lookup is not stuck on anchor-only aspects when synastry hits exist.
- **Cross-chart vs natal:** Post keys include directed pair tokens such as `SUN_MERCURY_OPPOSITION` and **`SUN_SUN_OPPOSITION`** (same body across charts), which do not appear as natal self-aspects in the anchor-only list for these fixtures.
- **Signatures:** All three fixtures show **`signaturesChanged: true`** — the opening aspect-library paragraphs swap to match the synastry key order.
- **Relational field:** **`relationalFieldChanged: false`** for these fixtures — that slice appears template-stable independent of which aspect keys win; checking **signatures** + keys is the right signal for S3 Mode 1 wiring.

If **pre and post** were identical for **both** keys and **signatures**, investigate compose/projection wiring or a degenerate chart pair (synastry top hits coincidentally matching anchor natal ordering).
