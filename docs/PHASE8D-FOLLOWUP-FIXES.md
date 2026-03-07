# Phase 8C/8D Community Surface Follow-up Fixes

## 1. Root cause: Matches surface unavailable

**Root cause:** The Matches tab was gated by the **ENABLE_COMPAT** feature flag. In the consolidated flag system (`apps/web/config/flags.ts`), `ENABLE_COMPAT` defaulted to `false`. It was only set to `true` when the URL contained `?compat=1` or `?compat=true` (development override). So in normal closed-beta use, Matches showed the “feature disabled” card with dev-only copy (“add ?compat=1 to the URL in development”), which is not acceptable for user-facing closed beta.

**Fix applied:**
- **Default flag:** Set `ENABLE_COMPAT: true` in `DEFAULT_FLAGS` in `apps/web/config/flags.ts` so Matches is active by default for closed beta. The existing `/api/compat/matches` proxy and `useCompat` hook already support real behavior; the only gate was the flag.
- **Copy when compat is off:** If someone explicitly disables compat (e.g. via URL override), the Matches tab now shows closed-beta-appropriate copy only: “Compatibility matching is not available in this session. Create a profile with your natal chart and return later to see when matches are enabled.” No mention of query params or development.

**Behavior before:** Matches tab showed “Compatibility matches are available when the feature is enabled (e.g. add ?compat=1 to the URL in development).”  
**Behavior after:** Matches tab shows real compatibility behavior (no-chart instructional, chart-but-no-matches empty state, or match list). If compat is turned off, the message is the honest closed-beta line above with no dev flags.

---

## 2. Files changed

| File | Change |
|------|--------|
| `apps/web/config/flags.ts` | `ENABLE_COMPAT: true` in `DEFAULT_FLAGS`; comment noting closed beta. |
| `apps/web/src/components/CompatibilitySection.tsx` | When `!isFeatureEnabled('ENABLE_COMPAT')`, render the new closed-beta message only (no `?compat=1`). |
| `apps/web/src/components/community/ProfilePanel.tsx` | Create profile button: disabled state uses muted styling (`bg-bgElev`, `text-subtext`, `border`, `cursor-not-allowed`); enabled state uses `bg-emerald`, `shadow-md`, hover/focus ring for visibility and accessibility. `aria-busy={creating}`. |
| `apps/web/src/components/community/CompareChartsPanel.tsx` | Callout for group/composite (3+ charts): “Group or composite comparison (3+ charts): … create a Group in the Groups tab …” plus optional “Go to Groups →” button. New prop `onSwitchToGroups?: () => void`. |
| `apps/web/app/community/CommunityClient.tsx` | Pass `onSwitchToGroups={() => setActiveTab('groups')}` to `CompareChartsPanel`. |
| `docs/PHASE8D-FOLLOWUP-FIXES.md` | This report. |

---

## 3. Exact UI behavior changes

- **Create Profile button**
  - **Disabled:** Muted background (`bg-bgElev`), `text-subtext`, border, `cursor-not-allowed` — clearly not clickable.
  - **Enabled:** Emerald background, white text, shadow, hover brightness, focus ring — clearly visible and accessible in light/dark.

- **Matches tab**
  - **Default (ENABLE_COMPAT on):** Real behavior: no-chart → instructional + “Go to Profile to create one”; chart, no matches → compatibility empty state; chart + matches → list. No dev-param copy.
  - **If compat off:** Single message: “Compatibility matching is not available in this session…” (no `?compat=1`).

- **Compare Charts**
  - New callout at top: “Group or composite comparison (3+ charts): … create a Group in the Groups tab …” with “Go to Groups →” that switches to the Groups tab. Two-chart flow unchanged.

- **Geolocation**
  - No change: Profile creation and Compare Charts continue to use LocationFinder only; coordinates remain internal. Confirmed no raw lat/lon inputs in Community surfaces.

---

## 4. Commit hashes

- **Phase 8D follow-up:** `52a25a0` — fix(community): Phase 8D - Create Profile button visibility, Matches closed-beta copy, Compare group/composite callout

---

## 5. Verification notes

- **Create Profile button:** In Community → Profile (logged out), confirm disabled state is visibly muted and enabled state is high-contrast emerald with focus ring; works in dark mode.
- **Matches surface:** With default flags, open Matches with no profile → instructional; create profile with natal data, open Matches → either match list or “No eligible matches” empty state. No `?compat=1` text. With `?compat=0` (if supported) or other override that turns compat off → only the closed-beta “not available in this session” message.
- **Compare Charts aggregate option:** In Compare tab, confirm the “Group or composite comparison (3+ charts)” callout and “Go to Groups →” appear; click switches to Groups tab. Two-chart comparison still works as before.
- **LocationFinder:** Profile creation and Compare Charts still use only location search; no visible lat/lon fields.
