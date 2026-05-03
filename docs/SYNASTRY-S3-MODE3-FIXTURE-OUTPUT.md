# S3 Mode 3 — three group aggregate fixtures (N≥3, `group_matrix` + `group_aggregate`)

Synthetic **`kind: 'group'`** aggregate projection with deterministic **`relational_weather_v1`** (`connection.kind: 'group'`). Pre wiring simulates **pre–Mode-3** compose behavior (`pair_interaction_aspects` omitted for N≥3). Post wiring reflects **S3 Mode 3** (`pair_interaction_aspects` from `computeSynastryAspects({ mode: 'group_matrix' })` on all ordered natals; cap 32 and R1 ranking are **inside** the primitive).

**Machine-readable output:** [SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json](./SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json) (`generatedAt` inside that file).

**Regenerate**

```bash
npm run fixture:synastry-s3-mode3-pre-post
# UTF-8 cleanly on Windows CMD (avoid mojibake in JSON):
cmd /c "chcp 65001 >nul && node dist/vnext/vnext/scripts/synastry-s3-mode3-pre-post.js > docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json"
```

## Summary table

| Fixture | Pre keys (`aspectLibraryKeysFirst3`) | Post keys | Post `aspectSource` | Post `synastry_context` | Synastry rows (post) | Cap | `signaturesChanged` | `relationalFieldChanged` | `relationalWeatherChanged` |
|--------|----------------------------------------|-----------|---------------------|-------------------------|----------------------|-----|----------------------|--------------------------|----------------------------|
| `mode3_group_three_charts` | Anchor natal (`SUN_MOON_TRINE`, …) | `SUN_MERCURY_OPPOSITION`, … | synastry | `group_aggregate` | 32 (hits cap) | binds | yes | no | no |
| `mode3_group_four_charts` | Anchor natal | `SUN_SUN_OPPOSITION`, … | synastry | `group_aggregate` | 32 | binds | yes | no | no |
| `mode3_group_six_charts` | Anchor natal | `SUN_SUN_OPPOSITION` (×3) | synastry | `group_aggregate` | 32 | binds | yes | no | no |

The JSON also includes:

- **`singleChartProjectionRepeatedIdentical`** — two identical profile projection runs (byte-identical gate).
- **`mode1ComparisonPostSynastryControl`** — same three Mode 1 comparison fixtures (post-synastry slices; compare to [SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json](./SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json) `postSynastry`).
- **`mode2GroupTwoChartsPostSynastryControl`** — `mode2_feed_expanded_1` with **`synastry_context: "pair_comparison"`** (contrast with Mode 3’s **`group_aggregate`**).

## Interpretation

- **`relationalWeatherChanged: false`** across fixtures: toggling synastry does not move weather prose; weather stays independent of synastry compute.
- **`relationalFieldChanged: false`** across fixtures: relational field template unchanged by synastry toggle for these seeds.
- **`aspectLibraryKeysFirst3`** uses **`buildAspectKey(bodyA, bodyB, type)`** — it does **not** encode which chart pair produced the hit. Duplicate keys in the post list (e.g. three `SUN_SUN_OPPOSITION`) can mean multiple directed hits or multiple chart pairs sharing the same ranked body-aspect shape after global R1 sort.
- **Cap binding:** With these materially distinct natals, all three fixtures produced **32** post-cap synastry rows (the group cap binds). Finer-grained chart-pair attribution requires internal deterministic tie keys (`synastry-compute` header), not `aspectLibraryKeysFirst3` alone.
