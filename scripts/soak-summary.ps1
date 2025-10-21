# 24-Hour Soak Summary Generator
# Compiles JSONL evidence into a one-page report

param(
    [string]$JsonlFile = "soak-evidence/soak-evidence.jsonl",
    [string]$OutputFile = "soak-evidence/24h-soak-summary.txt"
)

function Get-SoakSummary {
    if (-not (Test-Path $JsonlFile)) {
        Write-Host "❌ JSONL file not found: $JsonlFile" -ForegroundColor Red
        return
    }
    
    Write-Host "📊 Analyzing 24h soak evidence..." -ForegroundColor Green
    
    # Read and parse JSONL
    $entries = @()
    Get-Content $JsonlFile | ForEach-Object {
        if ($_.Trim()) {
            $parts = $_ -split ' ', 2
            if ($parts.Count -eq 2) {
                try {
                    $data = $parts[1] | ConvertFrom-Json
                    $entries += $data
                } catch {
                    Write-Host "⚠️ Skipping malformed line: $_" -ForegroundColor Yellow
                }
            }
        }
    }
    
    if ($entries.Count -eq 0) {
        Write-Host "❌ No valid entries found" -ForegroundColor Red
        return
    }
    
    # Group by run_id to get hourly data
    $runs = $entries | Group-Object run_id
    $hourlyData = @()
    
    foreach ($run in $runs) {
        $runEntries = $run.Group
        $successCount = ($runEntries | Where-Object { $_.success -eq $true }).Count
        $totalCount = $runEntries.Count
        $fallbackCount = ($runEntries | Where-Object { $_.fallbackUsed -eq $true }).Count
        $errorCount = ($runEntries | Where-Object { $_.success -eq $false }).Count
        
        $latencies = $runEntries | Where-Object { $_.composeLatencyMs } | ForEach-Object { $_.composeLatencyMs }
        $audioStartups = $runEntries | Where-Object { $_.audioStartupMs } | ForEach-Object { $_.audioStartupMs }
        
        $hourlyData += @{
            runId = $run.Name
            timestamp = $runEntries[0].timestamp
            successRate = ($successCount / $totalCount) * 100
            fallbackRate = ($fallbackCount / $totalCount) * 100
            errorRate = ($errorCount / $totalCount) * 100
            p50Latency = if ($latencies.Count -gt 0) { ($latencies | Sort-Object)[[math]::Floor($latencies.Count * 0.5)] } else { 0 }
            p95Latency = if ($latencies.Count -gt 0) { ($latencies | Sort-Object)[[math]::Floor($latencies.Count * 0.95)] } else { 0 }
            p50AudioStartup = if ($audioStartups.Count -gt 0) { ($audioStartups | Sort-Object)[[math]::Floor($audioStartups.Count * 0.5)] } else { 0 }
            p95AudioStartup = if ($audioStartups.Count -gt 0) { ($audioStartups | Sort-Object)[[math]::Floor($audioStartups.Count * 0.95)] } else { 0 }
        }
    }
    
    # Calculate overall metrics
    $allEntries = $entries
    $overallSuccessRate = (($allEntries | Where-Object { $_.success -eq $true }).Count / $allEntries.Count) * 100
    $overallFallbackRate = (($allEntries | Where-Object { $_.fallbackUsed -eq $true }).Count / $allEntries.Count) * 100
    $overallErrorRate = (($allEntries | Where-Object { $_.success -eq $false }).Count / $allEntries.Count) * 100
    
    $allLatencies = $allEntries | Where-Object { $_.composeLatencyMs } | ForEach-Object { $_.composeLatencyMs }
    $allAudioStartups = $allEntries | Where-Object { $_.audioStartupMs } | ForEach-Object { $_.audioStartupMs }
    
    $overallP50Latency = if ($allLatencies.Count -gt 0) { ($allLatencies | Sort-Object)[[math]::Floor($allLatencies.Count * 0.5)] } else { 0 }
    $overallP95Latency = if ($allLatencies.Count -gt 0) { ($allLatencies | Sort-Object)[[math]::Floor($allLatencies.Count * 0.95)] } else { 0 }
    $overallP50AudioStartup = if ($allAudioStartups.Count -gt 0) { ($allAudioStartups | Sort-Object)[[math]::Floor($allAudioStartups.Count * 0.5)] } else { 0 }
    $overallP95AudioStartup = if ($allAudioStartups.Count -gt 0) { ($allAudioStartups | Sort-Object)[[math]::Floor($allAudioStartups.Count * 0.95)] } else { 0 }
    
    # Check thresholds
    $thresholds = @{
        ErrorRate = 1.0
        FallbackRate = 2.0
        P95Latency = 1800
        P95AudioStartup = 2500
    }
    
    $violations = @()
    if ($overallErrorRate -gt $thresholds.ErrorRate) { $violations += "Error rate: $([math]::Round($overallErrorRate, 1))% > $($thresholds.ErrorRate)%" }
    if ($overallFallbackRate -gt $thresholds.FallbackRate) { $violations += "Fallback rate: $([math]::Round($overallFallbackRate, 1))% > $($thresholds.FallbackRate)%" }
    if ($overallP95Latency -gt $thresholds.P95Latency) { $violations += "P95 latency: $([math]::Round($overallP95Latency, 0))ms > $($thresholds.P95Latency)ms" }
    if ($overallP95AudioStartup -gt $thresholds.P95AudioStartup) { $violations += "P95 audio startup: $([math]::Round($overallP95AudioStartup, 0))ms > $($thresholds.P95AudioStartup)ms" }
    
    # Generate summary
    $summary = @"
# 24-Hour Staging Soak Summary
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")

## Overall Results
- **Total Runs**: $($runs.Count) hours
- **Total Charts**: $($allEntries.Count) tests
- **Success Rate**: $([math]::Round($overallSuccessRate, 1))%
- **Fallback Rate**: $([math]::Round($overallFallbackRate, 1))%
- **Error Rate**: $([math]::Round($overallErrorRate, 1))%

## Performance Metrics
- **P50 Compose Latency**: $([math]::Round($overallP50Latency, 0))ms
- **P95 Compose Latency**: $([math]::Round($overallP95Latency, 0))ms
- **P50 Audio Startup**: $([math]::Round($overallP50AudioStartup, 0))ms
- **P95 Audio Startup**: $([math]::Round($overallP95AudioStartup, 0))ms

## Threshold Status
"@

    if ($violations.Count -eq 0) {
        $summary += "`n✅ **ALL THRESHOLDS PASSED**`n"
    } else {
        $summary += "`n❌ **THRESHOLD VIOLATIONS:**`n"
        foreach ($violation in $violations) {
            $summary += "- $violation`n"
        }
    }
    
    $summary += @"

## Hourly Trend
"@

    # Add hourly trend (simple ASCII chart)
    if ($hourlyData.Count -gt 1) {
        $summary += "`n### Compose Latency P95 Trend`n"
        $summary += '```'
        $maxLatency = ($hourlyData | ForEach-Object { $_.p95Latency } | Measure-Object -Maximum).Maximum
        $minLatency = ($hourlyData | ForEach-Object { $_.p95Latency } | Measure-Object -Minimum).Minimum
        $range = $maxLatency - $minLatency
        if ($range -gt 0) {
            foreach ($hour in $hourlyData) {
                $barLength = [math]::Round(($hour.p95Latency - $minLatency) / $range * 20)
                $filledBar = "#" * $barLength
                $emptyBar = "-" * (20 - $barLength)
                $bar = $filledBar + $emptyBar
                $timeStr = $hour.timestamp.Substring(11,5)
                $latencyStr = [math]::Round($hour.p95Latency, 0)
                $summary += "`n$timeStr |$bar| ${latencyStr}ms"
            }
        }
        $summary += "`n```"
        
        $summary += '`n### Fallback Rate Trend`n'
        $summary += '```'
        $maxFallback = ($hourlyData | ForEach-Object { $_.fallbackRate } | Measure-Object -Maximum).Maximum
        $minFallback = ($hourlyData | ForEach-Object { $_.fallbackRate } | Measure-Object -Minimum).Minimum
        $fallbackRange = $maxFallback - $minFallback
        if ($fallbackRange -gt 0) {
            foreach ($hour in $hourlyData) {
                $barLength = [math]::Round(($hour.fallbackRate - $minFallback) / $fallbackRange * 20)
                $filledBar = "#" * $barLength
                $emptyBar = "-" * (20 - $barLength)
                $bar = $filledBar + $emptyBar
                $timeStr = $hour.timestamp.Substring(11,5)
                $fallbackStr = [math]::Round($hour.fallbackRate, 1)
                $summary += "`n$timeStr |$bar| ${fallbackStr}%"
            }
        }
        $summary += "`n```"
    }
    
    $summary += @"

## Detailed Hourly Data
"@

    foreach ($hour in $hourlyData) {
        $timeStr = $hour.timestamp.Substring(0,16)
        $summary += "`n### $timeStr UTC`n"
        $summary += "- Success Rate: $([math]::Round($hour.successRate, 1))%`n"
        $summary += "- Fallback Rate: $([math]::Round($hour.fallbackRate, 1))%`n"
        $summary += "- Error Rate: $([math]::Round($hour.errorRate, 1))%`n"
        $summary += "- P95 Latency: $([math]::Round($hour.p95Latency, 0))ms`n"
        $summary += "- P95 Audio Startup: $([math]::Round($hour.p95AudioStartup, 0))ms`n"
    }
    
    $summary += "`n`n## Evidence Files`n"
    $summary += "- **JSONL Log**: $JsonlFile`n"
    $summary += "- **HAR Files**: soak-evidence/failure-*.har`n"
    $summary += "- **Generated**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')`n"
    $summary += "`n## Next Steps`n"

    if ($violations.Count -eq 0) {
        $summary += "`n✅ **SOAK PASSED** - Ready for beta handoff`n"
    } else {
        $summary += "`n❌ **SOAK FAILED** - Address threshold violations before beta`n"
    }
    
    # Write summary
    $summary | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "📄 Summary written to: $OutputFile" -ForegroundColor Green
    
    # Display key metrics
    Write-Host "`n📈 Key Metrics:" -ForegroundColor Cyan
    Write-Host "Success Rate: $([math]::Round($overallSuccessRate, 1))%"
    Write-Host "Fallback Rate: $([math]::Round($overallFallbackRate, 1))%"
    Write-Host "P95 Latency: $([math]::Round($overallP95Latency, 0))ms"
    Write-Host "P95 Audio Startup: $([math]::Round($overallP95AudioStartup, 0))ms"
    
    if ($violations.Count -eq 0) {
        Write-Host "`nSOAK PASSED" -ForegroundColor Green
    } else {
        Write-Host "`nSOAK FAILED" -ForegroundColor Red
        foreach ($violation in $violations) {
            Write-Host "  - $violation" -ForegroundColor Red
        }
    }
}

# Run summary generation
Get-SoakSummary
