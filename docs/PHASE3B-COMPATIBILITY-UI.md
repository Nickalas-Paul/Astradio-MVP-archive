# Phase 3B: Compatibility Funnel UI + Lens Toggle

## Overview

Intentional, contextual, narrative-first compatibility UI. No swiping, no percent grids, no globally ranked lists. Compatibility is clusters + "why" narrative, not a scoreboard.

## UX constraints (enforced)

| Constraint | How enforced |
|------------|--------------|
| No swiping | No swipe gestures; only buttons and links |
| No percent grids | API returns no percentages; UI never displays scores |
| No globally ranked list | Results are cluster cards (3–5 bands), not a single sorted list |
| Compatibility = clusters + narrative | Clusters show `label`, `band`, `why.bullets`; members show descriptors |
| Intentional input | Intent selector (required), scope selector (required), chips (max 3), keyword filter |
| No compose from funnel | Intent form and results call POST /api/compatibility/intent only |
| Lens uses comparison only | CompatibilityLensModal calls POST /api/comparisons with `generateComposition: false`; no audio playback |

## Routes

| Route | Description |
|-------|-------------|
| /compatibility | Entry; link to intent page |
| /compatibility/intent | Intent form: intent, scope, chips, keyword → "Generate clusters" |
| /compatibility/results | Cluster cards; member cards with "Compatibility Lens" button |
| /profile/[handle] | User identity, personality summary, "Run compatibility lens" button |

## Components

| Component | Purpose |
|-----------|---------|
| IntentForm | Intent + scope + chips (max 3) + keyword; submits to POST /api/compatibility/intent |
| ClusterCards | Renders clusters with label, band tag, why.bullets, member grid (8–12 max) |
| MemberCard | Display name, 2–3 descriptors, "Compatibility Lens" button (when chartId present) |
| CompatibilityLensModal | Runs POST /api/comparisons; shows compatibilityText (short, long, bullets) and explanation sections; no audio |

## Chips → facets mapping (frontend only)

Deterministic mapping in `apps/web/src/lib/compat-intent.ts`. Chips (max 3) map to `communication`, `emotional`, `growth`, `creative` weights. Weights are not exposed to the user.

| Chip | Facet deltas |
|------|--------------|
| deep_conversation | communication +0.2, emotional +0.2 |
| emotional_steadiness | emotional +0.25 |
| creative_spark | creative +0.3 |
| low_drama | emotional -0.15, growth +0.1 |
| high_growth | growth +0.3 |
| accountability | growth +0.2, communication +0.15 |
| playful | creative +0.2, emotional +0.1 |
| long_term | emotional +0.15, growth +0.2 |
| short_term_project | communication +0.2, creative +0.15 |

## Scope selector

- **My groups**: Candidate set from user's groups (UI-level filter; backend uses full directory for now)
- **This group**: When launched from group page (`?groupId=...`); filter results to group members
- **Global**: Full directory (current backend behavior)

Scope controls candidate filtering at the UI level until the backend supports scope parameters.

## Integration points

- **Group page**: "Compatibility in this group" link → /compatibility/intent?groupId=… ; members section with MemberCard (Lens when chartId present)
- **Profile page**: "Run compatibility lens" → opens CompatibilityLensModal (seeker = current user chart, target = profile user's chart)
- **Community**: Link to /compatibility from community page

## Verification

- Build: `npm run vnext:build` — PASS
- Compatibility funnel pages call only `/api/compatibility/intent` and `/api/comparisons`; never `/api/compose`
- Lens uses POST /api/comparisons; no music playback in UI
- UI never renders percentages; never shows a globally ranked list
