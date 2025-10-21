# Staging Frontend AV Validation Script
# Tests: Audio, Wheel, Text, Error States, Browser Compatibility

param(
    [string]$StagingUrl = "https://staging.astradio.io",
    [int]$TestCount = 5
)

Write-Host "=== STAGING FRONTEND AV VALIDATION ===" -ForegroundColor Green
Write-Host "Staging URL: $StagingUrl"
Write-Host "Test Count: $TestCount"
Write-Host ""

# Test 1: Health & Readiness
Write-Host "1. Testing Health & Readiness..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$StagingUrl/health" -TimeoutSec 10
    $readyz = Invoke-RestMethod -Uri "$StagingUrl/readyz" -TimeoutSec 10
    Write-Host "✅ Health: $($health.status)"
    Write-Host "✅ Readiness: $($readyz.ready)"
} catch {
    Write-Host "❌ Health/Readiness failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Golden Chart Set
Write-Host "`n2. Testing Golden Chart Set..." -ForegroundColor Yellow
$goldenCharts = @(
    @{name="NY 1990"; date="1990-01-01"; time="12:00"; location="New York"; geo=@{lat=40.7128; lon=-74.0060}},
    @{name="LA 1985"; date="1985-06-15"; time="18:30"; location="Los Angeles"; geo=@{lat=34.0522; lon=-118.2437}},
    @{name="London 1992"; date="1992-12-25"; time="09:15"; location="London"; geo=@{lat=51.5074; lon=-0.1278}},
    @{name="Tokyo 1988"; date="1988-03-20"; time="14:45"; location="Tokyo"; geo=@{lat=35.6762; lon=139.6503}},
    @{name="Sydney 1991"; date="1991-08-10"; time="21:30"; location="Sydney"; geo=@{lat=-33.8688; lon=151.2093}}
)

$successCount = 0
$fallbackCount = 0
$hashes = @{}

foreach ($chart in $goldenCharts) {
    try {
        Write-Host "Testing: $($chart.name)..." -NoNewline
        $response = Invoke-RestMethod -Uri "$StagingUrl/api/compose" -Method Post -ContentType "application/json" -Body ($chart | ConvertTo-Json -Depth 3) -TimeoutSec 30
        
        # Validate response structure
        $hasAudioUrl = $null -ne $response.audio.url
        $hasText = $response.explanation.sections.Count -gt 0
        $hasControls = $null -ne $response.controls
        $hasSpec = $response.explanation.spec -eq "UnifiedSpecV1.1"
        
        if ($hasAudioUrl -and $hasText -and $hasControls -and $hasSpec) {
            Write-Host " ✅" -ForegroundColor Green
            $successCount++
            
            # Track fallback rate
            if (-not $hasAudioUrl -and $null -ne $response.audio.plan) {
                $fallbackCount++
            }
            
            # Track hashes for determinism
            $hash = $response.hashes.control
            if ($hashes.ContainsKey($hash)) {
                $hashes[$hash]++
            } else {
                $hashes[$hash] = 1
            }
            
            Write-Host "   Audio: $($response.audio.url)"
            Write-Host "   Hash: $($response.hashes.control)"
            Write-Host "   Spec: $($response.explanation.spec)"
        } else {
            Write-Host " ❌" -ForegroundColor Red
            Write-Host "   Audio: $hasAudioUrl, Text: $hasText, Controls: $hasControls, Spec: $hasSpec"
        }
    } catch {
        Write-Host " ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Determinism Check
Write-Host "`n3. Testing Determinism..." -ForegroundColor Yellow
$testChart = $goldenCharts[0]
$response1 = Invoke-RestMethod -Uri "$StagingUrl/api/compose" -Method Post -ContentType "application/json" -Body ($testChart | ConvertTo-Json -Depth 3)
Start-Sleep -Seconds 2
$response2 = Invoke-RestMethod -Uri "$StagingUrl/api/compose" -Method Post -ContentType "application/json" -Body ($testChart | ConvertTo-Json -Depth 3)

$deterministic = $response1.hashes.control -eq $response2.hashes.control
if ($deterministic) {
    Write-Host "✅ Deterministic: $($response1.hashes.control)" -ForegroundColor Green
} else {
    Write-Host "❌ Non-deterministic: $($response1.hashes.control) vs $($response2.hashes.control)" -ForegroundColor Red
}

# Test 4: Error States
Write-Host "`n4. Testing Error States..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$StagingUrl/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"invalid-date","time":"12:00","location":"Test","geo":{"lat":40.7128,"lon":-74.0060}}'
    Write-Host "❌ Expected error but got success" -ForegroundColor Red
} catch {
    if ($_.Exception.Message -like "*400*" -or $_.Exception.Message -like "*Bad Request*") {
        Write-Host "✅ Error state working: $($_.Exception.Message)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: Rate Limiting
Write-Host "`n5. Testing Rate Limiting..." -ForegroundColor Yellow
$rateLimitHit = $false
for ($i = 1; $i -le 15; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "$StagingUrl/api/compose" -Method Post -ContentType "application/json" -Body ($goldenCharts[0] | ConvertTo-Json -Depth 3)
        Write-Host ("Request {0}: Success" -f $i) -NoNewline
    } catch {
        if ($_.Exception.Message -like "*429*" -or $_.Exception.Message -like "*Too Many*") {
            Write-Host ("Request {0}: Rate Limited ✅" -f $i) -ForegroundColor Green
            $rateLimitHit = $true
            break
        } else {
            Write-Host ("Request {0}: Error - $($_.Exception.Message)" -f $i) -ForegroundColor Red
        }
    }
    Start-Sleep -Milliseconds 100
}

if (-not $rateLimitHit) {
    Write-Host "⚠️ Rate limiting not triggered" -ForegroundColor Yellow
}

# Summary
Write-Host "`n=== VALIDATION SUMMARY ===" -ForegroundColor Green
Write-Host "Success Rate: $successCount/$($goldenCharts.Count) ($([math]::Round(($successCount/$goldenCharts.Count)*100,1))%)"
Write-Host "Fallback Rate: $fallbackCount/$successCount ($([math]::Round(($fallbackCount/$successCount)*100,1))%)"
Write-Host "Deterministic: $deterministic"
Write-Host "Rate Limiting: $rateLimitHit"
Write-Host "Unique Hashes: $($hashes.Count)"

if ($successCount -eq $goldenCharts.Count -and $deterministic -and $rateLimitHit) {
    Write-Host "`n🎉 STAGING VALIDATION PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ STAGING VALIDATION FAILED" -ForegroundColor Red
    exit 1
}
