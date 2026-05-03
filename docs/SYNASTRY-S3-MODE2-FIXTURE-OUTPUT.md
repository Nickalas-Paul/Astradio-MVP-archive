# S3 Mode 2 — three Community Feed expanded (group, two natals + relational weather)

Synthetic **`kind: 'group'`** aggregate projection with deterministic **`relational_weather_v1`** on canonical (transit context). Pre wiring simulates **pre–Mode-2** compose behavior (`pair_interaction_aspects` omitted). Post wiring reflects **S3 Mode 2** (`pair_interaction_aspects` from `computeSynastryAspects(..., mode: 'pair')` on the two ordered natals — **no** transit mixed into synastry).

**Machine-readable output:** [SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json](./SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json) (`generatedAt` inside that file).

**Regenerate**

```bash
npm run fixture:synastry-s3-mode2-pre-post
# Snapshots UTF-8 cleanly on Windows CMD:
cmd /c "node dist/vnext/vnext/scripts/synastry-s3-mode2-pre-post.js > docs/SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json"
```

## Summary table

| Fixture | Pre keys (`aspectLibraryKeysFirst3`) | Post keys | Post `aspectSource` | Signatures changed | Relational field changed | Relational weather changed |
|--------|----------------------------------------|-----------|---------------------|---------------------|--------------------------|----------------------------|
| `mode2_feed_expanded_1` | Anchor natal (`SUN_MOON_TRINE`, …) | `SUN_MERCURY_OPPOSITION`, … | synastry | yes | no | no |
| `mode2_feed_expanded_2` | Anchor natal (`SUN_MARS_SQUARE`, …) | `SUN_SUN_OPPOSITION`, … | synastry | yes | no | no |
| `mode2_feed_expanded_3` | Anchor natal (`PLUTO_MOON_TRINE`, …) | `SUN_SUN_OPPOSITION`, … | synastry | yes | no | no |

The JSON also includes **`singleChartProjectionRepeatedIdentical`** (two identical profile projection runs; byte-identical gate) and **`mode1ComparisonPostSynastryControl`** (same three Mode 1 comparison fixtures with post-synastry slices — compare to [SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json](./SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json) `postSynastry` to confirm the comparison path was not altered by Mode 2 work).

## Interpretation

- **`relationalWeatherChanged: false`** across fixtures: weather prose is stable when toggling synastry only; transit/weather remains on its own layer (`relational_weather` on canonical + `relational_weather_v1` section).
- Post keys include cross-chart shapes (**`SUN_SUN_OPPOSITION`**, cross-chart **Sun–Mercury**), distinct from anchor-only ordering where applicable.
- **`relationalFieldChanged: false`**: same template-driven behavior as Mode 1 for these fixtures.
