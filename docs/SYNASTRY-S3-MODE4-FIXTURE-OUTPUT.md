# SYNASTRY-S3-MODE4-FIXTURE-OUTPUT

Committed snapshot of **`npm run fixture:synastry-s3-mode4-pre-post`** output (see **`docs/SYNASTRY-S3-MODE4-FIXTURE-OUTPUT.json`**).

## Regenerate (UTF-8, Windows-friendly)

```bash
npm run fixture:synastry-s3-mode4-pre-post
```

```bash
cmd /c "chcp 65001 >nul && node dist/vnext/vnext/scripts/synastry-s3-mode4-pre-post.js" > docs/SYNASTRY-S3-MODE4-FIXTURE-OUTPUT.json
```

## Contents

- **Control blocks:** Mode 1 post-synastry rows, Mode 2 two-chart group post-synastry, Mode 3 three-chart group post-synastry (`mode3GroupThreeChartsPostSynastryControl`).
- **subsectionA_sandboxFixtures:** Four sandbox-oriented cases (pair no overrides, pair with Mars override + DB vs effective synastry diff, three-chart group with mixed longitudes, birth-only pair).
- **subsectionB_commitFlag:** Preview vs commit semantics for `commit_relational_classification` (fixture uses stable library code `cohesive_field` for projection wiring when relational DB is unavailable).
- **subsectionC_asteroidNotice:** Detection table for `asteroids_excluded_v1` vs override presence.

Single-chart determinism: **`singleChartProjectionRepeatedIdentical`** at top level.
