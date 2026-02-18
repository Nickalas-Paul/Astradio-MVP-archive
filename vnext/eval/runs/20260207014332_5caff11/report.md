# Golden set evaluation report

**Run:** 20260207014332_5caff11  
**Base URL:** https://astradio-mvp-archive.onrender.com  
**Git SHA:** 5caff11

## Summary

| Metric | Value |
|--------|--------|
| Total | 25 |
| Passed (200) | 25 |
| Failed | 0 |
| 4xx | 0 |
| 5xx | 0 |
| WAV invalid (export on) | 0 |
| Audio missing when export available | 0 |
| Avg elapsed_ms (200 only) | 1892 |
| P95 elapsed_ms | 2350 |

## Diff vs baseline

- **Changed audio sha:** 22 cases
  - golden-001, golden-002, golden-003, golden-004, golden-005, golden-006, golden-007, golden-008, golden-009, golden-010, golden-011, golden-012, golden-014, golden-015, golden-016, golden-017, golden-018, golden-019, golden-020, golden-021, golden-022, golden-025
- **Changed wav_valid:** 0 cases
- **Changed http_status:** 0 cases
- **Changed audio_export_available:** 0 cases
- **Large audio size delta (>1KB):** 0 cases
- **Elapsed regressions (>500ms):** 24 cases
  - golden-001, golden-002, golden-003, golden-004, golden-005, golden-006, golden-007, golden-008, golden-009, golden-011, golden-012, golden-013, golden-014, golden-015, golden-016, golden-017, golden-018, golden-019, golden-020, golden-021, golden-022, golden-023, golden-024, golden-025


## Artifacts

- `results.json` — full case results in this run directory.
- Baseline: `vnext/eval/baseline/results.json` (update with `npm run test:compose-golden-baseline`).
