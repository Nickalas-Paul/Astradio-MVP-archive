# ML fail-closed enforcement (no silent fallbacks)

The system **always** fails closed: no controls or audio if ML inference was not used.

## Where it is enforced

1. **Check**  
   `vnext/api/compose.ts` (ComposeAPI.compose), immediately after `generatePlanMLOnly`:
   - If `!mlUsed` (i.e. `diag.ml_used === false`): throw an `Error` with `code === 'ML_INFERENCE_UNAVAILABLE'`.
   - Exact location: **`if (!mlUsed)`** block after the `[COMPOSE_ML]` log.

2. **Thrown on inference failure**  
   `vnext/ml/index.ts` (`studentVector`): on load or inference failure, throws (no fallback return) with `code === 'ML_INFERENCE_UNAVAILABLE'`.

3. **HTTP response**  
   `vnext/api/compose.ts` (`vnextCompose` handler), in the `catch`:
   - If `error?.code === 'ML_INFERENCE_UNAVAILABLE'`: respond with **503** and JSON `{ error, code: 'ML_INFERENCE_UNAVAILABLE', timestamp }`. **Do not** return `controls` or `audio`.

## Result

- Whenever `ml_used === false` or ML inference fails: **503**, **no** controls/audio, **no** silent fallback.
- `ML_REQUIRED=1` is still used at **startup** (server) to refuse to start without a valid model when strict.
