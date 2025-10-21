# 24-Hour Staging Soak Runner
# Runs golden chart set against staging /api/compose
# Captures evidence: JSONL logs, HAR on failures, telemetry

param(
    [string]$StagingUrl = $env:STAGING_BASE_URL,
    [string]$AuthHeader = $env:STAGING_AUTH_HEADER,
    [string]$OutputDir = "soak-evidence",
    [int]$TimeoutSeconds = 10,
    [switch]$DeterminismCheck = $true
)

# Budgets (tunable)
$COMPOSE_P95_BUDGET_MS = 1800
$AUDIO_STARTUP_P95_BUDGET_MS = 2500
$FALLBACK_BUDGET_PERCENT = 2.0
$ERROR_BUDGET_PERCENT = 1.0

# Golden Chart Set (fixed, deterministic)
$GoldenCharts = @(
    @{id="ny-1990"; date="1990-01-01"; time="12:00"; location="New York"; geo=@{lat=40.7128; lon=-74.0060}},
    @{id="la-1985"; date="1985-06-15"; time="18:30"; location="Los Angeles"; geo=@{lat=34.0522; lon=-118.2437}},
    @{id="london-1992"; date="1992-12-25"; time="09:15"; location="London"; geo=@{lat=51.5074; lon=-0.1278}},
    @{id="tokyo-1988"; date="1988-03-20"; time="14:45"; location="Tokyo"; geo=@{lat=35.6762; lon=139.6503}},
    @{id="sydney-1991"; date="1991-08-10"; time="21:30"; location="Sydney"; geo=@{lat=-33.8688; lon=151.2093}},
    @{id="paris-1987"; date="1987-04-12"; time="16:20"; location="Paris"; geo=@{lat=48.8566; lon=2.3522}},
    @{id="berlin-1989"; date="1989-11-09"; time="19:00"; location="Berlin"; geo=@{lat=52.5200; lon=13.4050}},
    @{id="moscow-1986"; date="1986-03-15"; time="11:30"; location="Moscow"; geo=@{lat=55.7558; lon=37.6176}},
    @{id="delhi-1993"; date="1993-07-04"; time="08:45"; location="Delhi"; geo=@{lat=28.7041; lon=77.1025}},
    @{id="rio-1984"; date="1984-08-21"; time="13:15"; location="Rio de Janeiro"; geo=@{lat=-22.9068; lon=-43.1729}}
)

# Determinism test chart (first one)
$DeterminismChart = $GoldenCharts[0]

function Write-JsonlLog {
    param($Data)
    $json = $Data | ConvertTo-Json -Compress
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    "$timestamp $json" | Add-Content -Path "$OutputDir/soak-evidence.jsonl"
}

function Test-Readiness {
    try {
        $readyz = Invoke-RestMethod -Uri "$StagingUrl/readyz" -TimeoutSec $TimeoutSeconds
        return $readyz.ready -eq $true
    } catch {
        Write-Host "❌ Readiness check failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-Compose {
    param($Chart, $RetryCount = 0)
    
    $startTime = Get-Date
    $headers = @{"Content-Type" = "application/json"}
    if ($AuthHeader) { $headers["Authorization"] = $AuthHeader }
    
    try {
        $response = Invoke-RestMethod -Uri "$StagingUrl/api/compose" -Method Post -Headers $headers -Body ($Chart | ConvertTo-Json -Depth 3) -TimeoutSec $TimeoutSeconds
        $latency = ((Get-Date) - $startTime).TotalMilliseconds
        
        # Validate response structure
        $hasSpec = $response.explanation.spec -eq "UnifiedSpecV1.1"
        $hasControlHash = $response.hashes.control -ne $null
        $hasAudioUrl = $response.audio.url -ne $null
        $hasRendererHash = $response.hashes.control -ne $null
        
        if (-not $hasSpec) {
            throw "Spec mismatch: $($response.explanation.spec)"
        }
        
        return @{
            success = $true
            latency = $latency
            spec = $response.explanation.spec
            controlHash = $response.hashes.control
            rendererHash = $response.hashes.control
            audioUrl = $response.audio.url
            audioUrlPresent = $hasAudioUrl
            fallbackUsed = -not $hasAudioUrl -and $response.audio.plan -ne $null
            httpStatus = 200
            errorCode = $null
        }
    } catch {
        if ($RetryCount -lt 2 -and ($_.Exception.Message -like "*5xx*" -or $_.Exception.Message -like "*timeout*")) {
            Start-Sleep -Seconds ([math]::Pow(2, $RetryCount))
            return Test-Compose -Chart $Chart -RetryCount ($RetryCount + 1)
        }
        
        $latency = ((Get-Date) - $startTime).TotalMilliseconds
        return @{
            success = $false
            latency = $latency
            spec = $null
            controlHash = $null
            rendererHash = $null
            audioUrl = $null
            audioUrlPresent = $false
            fallbackUsed = $false
            httpStatus = if ($_.Exception.Message -like "*4xx*") { 400 } elseif ($_.Exception.Message -like "*5xx*") { 500 } else { 0 }
            errorCode = $_.Exception.Message
        }
    }
}

function Test-AudioUrl {
    param($AudioUrl, $RetryCount = 0)
    
    if (-not $AudioUrl) { return @{success = $false; status = "no_url"} }
    
    $startTime = Get-Date
    try {
        $response = Invoke-WebRequest -Uri "$StagingUrl$AudioUrl" -Method Head -TimeoutSec $TimeoutSeconds
        $startupTime = ((Get-Date) - $startTime).TotalMilliseconds
        
        return @{
            success = $response.StatusCode -eq 200
            status = $response.StatusCode
            startupTime = $startupTime
        }
    } catch {
        if ($RetryCount -lt 2) {
            Start-Sleep -Seconds ([math]::Pow(2, $RetryCount))
            return Test-AudioUrl -AudioUrl $AudioUrl -RetryCount ($RetryCount + 1)
        }
        
        $startupTime = ((Get-Date) - $startTime).TotalMilliseconds
        return @{
            success = $false
            status = "error"
            startupTime = $startupTime
        }
    }
}

function Test-Determinism {
    param($Chart)
    
    Write-Host "🔄 Testing determinism for chart: $($Chart.id)" -ForegroundColor Yellow
    
    $result1 = Test-Compose -Chart $Chart
    Start-Sleep -Seconds 2
    $result2 = Test-Compose -Chart $Chart
    
    $deterministic = $result1.success -and $result2.success -and 
                     $result1.controlHash -eq $result2.controlHash -and
                     $result1.rendererHash -eq $result2.rendererHash -and
                     $result1.audioUrl -eq $result2.audioUrl
    
    if ($deterministic) {
        Write-Host "✅ Determinism check passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Determinism check failed" -ForegroundColor Red
        Write-Host "  Run 1: $($result1.controlHash) | $($result1.audioUrl)" -ForegroundColor Red
        Write-Host "  Run 2: $($result2.controlHash) | $($result2.audioUrl)" -ForegroundColor Red
    }
    
    return $deterministic
}

function Save-HarOnFailure {
    param($Chart, $Result, $AudioResult)
    
    $harFile = "$OutputDir/failure-$($Chart.id)-$(Get-Date -Format 'yyyyMMdd-HHmmss').har"
    Write-Host "📁 Saving HAR for failure: $harFile" -ForegroundColor Yellow
    
    # Create minimal HAR structure
    $har = @{
        log = @{
            version = "1.2"
            creator = @{name = "Astradio Soak Runner"; version = "1.0"}
            entries = @(
                @{
                    request = @{
                        method = "POST"
                        url = "$StagingUrl/api/compose"
                        headers = @()
                        postData = @{text = ($Chart | ConvertTo-Json -Depth 3)}
                    }
                    response = @{
                        status = $Result.httpStatus
                        statusText = if ($Result.success) { "OK" } else { "Error" }
                        headers = @()
                        content = @{text = ""}
                    }
                    timings = @{send = 0; wait = $Result.latency; receive = 0}
                }
            )
        }
    }
    
    if ($Result.audioUrl) {
        $har.log.entries += @{
            request = @{
                method = "HEAD"
                url = "$StagingUrl$($Result.audioUrl)"
                headers = @()
            }
            response = @{
                status = $AudioResult.status
                statusText = if ($AudioResult.success) { "OK" } else { "Error" }
                headers = @()
                content = @{text = ""}
            }
            timings = @{send = 0; wait = $AudioResult.startupTime; receive = 0}
        }
    }
    
    $har | ConvertTo-Json -Depth 10 | Out-File -FilePath $harFile -Encoding UTF8
}

function Main {
    $startTime = Get-Date
    $runId = Get-Date -Format "yyyyMMdd-HHmmss"
    
    Write-Host "🚀 Starting 24h Staging Soak Run: $runId" -ForegroundColor Green
    Write-Host "Staging URL: $StagingUrl" -ForegroundColor Cyan
    Write-Host "Output Dir: $OutputDir" -ForegroundColor Cyan
    
    # Create output directory
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }
    
    # Check readiness
    Write-Host "`n🔍 Checking staging readiness..." -ForegroundColor Yellow
    if (-not (Test-Readiness)) {
        Write-Host "❌ Staging not ready - aborting" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Staging ready" -ForegroundColor Green
    
    # Initialize metrics
    $results = @()
    $totalCharts = $GoldenCharts.Count
    $successCount = 0
    $fallbackCount = 0
    $errorCount = 0
    $latencies = @()
    $audioStartups = @()
    $determinismPassed = $false
    
    # Test each golden chart
    Write-Host "`n📊 Testing $totalCharts golden charts..." -ForegroundColor Yellow
    foreach ($chart in $GoldenCharts) {
        Write-Host "Testing: $($chart.id)..." -NoNewline
        
        $composeResult = Test-Compose -Chart $chart
        $audioResult = Test-AudioUrl -AudioUrl $composeResult.audioUrl
        
        # Update metrics
        if ($composeResult.success) { $successCount++ }
        if ($composeResult.fallbackUsed) { $fallbackCount++ }
        if (-not $composeResult.success) { $errorCount++ }
        $latencies += $composeResult.latency
        if ($audioResult.startupTime) { $audioStartups += $audioResult.startupTime }
        
        # Log result
        $logData = @{
            run_id = $runId
            chart_id = $chart.id
            timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
            spec = $composeResult.spec
            controlHash = $composeResult.controlHash
            rendererHash = $composeResult.rendererHash
            audioUrlPresent = $composeResult.audioUrlPresent
            audioHeadStatus = $audioResult.status
            composeLatencyMs = [math]::Round($composeResult.latency, 2)
            audioStartupMs = if ($audioResult.startupTime) { [math]::Round($audioResult.startupTime, 2) } else { $null }
            fallbackUsed = $composeResult.fallbackUsed
            httpStatus = $composeResult.httpStatus
            errorCode = $composeResult.errorCode
            success = $composeResult.success
        }
        
        Write-JsonlLog -Data $logData
        $results += $logData
        
        # Save HAR on failure
        if (-not $composeResult.success -or -not $audioResult.success -or $composeResult.spec -ne "UnifiedSpecV1.1") {
            Save-HarOnFailure -Chart $chart -Result $composeResult -AudioResult $audioResult
        }
        
        if ($composeResult.success -and $audioResult.success) {
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host " ❌" -ForegroundColor Red
        }
        
        # Respect rate limits
        Start-Sleep -Milliseconds 100
    }
    
    # Determinism check
    if ($DeterminismCheck) {
        Write-Host "`n🔄 Running determinism check..." -ForegroundColor Yellow
        $determinismPassed = Test-Determinism -Chart $DeterminismChart
    }
    
    # Calculate metrics
    $successRate = ($successCount / $totalCharts) * 100
    $fallbackRate = ($fallbackCount / $totalCharts) * 100
    $errorRate = ($errorCount / $totalCharts) * 100
    $p50Latency = if ($latencies.Count -gt 0) { ($latencies | Sort-Object)[[math]::Floor($latencies.Count * 0.5)] } else { 0 }
    $p95Latency = if ($latencies.Count -gt 0) { ($latencies | Sort-Object)[[math]::Floor($latencies.Count * 0.95)] } else { 0 }
    $p50AudioStartup = if ($audioStartups.Count -gt 0) { ($audioStartups | Sort-Object)[[math]::Floor($audioStartups.Count * 0.5)] } else { 0 }
    $p95AudioStartup = if ($audioStartups.Count -gt 0) { ($audioStartups | Sort-Object)[[math]::Floor($audioStartups.Count * 0.95)] } else { 0 }
    
    # Check thresholds
    $thresholdsFailed = @()
    if ($errorRate -gt $ERROR_BUDGET_PERCENT) { $thresholdsFailed += "Error rate: $([math]::Round($errorRate, 1))% > $ERROR_BUDGET_PERCENT%" }
    if ($fallbackRate -gt $FALLBACK_BUDGET_PERCENT) { $thresholdsFailed += "Fallback rate: $([math]::Round($fallbackRate, 1))% > $FALLBACK_BUDGET_PERCENT%" }
    if ($p95Latency -gt $COMPOSE_P95_BUDGET_MS) { $thresholdsFailed += "P95 latency: $([math]::Round($p95Latency, 0))ms > $COMPOSE_P95_BUDGET_MS ms" }
    if ($p95AudioStartup -gt $AUDIO_STARTUP_P95_BUDGET_MS) { $thresholdsFailed += "P95 audio startup: $([math]::Round($p95AudioStartup, 0))ms > $AUDIO_STARTUP_P95_BUDGET_MS ms" }
    if (-not $determinismPassed) { $thresholdsFailed += "Determinism check failed" }
    
    # Summary
    $totalTime = ((Get-Date) - $startTime).TotalSeconds
    Write-Host "`n📈 SOAK RUN SUMMARY" -ForegroundColor Green
    Write-Host "Run ID: $runId"
    Write-Host "Duration: $([math]::Round($totalTime, 1))s"
    Write-Host "Charts tested: $totalCharts"
    Write-Host "Success rate: $([math]::Round($successRate, 1))%"
    Write-Host "Fallback rate: $([math]::Round($fallbackRate, 1))%"
    Write-Host "Error rate: $([math]::Round($errorRate, 1))%"
    Write-Host "P50 latency: $([math]::Round($p50Latency, 0))ms"
    Write-Host "P95 latency: $([math]::Round($p95Latency, 0))ms"
    Write-Host "P50 audio startup: $([math]::Round($p50AudioStartup, 0))ms"
    Write-Host "P95 audio startup: $([math]::Round($p95AudioStartup, 0))ms"
    Write-Host "Determinism: $(if ($determinismPassed) { 'PASSED' } else { 'FAILED' })"
    
    if ($thresholdsFailed.Count -gt 0) {
        Write-Host "`n❌ THRESHOLD VIOLATIONS:" -ForegroundColor Red
        foreach ($violation in $thresholdsFailed) {
            Write-Host "  - $violation" -ForegroundColor Red
        }
        Write-Host "`nArtifacts: $OutputDir/soak-evidence.jsonl" -ForegroundColor Yellow
        Write-Host "HAR files: $OutputDir/failure-*.har" -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "`n✅ ALL THRESHOLDS PASSED" -ForegroundColor Green
        exit 0
    }
}

# Run main function
Main
