# Endpoint Matrix Validation Script
# Fails CI if API surface drifts from expected contract

param(
    [string]$BaseUrl = "http://localhost:3000",
    [switch]$SkipLiveProbes = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Building endpoint matrix..." -ForegroundColor Cyan

# Build route lists
Write-Host "  📋 Next.js routes..."
Get-ChildItem -Path "app/api" -Recurse -Name "route.ts" | 
    ForEach-Object { "/api/" + ($_ -replace "\\route\.ts$", "" -replace "\\", "/") } | 
    Sort-Object > .next_routes.txt

Write-Host "  📋 Express routes..."
Select-String -Path "server/routes/*.ts" -Pattern "router\.(get|post|put|delete)\('([^']+)'" | 
    ForEach-Object { "/api/compat" + ($_.Matches[0].Groups[2].Value) } | 
    Sort-Object > .express_routes.txt

Write-Host "  📋 Client calls..."
$clientCalls = @(
    "/api/chart",
    "/api/compat/matches", 
    "/api/community/relational-feed",
    "/api/compose",
    "/api/connect/accept/[requestId]",
    "/api/connect/[userId]",
    "/api/exports",
    "/api/like/[itemId]",
    "/api/report", 
    "/api/save/[trackId]",
    "/api/trending"
)
$clientCalls | Sort-Object > .client_calls.txt

# Check for dead calls
Write-Host "  🚫 Checking for dead calls..."
$allRoutes = (Get-Content .next_routes.txt) + (Get-Content .express_routes.txt) | Sort-Object | Get-Unique
$deadCalls = Compare-Object $allRoutes (Get-Content .client_calls.txt) | 
    Where-Object { $_.SideIndicator -eq "=>" } | 
    ForEach-Object { $_.InputObject }

if ($deadCalls.Count -gt 0) {
    Write-Host "  ❌ DEAD CALLS FOUND:" -ForegroundColor Red
    $deadCalls | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    exit 1
}

# Check for unexpected orphans
Write-Host "  👻 Checking for unexpected orphans..."
$orphans = Compare-Object $allRoutes (Get-Content .client_calls.txt) | 
    Where-Object { $_.SideIndicator -eq "<=" } | 
    ForEach-Object { $_.InputObject }

# Expected orphans (410s + keepers)
$expectedOrphans = @(
    "/api/compat/generate",
    "/api/compat/health", 
    "/api/compat/profile",
    "/api/compat/profile/:userId/:chartId",
    "/api/compat/rationale/:pairId",
    "/api/exports/[id]",
    "/api/overlay"
)

$unexpectedOrphans = $orphans | Where-Object { $_ -notin $expectedOrphans }
if ($unexpectedOrphans.Count -gt 0) {
    Write-Host "  ❌ UNEXPECTED ORPHANS FOUND:" -ForegroundColor Red
    $unexpectedOrphans | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
    exit 1
}

Write-Host "  ✅ Endpoint matrix clean" -ForegroundColor Green

# Live probes (if not skipped)
if (-not $SkipLiveProbes) {
    Write-Host "🔬 Running live probes..." -ForegroundColor Cyan
    
    # Check /readyz
    Write-Host "  🏥 Health check..."
    try {
        $readyz = Invoke-RestMethod -Uri "$BaseUrl/readyz" -Method Get
        $requiredChecks = @("compat_weights_loaded", "model_audio", "model_text", "viz_engine_loaded")
        $missingChecks = $requiredChecks | Where-Object { -not $readyz.checks.PSObject.Properties.Name -contains $_ }
        
        if ($missingChecks.Count -gt 0) {
            Write-Host "  ❌ Missing /readyz checks: $($missingChecks -join ', ')" -ForegroundColor Red
            exit 1
        }
        Write-Host "  ✅ /readyz checks present" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ /readyz failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
    # Check determinism
    Write-Host "  🎯 Determinism check..."
    $payload = '{"mode":"overlay","charts":[{"type":"transit","hash":"T"},{"type":"natal","hash":"N"}],"seed":123,"modelVersions":{"audio":"v1.1","text":"v1.1","viz":"1.0","matching":"v1.0"}}'
    
    try {
        $response1 = Invoke-RestMethod -Uri "$BaseUrl/api/compose" -Method Post -Body $payload -ContentType "application/json"
        $response2 = Invoke-RestMethod -Uri "$BaseUrl/api/compose" -Method Post -Body $payload -ContentType "application/json"
        
        if ($response1.audio.digest -ne $response2.audio.digest -or $response1.viz.digest -ne $response2.viz.digest) {
            Write-Host "  ❌ Determinism failed - digests differ" -ForegroundColor Red
            exit 1
        }
        Write-Host "  ✅ Determinism verified" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Determinism check failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🎉 All endpoint validations passed!" -ForegroundColor Green

# Cleanup
Remove-Item .next_routes.txt, .express_routes.txt, .client_calls.txt -ErrorAction SilentlyContinue
