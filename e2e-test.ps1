# e2e-test.ps1
# PowerShell-based E2E test for Phase-3 hardening

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$ArtifactDir = $null
)

$ErrorActionPreference = "Stop"

Write-Host "[TEST] Starting E2E test suite..." -ForegroundColor Cyan

$results = @{
    schema = $false
    determinism = $false
    failClosed = $false
    overlayThresholds = $false
    latency = @{ p50 = 0; p95 = 0; pass = $false }
    routeProof = $false
}

$composeEndpoint = "$BaseUrl/api/compose"

# 1. Schema validation
Write-Host "[SCHEMA] Testing schema compliance..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Method Post -Uri $composeEndpoint -ContentType "application/json" -Body "{}"
    $requiredKeys = @("controls", "astro", "gate_report", "audio", "text", "artifacts")
    $results.schema = $requiredKeys | ForEach-Object { $response.PSObject.Properties.Name -contains $_ } | All { $_ }
    
    if ($results.schema) {
        Write-Host "[PASS] Schema validation passed" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Schema validation failed - missing required keys" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Schema test error: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Route proof (410 deprecation)
Write-Host "[ROUTE] Testing route gating..." -ForegroundColor Yellow
try {
    $renderResponse = Invoke-WebRequest -Method Post -Uri "$BaseUrl/api/render" -ContentType "application/json" -Body "{}" -ErrorAction SilentlyContinue
    $results.routeProof = $renderResponse.StatusCode -eq 410
    
    if ($results.routeProof) {
        Write-Host "[PASS] Route gating working (410 Gone)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Route gating failed: HTTP $($renderResponse.StatusCode)" -ForegroundColor Red
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 410) {
        $results.routeProof = $true
        Write-Host "[PASS] Route gating working (410 Gone)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Route proof error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 3. Determinism test
Write-Host "[DETERMINISM] Testing determinism..." -ForegroundColor Yellow
try {
    $testPayload = @{
        mode = "sandbox"
        controls = @{
            hash = "e2e-test-determinism"
            arc_shape_id = "rise_peak_release"
            density_level = 0.5
            tempo_norm = 0.5
            step_bias = 0.62
            leap_cap = 3
            rhythm_template_id = 4
            syncopation_bias = 0.28
            motif_rate = 0.4
        }
    } | ConvertTo-Json -Depth 6
    
    $responses = @()
    $hashes = @()
    
    # Make 5 identical requests
    for ($i = 1; $i -le 5; $i++) {
        $response = Invoke-RestMethod -Method Post -Uri $composeEndpoint -ContentType "application/json" -Body $testPayload
        
        # Normalize response (exclude timestamp and latency)
        $normalized = $response | ConvertTo-Json -Depth 10
        $normalized = $normalized -replace '"timestamp":"[^"]*"', '"timestamp":""'
        $normalized = $normalized -replace '"latency_ms":[0-9.]+', '"latency_ms":0'
        
        $responses += $response
        $hashes += (Get-FileHash -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($normalized)))).Hash
    }
    
    $uniqueHashes = $hashes | Sort-Object -Unique
    $results.determinism = $uniqueHashes.Count -eq 1
    
    if ($results.determinism) {
        Write-Host "[PASS] Determinism test passed (5× identical)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Determinism test failed ($($uniqueHashes.Count) unique hashes)" -ForegroundColor Red
    }
    
    # Save artifacts if requested
    if ($ArtifactDir) {
        $determinismDir = Join-Path $ArtifactDir "determinism"
        New-Item -ItemType Directory -Force -Path $determinismDir | Out-Null
        
        $responses | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $determinismDir "responses.json")
        $hashes | Set-Content -Path (Join-Path $determinismDir "hashes.txt")
        
        $exclusions = @"
Determinism test exclusions:
- artifacts.timestamp: true
- audio.latency_ms: true
- audio.url query params: false

Test: 5 identical requests
Result: $(if ($results.determinism) { "PASS" } else { "FAIL" }) ($($uniqueHashes.Count) unique hashes)
Hashes: $($uniqueHashes -join ', ')
"@
        $exclusions | Set-Content -Path (Join-Path $determinismDir "exclusions.txt")
    }
} catch {
    Write-Host "[FAIL] Determinism test error: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Fail-closed test
Write-Host "[FAIL_CLOSED] Testing fail-closed behavior..." -ForegroundColor Yellow
try {
    $failPayload = @{
        mode = "sandbox"
        controls = @{
            hash = "e2e-test-fail-closed"
            arc_shape_id = "plateau_hold"
            density_level = 0.99
            tempo_norm = 0.99
            step_bias = 0.01
            leap_cap = 10
            rhythm_template_id = 1
            syncopation_bias = 0.99
            motif_rate = 0.01
        }
        testOverride = @{
            forceFail = "step_leap"
        }
    } | ConvertTo-Json -Depth 6
    
    $response = Invoke-RestMethod -Method Post -Uri $composeEndpoint -ContentType "application/json" -Body $failPayload
    $text = $response.text.short
    
    # Check if text contains only knob hints (no musical adjectives)
    $hasMusicalAdjectives = $text -match "\b(social|equilibrated|connected|expansive|cosmic|delicate|harmonious|introspective)\b"
    $hasKnobHints = $text -match "\b(step_bias|leap_cap|rhythm_template|syncopation)\b"
    
    $results.failClosed = -not $hasMusicalAdjectives -and $hasKnobHints
    
    if ($results.failClosed) {
        Write-Host "[PASS] Fail-closed test passed (knob hints only)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Fail-closed test failed: `"$text`"" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Fail-closed test error: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Overlay Δ thresholds
Write-Host "[OVERLAY] Testing overlay Δ thresholds..." -ForegroundColor Yellow
try {
    # Test above threshold (should show contrast)
    $abovePayload = @{
        mode = "overlay"
        overlayParams = @{
            natalLatitude = 34.05
            natalLongitude = -118.25
            natalDatetime = "1990-01-01T12:00:00Z"
            currentLatitude = 34.05
            currentLongitude = -118.25
            currentDatetime = "2024-08-08T12:00:00Z"
        }
    } | ConvertTo-Json -Depth 6
    
    $aboveResponse = Invoke-RestMethod -Method Post -Uri $composeEndpoint -ContentType "application/json" -Body $abovePayload
    $aboveText = $aboveResponse.text.short
    $aboveThreshold = $aboveText -match "Compared to your natal chart"
    
    # Test below threshold (should not show contrast)
    $belowPayload = @{
        mode = "overlay"
        overlayParams = @{
            natalLatitude = 34.05
            natalLongitude = -118.25
            natalDatetime = "1990-01-01T12:00:00Z"
            currentLatitude = 34.05
            currentLongitude = -118.25
            currentDatetime = "1990-01-01T12:05:00Z"
        }
    } | ConvertTo-Json -Depth 6
    
    $belowResponse = Invoke-RestMethod -Method Post -Uri $composeEndpoint -ContentType "application/json" -Body $belowPayload
    $belowText = $belowResponse.text.short
    $belowThreshold = -not ($belowText -match "Compared to your natal chart")
    
    $results.overlayThresholds = $aboveThreshold -and $belowThreshold
    
    if ($results.overlayThresholds) {
        Write-Host "[PASS] Overlay Δ thresholds working" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Overlay Δ thresholds failed (above: $aboveThreshold, below: $belowThreshold)" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Overlay Δ test error: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Latency test
Write-Host "[LATENCY] Testing latency..." -ForegroundColor Yellow
try {
    $latencies = @()
    $testPayload = '{"mode":"sandbox"}'
    
    for ($i = 1; $i -le 100; $i++) {
        $start = Get-Date
        $response = Invoke-RestMethod -Method Post -Uri $composeEndpoint -ContentType "application/json" -Body $testPayload
        $end = Get-Date
        $latencies += ($end - $start).TotalMilliseconds
    }
    
    if ($latencies.Count -gt 0) {
        $sortedLatencies = $latencies | Sort-Object
        $results.latency.p50 = $sortedLatencies[[Math]::Floor($sortedLatencies.Count * 0.5)]
        $results.latency.p95 = $sortedLatencies[[Math]::Floor($sortedLatencies.Count * 0.95)]
        $results.latency.pass = $results.latency.p95 -lt 150
        
        if ($results.latency.pass) {
            Write-Host "[PASS] Latency test passed (p95: $($results.latency.p95)ms)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Latency test failed (p95: $($results.latency.p95)ms > 150ms)" -ForegroundColor Red
        }
    } else {
        Write-Host "[FAIL] Latency test failed - no successful requests" -ForegroundColor Red
    }
} catch {
    Write-Host "[FAIL] Latency test error: $($_.Exception.Message)" -ForegroundColor Red
}

# Generate summary
$passed = @($results.schema, $results.determinism, $results.failClosed, $results.overlayThresholds, $results.latency.pass, $results.routeProof) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
$total = 6

Write-Host "`n[OVERLAY] E2E Test Summary: $passed/$total passed" -ForegroundColor Cyan
Write-Host "Schema: $(if ($results.schema) { '[PASS]' } else { '[FAIL]' })"
Write-Host "Determinism: $(if ($results.determinism) { '[PASS]' } else { '[FAIL]' })"
Write-Host "Fail-closed: $(if ($results.failClosed) { '[PASS]' } else { '[FAIL]' })"
Write-Host "Overlay Δ: $(if ($results.overlayThresholds) { '[PASS]' } else { '[FAIL]' })"
Write-Host "Latency: $(if ($results.latency.pass) { '[PASS]' } else { '[FAIL]' }) (p95: $($results.latency.p95)ms)"
Write-Host "Route proof: $(if ($results.routeProof) { '[PASS]' } else { '[FAIL]' })"

# Exit with appropriate code
$exitCode = if ($passed -eq $total) { 0 } else { 1 }
exit $exitCode
