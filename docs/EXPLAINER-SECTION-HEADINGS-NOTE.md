# Explainer Section Headings and Content Structure

**Scope:** New section model (Astrological Signatures / Personal Significance / Musical Identity and Flow), content requirements, UI mapping, dedupe and filler guardrails. No plan/audio/hashing/ML_REQUIRED changes.

---

## Section model

1. **Astrological Signatures** (2–4 sentences): Tone once (max 3 adjectives), movement, arc; element/planetary symbolism, no vague cosmic filler.
2. **Personal Significance** (1–2 paragraphs): Temperament, attention, pacing; one "because" link; disclaimer paragraph. No fate language.
3. **Musical Identity and Flow** (1 paragraph + 3–6 bullets): Tempo, density, register, motion, arc; bullets as listening anchors, emitted as `bullets: string[]` (no inline "•").

---

## Backend

- **vnext/explainer/text-realizer.ts**
  - `generateText` now returns `signatures`, `significance`, `musicalParagraph`, `musicalBullets` when gates pass; still returns `short`, `long`, `bullets` (short=signatures, long=significance+musicalParagraph, bullets=musicalBullets).
  - `generateSignatures`, `generateSignificance`, `generateMusicalSection` produce the three blobs; `dedupeAndClean` removes duplicate sentences and keeps Tone only in signatures.
  - `capToneAdjectives` (max 3); `stripBannedFiller` (cosmic forces, celestial dance, etc.); bullets without "•" in strings.

- **vnext/api/compose.ts**
  - When `text.signatures` and `text.significance` exist, builds `explanation.sections` with `sectionId` and titles: "Astrological Signatures", "Personal Significance", "Musical Identity and Flow".
  - Legacy: when not structured, builds Theme/Details/Bullets with sectionId theme/details/bullets.

---

## Frontend

- **apps/web/src/components/ExplanationPanel.tsx**
  - Renders section titles as provided; maps legacy Theme→Astrological Signatures, Details→Personal Significance, Bullets→Musical Identity and Flow.
  - Order enforced: Astrological Signatures, Personal Significance, Musical Identity and Flow (by SECTION_ORDER).
  - Tone dedupe: if previous section starts with "Tone:" and current section text starts with "Tone:", strip from current.

---

## Sample explanation.sections payload (structured)

```json
{
  "spec": "UnifiedSpecV1.1",
  "sections": [
    { "sectionId": "signatures", "title": "Astrological Signatures", "text": "Tone: energetic, curious. Motion stays mostly connected and stepwise. The shape builds and releases, with balanced temperament." },
    { "sectionId": "significance", "title": "Personal Significance", "text": "The chart points to a particular style of attention and pacing: steady, even pulse, with stable time. Because the elemental and planetary mix shapes how we hold tension and repetition, this shows up as recurring ideas return often.\n\nThis is a personality-style reading mapped into musical decisions, not a prediction." },
    { "sectionId": "musical", "title": "Musical Identity and Flow", "text": "Tempo sits in a moderate range, density is balanced, register leans mid register. Mercury's lightly shifting patterns, at a measured pace.", "bullets": ["Motion stays mostly connected and stepwise.", "The shape builds and releases.", "Steady, even pulse.", "Balanced texture.", "Recurring ideas return often."] }
  ]
}
```

---

## Confirmation

- No changes to plan generation, events, audio pipeline, hashing, or ML_REQUIRED/fail-closed behavior. Determinism preserved (payload.hash for variation).
