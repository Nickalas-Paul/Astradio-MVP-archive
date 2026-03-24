# Beta core smoke: health, personality, compose, comparisons, sandbox report, compat health.
# Usage: $env:API_BASE_URL = "http://localhost:4000"; .\scripts\beta-smoke.ps1
#        $env:API_BASE_URL = "https://your-engine.onrender.com"; .\scripts\beta-smoke.ps1
# Optional: $env:EXPECT_VIZ = "1" to assert compose returns .viz (when server has VNEXT_VIZ=1).

$ErrorActionPreference = "Stop"
$Base = if ($env:API_BASE_URL) { $env:API_BASE_URL.TrimEnd('/') } else { "http://localhost:4000" }
$ExpectViz = [string]::Equals($env:EXPECT_VIZ, "1", "OrdinalIgnoreCase")
$Pass = 0
$Fail = 0

function Result($ok, $msg) {
    if ($ok) { $script:Pass = $script:Pass + 1; Write-Host "  PASS: $msg" }
    else     { $script:Fail = $script:Fail + 1; Write-Host "  FAIL: $msg" }
}

Write-Host "Beta smoke: $Base"
Write-Host "---"

# 1. Health
try {
    $r = Invoke-RestMethod -Uri "$Base/health" -Method Get
    if ($r.status -eq "ok") { Result $true "GET /health 200 status=ok" }
    else { Result $false "GET /health 200 but status=$($r.status)" }
} catch {
    Result $false "GET /health $($_.Exception.Response.StatusCode.value__)"
}

# 2. Create chart A
$idA = $null
try {
    $bodyA = '{"label":"Smoke A","date":"2025-01-15","time":"12:00","lat":40.7128,"lon":-74.006}'
    $r = Invoke-RestMethod -Uri "$Base/api/charts" -Method Post -Body $bodyA -ContentType "application/json"
    $idA = $r.id
    if ($idA) { Result $true "POST /api/charts (A) id=$idA" }
    else { Result $false "POST /api/charts (A) no .id" }
} catch {
    Result $false "POST /api/charts (A) $($_.Exception.Response.StatusCode.value__)"
}

# 3. Personality by chartId
if ($idA) {
    try {
        $r = Invoke-RestMethod -Uri "$Base/api/personality/$idA" -Method Get
        $p = $r.personality
        $t = $p.traits
        $traitCnt = if ($t) { ($t.PSObject.Properties | Measure-Object).Count } else { 0 }
        $hasPpV1 = $null -ne $p.temperament -or $null -ne $p.subsystems -or $p.version -eq "pp.v1"
        if ($traitCnt -gt 0) { Result $true "GET /api/personality/:chartId 200 traits present" }
        elseif ($hasPpV1) { Result $true "GET /api/personality/:chartId 200 pp.v1 personality present" }
        else { Result $false "GET /api/personality/:chartId 200 but no traits/temperament" }
    } catch {
        Result $false "GET /api/personality/:chartId $($_.Exception.Response.StatusCode.value__)"
    }
}

# 4. Compose (sandbox)
$composeBody = '{"mode":"sandbox","chartData":{"date":"1990-01-01","time":"12:00","lat":40.7128,"lon":-74.006},"controls":{}}'
try {
    $r = Invoke-RestMethod -Uri "$Base/api/compose" -Method Post -Body $composeBody -ContentType "application/json"
    $hasPlan = $null -ne $r.hashes -and [string]::IsNullOrEmpty($r.hashes.plan_sha256) -eq $false
    $secLen = if ($r.explanation.sections) { $r.explanation.sections.Count } else { 0 }
    $vizNull = $null -eq $r.viz
    if ($hasPlan) { Result $true "POST /api/compose 200 plan_sha256 present" }
    else { Result $false "POST /api/compose 200 no plan_sha256" }
    if ($secLen -gt 0) { Result $true "POST /api/compose explanation.sections length > 0" }
    else { Result $false "POST /api/compose explanation.sections empty" }
    if ($ExpectViz) {
        if (-not $vizNull) { Result $true "POST /api/compose viz present (EXPECT_VIZ=1)" }
        else { Result $false "POST /api/compose viz null (expected viz when EXPECT_VIZ=1)" }
    } else {
        if ($vizNull) { Result $true "POST /api/compose viz null (default)" }
        else { Result $true "POST /api/compose viz present (server has VNEXT_VIZ=1)" }
    }
} catch {
    Result $false "POST /api/compose $($_.Exception.Response.StatusCode.value__)"
}

# 5. Chart B and comparisons
$idB = $null
try {
    $bodyB = '{"label":"Smoke B","date":"1990-06-01","time":"14:30","lat":34.05,"lon":-118.25}'
    $r = Invoke-RestMethod -Uri "$Base/api/charts" -Method Post -Body $bodyB -ContentType "application/json"
    $idB = $r.id
    if ($idB) { Result $true "POST /api/charts (B) id=$idB" }
    else { Result $false "POST /api/charts (B) no .id" }
} catch {
    Result $false "POST /api/charts (B) $($_.Exception.Response.StatusCode.value__)"
}
if ($idA -and $idB) {
    try {
        $cmpBody = "{`"chartAId`":`"$idA`",`"chartBId`":`"$idB`",`"relationshipMode`":`"friends`"}"
        $r = Invoke-RestMethod -Uri "$Base/api/comparisons" -Method Post -Body $cmpBody -ContentType "application/json"
        if ($r.planHash) { Result $true "POST /api/comparisons 200 planHash present" }
        else { Result $false "POST /api/comparisons 200 no planHash" }
    } catch {
        Result $false "POST /api/comparisons $($_.Exception.Response.StatusCode.value__)"
    }
}

# 6. Sandbox report
$sandboxBody = '{"birth":{"date":"1990-01-15","time":"12:00","lat":40.7128,"lon":-74.006},"overrides":{"planets":{"sun":{"lonDeg":123.4},"moon":{"lonDeg":210}}}}'
try {
    $r = Invoke-RestMethod -Uri "$Base/api/sandbox/report" -Method Post -Body $sandboxBody -ContentType "application/json"
    $featLen = if ($r.features) { $r.features.Count } else { 0 }
    if ($featLen -eq 64) { Result $true "POST /api/sandbox/report 200 features length 64" }
    else { Result $false "POST /api/sandbox/report 200 features length=$featLen" }
} catch {
    Result $false "POST /api/sandbox/report $($_.Exception.Response.StatusCode.value__)"
}

# 7. Compat health
try {
    $r = Invoke-RestMethod -Uri "$Base/api/compat/health" -Method Get
    $syn = $r.synastry
    if ($syn) { Result $true "GET /api/compat/health 200 synastry=$syn" }
    else { Result $true "GET /api/compat/health 200" }
} catch {
    Result $false "GET /api/compat/health $($_.Exception.Response.StatusCode.value__)"
}

Write-Host "---"
Write-Host "Summary: $Pass passed, $Fail failed"
if ($Fail -gt 0) { exit 1 }
exit 0
