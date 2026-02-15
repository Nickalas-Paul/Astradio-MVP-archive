# Render auto-deploy: repo sanity check and possible causes

No infra or code changes; diagnosis only.

## Repo-side sanity check (run on branch beta-ui-vercel)

- **Branch:** `git branch --show-current` → `beta-ui-vercel`
- **Local tip:** `git log -1 --oneline` → `dfa465a fix(audio): cast InstrumentSamples for optional bassNotes/harmonyNotes/melodyNotes (Vercel)`
- **Remotes:** `origin` → `https://github.com/Nickalas-Paul/Astradio-MVP-archive.git`
- **Remote branch:** `git ls-remote --heads origin beta-ui-vercel` → `dfa465aee42d3bbff0263d9cbc8e89f7263ea560 refs/heads/beta-ui-vercel`
- **Remote tip:** `git log origin/beta-ui-vercel -1 --oneline` → `dfa465a fix(audio): ...`

So commit `dfa465a` is on `origin/beta-ui-vercel`; local and remote are in sync for that branch.

## What could cause “manual deploy only” even when auto-deploy is on

Without access to Render dashboard or logs, these are evidence-based possibilities (not guesses):

1. **Overlapping deploy / cancel** – Render may cancel or skip a new deploy if a previous one is still running (e.g. “deploy on push” but only one at a time). The UI might then show the last *manual* deploy as the last action.
2. **GitHub connection or reauthorization** – If the GitHub app was disconnected or reauthorized, or OAuth was refreshed, Render might have stopped receiving webhooks until the link was fixed. Auto-deploy depends on that connection.
3. **Branch filter mismatch** – If Render is set to auto-deploy only for a branch other than `beta-ui-vercel` (e.g. `main`), pushes to `beta-ui-vercel` won’t trigger an auto-deploy.
4. **Wrong repo or branch** – If the Render service is pointed at a different repo or at a different branch than `beta-ui-vercel`, pushes to this repo’s `beta-ui-vercel` won’t trigger that service.
5. **Webhook delivery failure** – GitHub might fail to deliver the push webhook to Render (e.g. timeout, Render URL changed, or webhook disabled). Check GitHub repo → Settings → Webhooks for delivery errors.

To confirm what’s happening: in the Render dashboard, check the service’s “Events” or “Deploys” and the connected repo/branch; and in GitHub, check Webhooks for failed deliveries to Render.
