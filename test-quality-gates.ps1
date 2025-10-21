# Test Quality Gates - try to trigger a failure
Write-Host "Testing Quality Gates..." -ForegroundColor Cyan

# Test with parameters that might trigger quality gate failure
$testPayloads = @(
    @{
        name = "Normal Request"
        body = '{"mode":"sandbox","controls":{},"seed":12345}'
    },
    @{
        name = "Low Quality Request"
        body = '{"mode":"sandbox","controls":{"arc_shape":0.1,"density_level":0.1,"tempo_norm":0.1,"step_bias":0.1,"leap_cap":1,"rhythm_template_id":0,"syncopation_bias":0.1,"motif_rate":0.1},"seed":99999}'
    }
)

foreach ($test in $testPayloads) {
    Write-Host "`nTesting: $($test.name)" -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/compose' -Method Post -Body $test.body -ContentType 'application/json' -TimeoutSec 10
        
        Write-Host "  Response received:" -ForegroundColor Green
        Write-Host "    Spec: $($response.explanation.spec)"
        Write-Host "    Control Hash: $($response.controls.hash)"
        Write-Host "    Audio URL: $($response.audio.url)"
        
        # Check gate report
        if ($response.gate_report) {
            Write-Host "    Gate Report:" -ForegroundColor Cyan
            Write-Host "      Calibrated Overall: $($response.gate_report.calibrated.overall)"
            Write-Host "      Strict Overall: $($response.gate_report.strict.overall)"
            if ($response.gate_report.scores) {
                Write-Host "      Scores:" -ForegroundColor Cyan
                $response.gate_report.scores | Get-Member -MemberType NoteProperty | ForEach-Object {
                    $score = $response.gate_report.scores.($_.Name)
                    Write-Host "        $($_.Name): $score"
                }
            }
        }
        
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nQuality Gate Test Complete" -ForegroundColor Cyan
