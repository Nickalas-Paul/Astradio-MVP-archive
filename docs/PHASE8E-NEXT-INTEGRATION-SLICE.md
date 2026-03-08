# Phase 8E — Next integration slice (note only)

After the natal baseline generation from profile creation, the next logical integration slices are:

1. **Natal chart + current moment chart (overlay / “now” comparison)**  
   The engine already supports `mode: 'overlay'` with natal + current sky params. The next slice would: use the user’s stored profile chart as natal, resolve “now” (or a chosen moment) for the current chart, call compose in overlay mode, and optionally store that as a separate “daily” or “moment” composition in the same history and surface it in Saved Tracks or a dedicated “Today” / “Current moment” area.

2. **Daily dynamic composition / report**  
   A scheduled or on-demand flow that: (a) takes the profile natal chart, (b) gets current transits (or a chosen date), (c) runs overlay compose (or a dedicated “daily report” path if one exists), (d) saves the result and optionally notifies the user or surfaces it on the Community/Profile surface (e.g. “Your sound today” or “Daily report”).

These are **not** implemented in this pass. They depend on: overlay compose being wired from the Community UI, optional server-side scheduling/cron if “daily” is automated, and a clear place in the UI (Profile or Saved Tracks) for “current moment” vs “natal baseline” vs “daily” entries. Implementation should reuse the same composition store and Saved Tracks (or an explicit “Reports” / “Daily” section) to avoid parallel systems.
