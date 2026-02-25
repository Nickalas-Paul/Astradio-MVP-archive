# Phase 3 — Lyria Provider & Audio Integrity Validation

**Goal:** Prove that Google Lyria is properly configured, actually invoked when selected, never silently falls back, and produces expected quality output in production.

---

## 1. Provider identity (fail-closed)

- **Response fields:** Compose response includes non-sensitive provider identity when audio export is available:
  - `audio.provider_used` — e.g. `"lyria"` or `"local_wav"`
  - `audio.provider_mode` — e.g. `"requested=lyria, used=lyria"`
- **No secrets:** No tokens, project IDs, or raw provider responses in the response.
- **Fail-closed:** If Lyria is requested but not available (missing credentials or API failure), the request returns a clear error; no silent fallback to another provider.

---

## 2. Phase 3 harness

**Script:** `scripts/phase3-lyria-validate.js`

**Usage (LIVE protected preview):**

```bash
WEB_URL=https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app \
ENGINE_URL=https://astradio-mvp-archive.onrender.com \
VERCEL_BYPASS_TOKEN=<your-bypass-token> \
node scripts/phase3-lyria-validate.js
```

**What it does:**

- **A) Positive path:** POST compose (sandbox, Lyria selected via engine `RENDER_PROVIDER=lyria`). Asserts `audio.provider_used === "lyria"` and `audio.provider_mode` present and indicating lyria. Downloads export, computes WAV SHA256 and basic header metadata (sample rate, channels, duration_s).
- **B) Fail-closed check:** Ensures `vnext/render/index.ts` does not document or implement fallback when Lyria is requested (no `ALLOW_RENDER_FALLBACK`, no “fall back to local_wav when Lyria fails”). If present, script exits BLOCKED.

---

## 3. Quality spot-check runbook

Use the following to generate 10 sample tracks across diverse charts and record a quick listen checklist.

### 3.1 Exact commands to generate 10 sample tracks

Use the same WEB_URL, ENGINE_URL, and VERCEL_BYPASS_TOKEN as above. Compose 10 times with different `chartData` (and optional `controls`) to get diverse charts. Example with `curl` (replace `$WEB`, `$BYPASS`):

```bash
# Set once
export WEB="https://astradio-mvp-archive-git-beta-ui-vercel-nickalas-pauls-projects.vercel.app"
export BYPASS="<VERCEL_BYPASS_TOKEN>"

# 10 diverse chart payloads (date/time/location)
for i in 1 2 3 4 5 6 7 8 9 10; do
  case $i in
    1) date="1990-01-01"; time="12:00"; lat=40.7128; lon=-74.006 ;;
    2) date="2000-06-21"; time="18:00"; lat=51.5074; lon=-0.1278 ;;
    3) date="1985-12-25"; time="00:00"; lat=35.6762; lon=139.6503 ;;
    4) date="1995-07-04"; time="14:30"; lat=34.0522; lon=-118.2437 ;;
    5) date="1978-03-15"; time="09:15"; lat=-33.8688; lon=151.2093 ;;
    6) date="2010-11-11"; time="20:00"; lat=48.8566; lon=2.3522 ;;
    7) date="1969-08-15"; time="06:00"; lat=41.9028; lon=12.4964 ;;
    8) date="2022-02-22"; time="22:22"; lat=55.7558; lon=37.6173 ;;
    9) date="1988-09-01"; time="07:45"; lat=-22.9068; lon=-43.1729 ;;
    10) date="2005-04-05"; time="13:00"; lat=19.4326; lon=-99.1332 ;;
  esac
  curl -s -X POST "$WEB/api/compose" \
    -H "Content-Type: application/json" \
    -H "x-vercel-protection-bypass: $BYPASS" \
    -d "{\"mode\":\"sandbox\",\"chartData\":{\"date\":\"$date\",\"time\":\"$time\",\"lat\":$lat,\"lon\":$lon},\"controls\":{}}" \
    -o "phase3-compose-$i.json"
  export_id=$(node -e "console.log(require('./phase3-compose-$i.json').export_id || '')")
  if [ -n "$export_id" ]; then
    curl -s -H "x-vercel-protection-bypass: $BYPASS" "$WEB/api/exports/$export_id" -o "phase3-track-$i.wav"
    echo "Track $i: export_id=${export_id:0:20}... saved phase3-track-$i.wav"
  else
    echo "Track $i: no export_id"
  fi
done
```

Or use a small Node script that does the same (POST compose, then GET export for each of 10 chart configs) and saves `phase3-track-1.wav` … `phase3-track-10.wav`.

### 3.2 What to listen for

- **Clarity:** No muffling, obvious distortion, or dropouts.
- **Stereo field:** If stereo, balance and width should sound intentional, not collapsed or unstable.
- **Dynamic range:** No obvious over-compression or clipping; natural-sounding variation in level.
- **Instrument realism:** Timbres and articulations should sound coherent and musical (Lyria instrumental output).

### 3.3 Results checklist

Record one row per track; use the table below (fill date and initials).

| # | chart (date/time/loc) | export_id (first 16) | provider_used | Clarity | Stereo/Dynamics | Instruments | Notes |
|---|----------------------|----------------------|---------------|---------|------------------|--------------|-------|
| 1 | 1990-01-01 12:00 NYC | (from compose JSON) | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 2 | 2000-06-21 18:00 London | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 3 | 1985-12-25 00:00 Tokyo | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 4 | 1995-07-04 14:30 LA | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 5 | 1978-03-15 09:15 Sydney | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 6 | 2010-11-11 20:00 Paris | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 7 | 1969-08-15 06:00 Rome | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 8 | 2022-02-22 22:22 Moscow | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 9 | 1988-09-01 07:45 Rio | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |
| 10 | 2005-04-05 13:00 Mexico City | | lyria | ☐ OK ☐ Issue | ☐ OK ☐ Issue | ☐ OK ☐ Issue | |

Confirm each compose response has `audio.provider_used === "lyria"` (and optionally `audio.provider_mode`); if any track is not Lyria, do not mark Phase 3 quality spot-check as passed.

---

## Verification summary

- **Harness:** Run `phase3-lyria-validate.js` against LIVE (WEB_URL + ENGINE_URL + VERCEL_BYPASS_TOKEN). Expect **PASS** and provider_used lyria, WAV hash and header metadata printed.
- **Fail-closed:** No silent fallback when Lyria is requested; provider identity explicit in response.
- **Quality:** Use the commands and checklist above to generate and evaluate 10 diverse tracks and record results.

No UI changes or community work in this phase.
