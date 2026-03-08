# Phase 8G — Natal soundtrack “No audio” blocker fix

**Date:** 2026-03-08  
**Scope:** Community/Profile: Saved Tracks must not show a soundtrack row with “No audio” when the composition actually has no artifact (compose 200 but empty audio). No fake success states.

---

## Root cause

1. **Compose returns 200 with empty audio**  
   When the engine has `ENABLE_WAV_EXPORT` not set to `'1'`, it still returns HTTP 200 but sets `audio.base64` to `''` (stub). The frontend treated any 200 as success and added a job to history with `status.url === ''`.

2. **Frontend added a “ready” job even when url was empty**  
   `triggerNatalComposition` always called `addJobToHistory(job)` after compose 200, so a row appeared in Saved Tracks with no playable URL, showing “No audio”.

3. **Blob URLs do not survive refresh**  
   When audio was present, the job stored a `blob:` URL. After reload, that URL is invalid, so rehydrated rows could also show as unplayable. The UI now treats “ready but no valid url” as “Audio unavailable” (honest failure state).

---

## Fix (summary)

- **ProfilePanel (`triggerNatalComposition`):** Only add a job to history when we have a non-empty playable URL (i.e. `audio.base64` is a non-empty string and we successfully create a blob URL). If compose returns 200 but there is no artifact, show an error toast and do **not** add a row.
- **CommunityClient (Saved Tracks):** For jobs with `stage === 'ready'` but no valid `url`, show “Audio unavailable” (with a title explaining artifact missing/expired) instead of “No audio”, so rehydrated or legacy entries are clearly failure states.
- **Tests:** `tests/natal-soundtrack-persistence.test.ts` encodes the contract that only non-empty `audio.base64` yields a playable job.

---

## Deployment requirement

For natal soundtracks to be generated and appear as playable in Saved Tracks, the **engine** (backend) must:

- Have **`ENABLE_WAV_EXPORT=1`** set so that compose returns actual WAV in `audio.base64`.
- Have the WAV render provider (e.g. Lyria or local_wav) configured as required.

If the engine does not have WAV export enabled, profile creation will still succeed and the user will see a toast: “Soundtrack could not be generated: Audio export is disabled on this server.” and no misleading “ready” row will be added.

---

## Files changed

- `apps/web/src/components/community/ProfilePanel.tsx` — only add ready job when `audioUrl` is non-empty; toast on no-audio; import `useUIStore`.
- `apps/web/app/community/CommunityClient.tsx` — Saved Tracks: show “Audio unavailable” when `stage === 'ready'` but no valid `url`.
- `tests/natal-soundtrack-persistence.test.ts` — new contract tests for playable-audio detection.

---

## Browser verification (after fix)

1. **When engine has WAV export enabled**
   - Create a new profile (name, handle, birth date/time, location).
   - After success, wait for the background compose to finish.
   - Open the **Saved Tracks** tab: a row for “My [Name] Soundtrack” (or “My Soundtrack”) must appear **with a playable audio control**.
   - Under the profile chart, the natal baseline player must show and play.

2. **When engine does not have WAV export enabled**
   - Create a new profile as above.
   - You should see an error toast: “Soundtrack could not be generated: Audio export is disabled on this server.” (or similar).
   - **No** “ready” soundtrack row should appear in Saved Tracks (no row with “No audio” or “Audio unavailable” for that just-created profile).

3. **Rehydrated / legacy rows**
   - If a previously saved job has `stage === 'ready'` but the URL is dead (e.g. after refresh), the row should show “Audio unavailable” with the explanatory title, not a fake playable control.

---

## Phase 8G regression follow-up (no silent failures)

**Issue:** After the honesty fix, Saved Tracks showed 0 compositions and no visible failure message when the backend did not return audio.

**Root cause:** Multiple silent failure paths and swallowed errors: early returns (chart fetch fail, invalid snapshot, compose request fail) did not show any toast; `triggerNatalComposition(...).catch(() => {})` swallowed thrown errors; no inline status on the Profile tab.

**Code dependency on ENABLE_WAV_EXPORT:** `vnext/api/compose.ts` line 273: `const wavExportEnabled = process.env.ENABLE_WAV_EXPORT === '1';`. When false, response is 200 with stub `audio.base64 === ''` and `export_error: 'export_disabled'`.

**Follow-up fix:** All failure paths in `triggerNatalComposition` now show a toast and call `onStatus('failed', message)`. Profile shows pending ("Generating your soundtrack…") and failed (inline alert with reason). Replaced `.catch(() => {})` with visible error toast and state. Saved Tracks when empty but user has profile shows a note to check the Profile tab.
