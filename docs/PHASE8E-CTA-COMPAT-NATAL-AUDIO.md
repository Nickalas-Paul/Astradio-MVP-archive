# Phase 8E — CTA Visibility, Compat Messaging, Natal Audio Integration

## 1. Root cause: Compat message when user has profile/chart

**Problem:** The Matches tab showed “Compatibility matching is not available in this session” even when the user had a real profile and natal chart. That contradicted the fact they were already set up.

**Cause:** The UI checked `!isFeatureEnabled('ENABLE_COMPAT')` first and rendered the “not available in this session” message for everyone when the flag was off. It did not consider whether the user had a chart. So users with a valid chart still saw a generic “create a profile and return later” style message.

**Fix:** Reordered logic and made the message depend on chart presence:

1. If there is **no** `chartId`: show the existing instructional state (“Create a profile with your natal chart first…”) and “Go to Profile to create one”.
2. If there **is** a `chartId` but **compat is off**: show a separate message that does not imply they need to create a profile:  
   *“You’re set up with a natal chart. Compatibility matching is not available in this preview yet — it will be enabled in a future update.”*
3. If there is a chart and compat is on: show the real Matches UI (list or empty state).

So the message now matches the actual state and no longer suggests creating a profile when the user already has one.

---

## 2. Files changed

| File | Change |
|------|--------|
| `apps/web/tailwind.config.js` | Added `panel`, `bgElev`, `subtext`, `emerald` and ensured theme supports input/button contrast. |
| `apps/web/app/globals.css` | Added `.input` with high-contrast text (`text-text`), placeholder, focus ring, and dark-mode friendly background/border. |
| `apps/web/src/components/community/ProfilePanel.tsx` | Create Profile button: single `canSubmit`/`disabled`; disabled = muted (bg-bgElev, text-subtext); enabled = emerald, white text, shadow, ring. On create success, read `primaryChart.id` from response and call `triggerNatalComposition(newChartId)`. Added `triggerNatalComposition(chartId)` (fetch profile/chart → compose sandbox → add job to store). Imports: `useCompositionStore`, `getApiBaseUrl`, `CompositionJob`. |
| `apps/web/src/components/CompatibilitySection.tsx` | Removed the early “not available in this session” block. After “no chartId” block, added: when `chartId` exists but `!ENABLE_COMPAT`, render “You’re set up with a natal chart. Compatibility matching is not available in this preview yet…”. |
| `apps/web/app/community/CommunityClient.tsx` | Added `SavedCompositionsBlock`: reads `jobHistory` from `useCompositionStore`, shows ready jobs as “Saved Tracks” with label (e.g. “Natal baseline”) and `<audio controls src={url} />`. Rendered above `LibraryPanel` when tab is Saved. |
| `docs/PHASE8E-CTA-COMPAT-NATAL-AUDIO.md` | This report. |
| `docs/PHASE8E-NEXT-INTEGRATION-SLICE.md` | Next slice note (natal + current moment, daily dynamic). |

---

## 3. UI changes (button and input contrast)

- **Create Profile button**
  - **Disabled:** `bg-bgElev`, `text-subtext`, `border`, `cursor-not-allowed`, `min-w-[140px]` so it stays visible and clearly inactive.
  - **Enabled:** `bg-emerald`, `text-white`, `shadow-lg shadow-emerald/20`, `ring-2 ring-emerald/40`, same min-width; hover and focus ring for visibility and accessibility. No dependence on “after location” state; visibility is consistent whenever the form is valid.
- **Profile creation inputs**
  - Global `.input`: `bg-bgElev`, `text-text`, `placeholder:text-subtext/90`, focus ring `ring-emerald/50`. All profile fields (display name, handle, chart label, date, time, location) use this class so typed text and placeholders are readable in light and dark.

---

## 4. Natal audio generation after profile creation

- **Trigger:** On successful `POST /api/profile`, the response may include `primaryChart.id`. If present, the client calls `triggerNatalComposition(newChartId)` (fire-and-forget).
- **Steps:**
  1. `GET /api/profile/chart?chartId=<id>` to load the profile chart and its **snapshot** (EphemerisSnapshot).
  2. `POST /api/compose` with `mode: 'sandbox'`, `seed: 'natal_<chartId>'`, `overriddenSnapshot: snapshot`.
  3. On 200, if the response has `audio.base64`, decode to a Blob, create an object URL, and build a **CompositionJob** with `request: { chartA: chartId, genre: 'house', durationSec: 30 }`, `status: { stage: 'ready', url, layers }`.
  4. `addJobToHistory(job)` so the job appears in the composition store.
- **Reuse:** Uses the existing sandbox compose path (overriddenSnapshot) and the existing composition store; no new audio or storage architecture.

---

## 5. Where the natal track is stored and how it appears in Saved Tracks

- **Storage:** The natal job is stored only in the **client-side composition store** (Zustand, persisted as `astradio-composition` with the last 10 jobs). There is no separate server-side “library” for this baseline; it uses the same history as other compositions.
- **Saved Tracks:** The Community “Saved Tracks” tab now includes a **Saved Tracks** block (when there is at least one ready job in `jobHistory`) above the existing Library panel. Each ready job is listed with a label (e.g. “Natal baseline” for jobs whose id starts with `natal_`) and an `<audio controls src={url} />` so the user can play it. The natal baseline generated after profile creation appears there automatically once the compose call succeeds and the job is added to history.

---

## 6. Commit hashes

- **Phase 8E:** `73cbea6` — fix(community): Phase 8E - CTA visibility, input contrast, compat message truthfulness, natal audio after profile creation

---

## 7. Verification notes

- **Create Profile button:** With form invalid (e.g. no location), button is clearly disabled (muted). After filling name, date, time, and location, button is clearly enabled (emerald, white text, ring). During “Creating…”, same enabled styling. No “disappearing” after location selection.
- **Input text:** Typed text and placeholders in profile creation (display name, handle, chart label, date, time, location) are readable; dark theme remains consistent via `.input` and theme colors.
- **Matches message:** With a profile and chart but compat off: message is “You’re set up with a natal chart. Compatibility matching is not available in this preview yet…”. With no chart: instructional + “Go to Profile to create one”. With chart and compat on: real matches or empty state.
- **Natal track after profile creation:** Create a profile with natal data; after success, wait for the background compose. Open the Saved Tracks tab; a “Saved Tracks” section appears with “Natal baseline” and a playable audio control. Playback uses the object URL from the compose response.
