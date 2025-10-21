# Test determinism - same inputs should produce same outputs
Write-Host "Testing Determinism..." -ForegroundColor Cyan

# First request
Write-Host "Making first request..." -ForegroundColor Yellow
$response1 = Invoke-RestMethod -Uri 'http://localhost:3000/api/compose' -Method Post -Body '{"mode":"sandbox","controls":{},"seed":12345}' -ContentType 'application/json' -TimeoutSec 10

Write-Host "Response 1 Results:" -ForegroundColor Green
Write-Host "  Spec: $($response1.explanation.spec)"
Write-Host "  Control Hash: $($response1.controls.hash)"
Write-Host "  Audio URL: $($response1.audio.url)"
Write-Host "  Audio Hash: $($response1.hashes.audio)"

# Second identical request
Write-Host "`nMaking second identical request..." -ForegroundColor Yellow
$response2 = Invoke-RestMethod -Uri 'http://localhost:3000/api/compose' -Method Post -Body '{"mode":"sandbox","controls":{},"seed":12345}' -ContentType 'application/json' -TimeoutSec 10

Write-Host "Response 2 Results:" -ForegroundColor Green
Write-Host "  Spec: $($response2.explanation.spec)"
Write-Host "  Control Hash: $($response2.controls.hash)"
Write-Host "  Audio URL: $($response2.audio.url)"
Write-Host "  Audio Hash: $($response2.hashes.audio)"

# Compare results
Write-Host "`nDeterminism Check:" -ForegroundColor Cyan
$specMatch = $response1.explanation.spec -eq $response2.explanation.spec
$hashMatch = $response1.controls.hash -eq $response2.controls.hash
$audioUrlMatch = $response1.audio.url -eq $response2.audio.url
$audioHashMatch = $response1.hashes.audio -eq $response2.hashes.audio

Write-Host "  Spec Match: $specMatch" -ForegroundColor $(if($specMatch) {"Green"} else {"Red"})
Write-Host "  Hash Match: $hashMatch" -ForegroundColor $(if($hashMatch) {"Green"} else {"Red"})
Write-Host "  Audio URL Match: $audioUrlMatch" -ForegroundColor $(if($audioUrlMatch) {"Green"} else {"Red"})
Write-Host "  Audio Hash Match: $audioHashMatch" -ForegroundColor $(if($audioHashMatch) {"Green"} else {"Red"})

$allMatch = $specMatch -and $hashMatch -and $audioUrlMatch -and $audioHashMatch
Write-Host "`nOverall Determinism: $allMatch" -ForegroundColor $(if($allMatch) {"Green"} else {"Red"})
