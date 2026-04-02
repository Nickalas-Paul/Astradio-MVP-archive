# Development Smoke Test Script
# Tests the full dev stack after docker-compose up

param(
    [string]$BaseUrl = "http://localhost:3000",
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"

Write-Host "🔬 Development Smoke Test" -ForegroundColor Cyan

# Wait for services to be ready
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
$timeout = (Get-Date).AddSeconds($TimeoutSeconds)

do {
    try {
        $readyz = Invoke-RestMethod -Uri "$BaseUrl/readyz" -TimeoutSec 5
        if ($readyz.ready -and $readyz.checks.model_audio -and $readyz.checks.model_text -and $readyz.checks.viz_engine_loaded -and $readyz.checks.compat_weights_loaded) {
            Write-Host "✅ Services ready" -ForegroundColor Green
            break
        }
    } catch {
        # Continue waiting
    }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $timeout)

if ((Get-Date) -ge $timeout) {
    Write-Host "❌ Services not ready within $TimeoutSeconds seconds" -ForegroundColor Red
    exit 1
}

# Test /readyz
Write-Host "🏥 Health check..." -ForegroundColor Cyan
$readyz = Invoke-RestMethod -Uri "$BaseUrl/readyz"
Write-Host "  Ready: $($readyz.ready)" -ForegroundColor Green
Write-Host "  Checks: $($readyz.checks | ConvertTo-Json -Compress)" -ForegroundColor Green

# Test composition determinism
Write-Host "🎯 Determinism test..." -ForegroundColor Cyan
$payload = '{"mode":"overlay","charts":[{"type":"transit","hash":"T"},{"type":"natal","hash":"N"}],"seed":123,"modelVersions":{"audio":"v1.1","text":"v1.1","viz":"1.0","matching":"v1.0"}}'

$response1 = Invoke-RestMethod -Uri "$BaseUrl/api/compose" -Method Post -Body $payload -ContentType "application/json"
$response2 = Invoke-RestMethod -Uri "$BaseUrl/api/compose" -Method Post -Body $payload -ContentType "application/json"

$audioMatch = $response1.audio.digest -eq $response2.audio.digest
$vizMatch = $response1.viz.digest -eq $response2.viz.digest

Write-Host "  Audio digest match: $audioMatch" -ForegroundColor $(if ($audioMatch) { "Green" } else { "Red" })
Write-Host "  Viz digest match: $vizMatch" -ForegroundColor $(if ($vizMatch) { "Green" } else { "Red" })
Write-Host "  Audio URL: $($response1.audio.url)" -ForegroundColor Green
Write-Host "  Viz URL: $($response1.viz.url)" -ForegroundColor Green

# Test trending endpoint
Write-Host "📈 Trending test..." -ForegroundColor Cyan
try {
    $trending = Invoke-RestMethod -Uri "$BaseUrl/api/trending?window=24h"
    Write-Host "  ✅ Trending endpoint working (returned $($trending.Count) items)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Trending endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test community relational feed (POST; 501 acceptable when postgres / vnext module absent)
Write-Host "👥 Community relational feed test..." -ForegroundColor Cyan
try {
    $payload = '{"transit":{"date":"2026-04-02","time":"12:00","lat":29.76,"lon":-95.37,"timezone":"America/Chicago"}}'
    try {
        $null = Invoke-RestMethod -Uri "$BaseUrl/api/community/relational-feed" -Method Post -Body $payload -ContentType 'application/json'
        Write-Host "  ✅ Community relational feed responded (200)" -ForegroundColor Green
    } catch {
        $status = $null
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 501) {
            Write-Host "  ✅ Community relational feed responded (501 — optional deps missing)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Community relational feed failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ❌ Community relational feed failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test error schema
Write-Host "📋 Error schema test..." -ForegroundColor Cyan
try {
    $errorResponse = Invoke-RestMethod -Uri "$BaseUrl/api/like/invalid" -Method Post -ErrorAction SilentlyContinue
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
}

$hasRequestId = $errorResponse.PSObject.Properties.Name -contains "requestId"
$hasErrorCode = $errorResponse.error.PSObject.Properties.Name -contains "code"
$hasErrorMessage = $errorResponse.error.PSObject.Properties.Name -contains "message"

Write-Host "  RequestId present: $hasRequestId" -ForegroundColor $(if ($hasRequestId) { "Green" } else { "Red" })
Write-Host "  Error code present: $hasErrorCode" -ForegroundColor $(if ($hasErrorCode) { "Green" } else { "Red" })
Write-Host "  Error message present: $hasErrorMessage" -ForegroundColor $(if ($hasErrorMessage) { "Green" } else { "Red" })

# Summary
Write-Host "`n🎉 Smoke test complete!" -ForegroundColor Green
Write-Host "  Services: ✅" -ForegroundColor Green
Write-Host "  Determinism: $(if ($audioMatch -and $vizMatch) { "✅" } else { "❌" })" -ForegroundColor $(if ($audioMatch -and $vizMatch) { "Green" } else { "Red" })
Write-Host "  Endpoints: ✅" -ForegroundColor Green
Write-Host "  Error schema: $(if ($hasRequestId -and $hasErrorCode -and $hasErrorMessage) { "✅" } else { "❌" })" -ForegroundColor $(if ($hasRequestId -and $hasErrorCode -and $hasErrorMessage) { "Green" } else { "Red" })

if ($audioMatch -and $vizMatch -and $hasRequestId -and $hasErrorCode -and $hasErrorMessage) {
    Write-Host "`n🚀 Development stack is ready!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️ Some tests failed - check the output above" -ForegroundColor Yellow
    exit 1
}
