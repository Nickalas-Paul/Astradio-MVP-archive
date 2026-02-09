# Text Explainer Rendering and Language Fix

**Scope:** Frontend structured rendering of `explanation.sections`; Tone deduplication; bullet list rendering; minimal backend text hygiene. No changes to audio pipeline, plan generation, hashing, or ML_REQUIRED behavior.

---

## Changes

### Backend (vnext)

- **compose.ts**
  - Explanation sections now include a `bullets` array (strings without "•") for the Bullets section; legacy `text` remains for clients that only read `section.text`.
  - **Tone deduplication:** If Theme and Details both start with "Tone:", the leading "Tone: …" sentence is stripped from Details so it appears only once (in Theme).

- **text-realizer.ts**
  - Long form (Details): sentences joined with ". "; disclaimer on its own paragraph (separated by `\n\n`).
  - No change to bullet generation (bullets still include "•" internally; compose strips for API `bullets` array).

- **atoms-generator.ts**
  - Planet tint separator changed from em dash (" — ") to comma (", ") in movement description.

### Frontend (apps/web)

- **ExplanationPanel.tsx**
  - Accepts optional `sections` (Theme, Details, Bullets). When present, renders:
    - **Theme:** heading + paragraphs (split on blank lines).
    - **Details:** heading + paragraphs; **Tone deduplication:** if Theme and Details both start with "Tone:", the Tone line is shown only under Theme (Details is trimmed).
    - **Bullets:** heading + proper list: if `section.bullets` exists, `<ul><li>`; else if only `section.text` contains legacy "•", split on "•" and render as `<li>`. No inline bullet glyphs in paragraph text.
  - When `sections` is missing, falls back to legacy `text` (single paragraph). Loading and empty states unchanged.

- **page.tsx**
  - Stores `explanationSections` when payload has `explanation.sections`; passes `sections={explanationSections}` to ExplanationPanel. Legacy `explanation.text` still sets `analysisText` and no sections (backward compatible).

---

## Confirmation: No Audio Pipeline Changes

- No edits to plan-generator, planner/narrative, audition-gate, wav-renderer, midi, encodeFeatures, or compose’s plan/WAV path.
- Hashing (payload.hash, explanation hash, plan hash) unchanged.
- Determinism and ML_REQUIRED / fail-closed behavior unchanged.

---

## Before/After

- **Before:** Single flattened paragraph; "Tone:" repeated in Theme and Details; bullet glyphs "•" inline in text.
- **After:** Structured Theme / Details / Bullets with headings; Tone line only in Theme; bullets as a real list. Details uses sentence and paragraph breaks for readability.

Capture before/after screenshots of the Astrological Analysis card to verify.
