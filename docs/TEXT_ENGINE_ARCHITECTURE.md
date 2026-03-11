### Astradio vNext Text Engine Architecture

**Status**: The vNext text engine is now frozen. Future features must consume the public interface rather than modify core engine logic.

---

### Interpretation pipeline

- **Ephemeris snapshot**: The engine receives an `EphemerisSnapshot` and related chart context through the `ChartTextInput` contract.
- **Profile and facts**: `buildTextAnalysis` derives an astro profile and constructs canonical `AstroFacts` (placements, house emphasis, aspects, and body registry).
- **Synthesis layer**: From `AstroFacts`, the engine synthesizes three kinds of interpretation nodes:
  - **Themes**: high-level patterns and emphases (`AnalysisTheme`).
  - **Tensions**: dynamic edges and frictions (`AnalysisTension` with polarity hints).
  - **Opportunities**: integration and growth pathways (`AnalysisOpportunity`).
- **Intermediate representation**: These synthesized nodes, plus confidence and optional music traits, are assembled into a single immutable `TextAnalysisIntermediate` object. This object is the canonical handoff between interpretation and presentation.

The pipeline is deterministic: given the same `ChartTextInput`, the engine produces the same `TextAnalysisIntermediate` node set and ordering.

---

### Node structure

- **Themes (`AnalysisTheme`)**
  - Emphasis patterns keyed by body or house.
  - Each theme has a stable id, label, numeric weight, and citations back to the astro facts it summarizes.
- **Tensions (`AnalysisTension`)**
  - Aspect-driven dynamics with polarity (`support`, `mixed`, `tension`).
  - Weights are derived from aspect ranking and body importance, enforcing that major-body structures outrank minor-only patterns.
- **Opportunities (`AnalysisOpportunity`)**
  - Soft-aspect and integration pathways that describe actionable directions for growth and experimentation.
- **Citations**
  - Every node carries `AnalysisNodeCitation.factIds`, which must correspond to placement or aspect fact ids in `AstroFacts`.
  - Tests enforce that citations are valid and that node ids are unique within each node kind.
- **Confidence**
  - `AnalysisConfidence` tracks a score and missingness reasons (e.g., `no_houses`, `no_aspects`, `no_natal_context`), so consumers can reason about data quality.

This node graph is the only source of truth for interpretable text; renderers are not allowed to introduce new interpretation logic outside this structure.

---

### Renderer boundary

Renderers live under `vnext/text/renderers/` and are **presentation-only**:

- **Inputs**
  - Receive a fully synthesized `TextAnalysisIntermediate`.
  - May optionally receive a tone spec (e.g., `daily.personality.v1.json`) for stylistic control.
- **Responsibilities**
  - Sort and select existing interpretation nodes using stable utilities (e.g., `stableSortByNodeWeight`).
  - Choose phrasing, section titles, and layout for a specific surface.
  - Respect tone validation rules (no fatalism, no fluff, no therapy language).
- **Explicitly forbidden**
  - Accessing ephemeris or chart-construction modules.
  - Computing or ranking new aspects.
  - Modifying node ordering outside stable sorting helpers.
  - Altering node weights.
  - Generating new interpretation nodes (themes, tensions, opportunities) or mutating existing ones.

Renderers may read tone configuration and shared formatting helpers, but all semantic meaning must already exist inside `TextAnalysisIntermediate`.

---

### Public interface usage

The public entry point for the text engine is:

```ts
import { generateTextSurface } from 'vnext/text';
```

The interface function signature is:

```ts
generateTextSurface({
  surface: 'daily' | 'structural',
  snapshot,
  relationalContext?,
  toneVersion?
});
```

- **Surface routing**
  - `'daily'` routes to the daily narrative renderer.
  - `'structural'` routes to the structural character-sheet renderer (internally mapped to the `characterSheet` analysis surface).
- **Contract**
  - Callers pass an `EphemerisSnapshot` (and optional relational chart context); the engine is responsible for constructing `ChartTextInput` and `TextAnalysisIntermediate` internally via `buildTextAnalysis`.
  - The interface enforces that the analysis surface used for synthesis matches the requested public surface and fails fast otherwise.
  - Output types are stable structured results (e.g., daily sections or structured character-sheet sections) suitable for downstream systems (apps, APIs, or other engines).

Consumers must call this interface instead of importing individual renderers or constructing `TextAnalysisIntermediate` directly, so that routing remains centralized and the engine boundary stays explicit.

---

### Engine freeze policy

- **Frozen components**
- `ChartTextInput`, `TextAnalysisIntermediate`, and all analysis node types.
- Synthesis logic inside `buildTextAnalysis` and its helpers.
- Renderer contracts and their status semantics.
- The public interface: `generateTextSurface({ surface, snapshot, relationalContext?, toneVersion? })`.
- **Allowed future work**
  - New features and products must integrate by calling the public interface and consuming its structured outputs.
  - New presentation surfaces should register through the interface and registry layer, not by changing core synthesis.
  - Non-breaking improvements to tone configuration and copy are allowed as long as contracts and node semantics stay intact.
- **Prohibited changes**
  - Modifying node-generation rules or weighting in ways that break determinism or ordering guarantees.
  - Adding new node kinds without a deliberate versioned contract.
  - Having downstream systems bypass `generateTextSurface` to call renderers or synthesis internals directly.

From this point forward, the vNext text engine should be treated as a shared service with a stable API. All new systems must call `generateTextSurface` with snapshots rather than modifying or bypassing the engine internals.

