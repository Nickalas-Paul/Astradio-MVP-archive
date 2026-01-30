# Beta Gate: 30-minute cache-safe soak (PASS)

## North star

Cache-safe 30-minute soak on localhost with **ML_REQUIRED=1**, **ml_used=true**, non-dev **model_sha**, and **0 errors** (0×429, 0×5xx, 0 assertion failures).

## Commands used (PowerShell)

**Backend (dev, soak-friendly rate limit):**
```powershell
$env:NODE_ENV="development"; $env:DISABLE_RATE_LIMIT="1"; node server/index.js
```

**Soak runner (30 min, 5–8s jitter):**
```powershell
$env:BASE_URL="http://localhost:3000"; $env:SOAK_DURATION_MINUTES="30"; $env:SOAK_SLEEP_MIN_MS="5000"; $env:SOAK_SLEEP_MAX_MS="8000"; node soak-only-repo/scripts/soak-runner.js
```

**Validation (after run):**
```powershell
$e = Get-Content soak-only-repo\artifacts\soak\soak-evidence-soak-1769741721281.jsonl
$total = $e.Count
$failed = ($e | ForEach-Object { (ConvertFrom-Json $_).success } | Where-Object { $_ -eq $false }).Count
$any_429 = ($e | ForEach-Object { (ConvertFrom-Json $_).http_code } | Where-Object { $_ -eq 429 }).Count
$any_5xx = ($e | ForEach-Object { $c=(ConvertFrom-Json $_).http_code; $c -ge 500 }).Count
$ml_false = ($e | ForEach-Object { (ConvertFrom-Json $_).ml_used } | Where-Object { $_ -eq $false }).Count
$bad_model_sha = ($e | ForEach-Object { $s=(ConvertFrom-Json $_).model_sha; $s -match 'dev|local|unknown' }).Count
$noop_backend = ($e | ForEach-Object { (ConvertFrom-Json $_).tf_backend } | Where-Object { $_ -eq 'noop' }).Count
$missing_audio = ($e | ForEach-Object { (ConvertFrom-Json $_).audio_present } | Where-Object { $_ -eq $false }).Count
$unique_datetimes = ($e | ForEach-Object { (ConvertFrom-Json $_).datetime_used } | Sort-Object -Unique).Count
Write-Output "total=$total"; Write-Output "failed=$failed"; Write-Output "any_429=$any_429"; Write-Output "any_5xx=$any_5xx"; Write-Output "ml_false=$ml_false"; Write-Output "bad_model_sha=$bad_model_sha"; Write-Output "noop_backend=$noop_backend"; Write-Output "missing_audio=$missing_audio"; Write-Output "unique_datetimes=$unique_datetimes"
```

## Pass metrics

| Metric | Value |
|--------|-------|
| Run ID | soak-1769741721281 |
| Duration | 30.0 min |
| Requests | 273 |
| Passed | 273 |
| Failed | 0 |
| Any 429 | NO (0) |
| Any 5xx | 0 |
| ml_used=false | 0 |
| bad model_sha (dev/local/unknown) | 0 |
| tf_backend=noop | 0 |
| missing_audio | 0 |
| Unique datetimes | 273 / 273 |
| Cache hit rate | 0.0% |

## Preserved artifacts

| Artifact | Path |
|----------|------|
| Evidence (run-specific) | `exports/soak/soak-evidence-soak-1769741721281.jsonl` |
| Evidence (latest symlink/copy) | `exports/soak/soak-evidence-latest.jsonl` |
| Validation summary | `exports/soak/soak-validation-soak-1769741721281.json` |
