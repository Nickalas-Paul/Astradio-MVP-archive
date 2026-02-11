# Explainer AstroProfile sample output

After the AstroProfile-driven upgrade, **Astrological Signatures** can look like this (representative sample; actual output depends on chart data from `GET /api/chart-snapshot`).

## Example: Astrological Signatures section

```
The chart's sign-based element emphasis leans fire (initiative and warmth) with cardinal modality (forward momentum and initiation). Sun in Aries in the 2nd house emphasizes identity and vitality expressed through resources and values. Moon in Leo in the 5th house emphasizes regulation and emotional rhythm expressed through creativity and expression. Mercury in Gemini in the 3rd house emphasizes cognition and exchange expressed through communication and local exchange. Venus in Taurus in the 1st house emphasizes relating and harmony, accenting the ASC, expressed through self and approach to life. Mars in Cancer in the 4th house emphasizes initiative and drive expressed through home, roots, and private life. ASC in Taurus frames the approach to life through substance and form and self-presentation. A tight Sun trine Moon (orb 1.2°) supports coherence between the planets involved. A moderate Mars square Saturn (orb 4.5°) brings tension and activation between the planets involved.
```

## PR checklist sample lines

- **Moon placement:** `Moon in Leo in the 5th house emphasizes regulation and emotional rhythm expressed through creativity and expression.`
- **Mercury placement:** `Mercury in Gemini in the 3rd house emphasizes cognition and exchange expressed through communication and local exchange.`
- **ASC sign:** `ASC in Taurus frames the approach to life through substance and form and self-presentation.`
- **Aspect with orb:** `A tight Sun trine Moon (orb 1.2°) supports coherence between the planets involved.`

To get a real sample: run the app, trigger compose with a chart (e.g. sky or sandbox with chartData), then copy `response.explanation.sections[0].text` (Signatures section).
