# Astradio Black-Box Tests

## Prerequisites

- Express server running on port 3000
- Next.js frontend running on port 3001
- PowerShell or curl available

## Test 1: Unified Spec v1.1 Response

**Command:**
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
```

**Expected Results:**
- `$response.explanation.spec` = "UnifiedSpecV1.1"
- `$response.audio.url` is not null (e.g., "/api/audio/247f29c5.mp3")
- `$response.hashes.control` starts with "sha256:"
- `$response.artifacts.model` is present

## Test 2: Determinism

**Command:**
```powershell
$response1 = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
$response2 = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
Write-Host "Deterministic: $($response1.hashes.control -eq $response2.hashes.control)"
```

**Expected Result:**
- Output: "Deterministic: True"

## Test 3: Input Validation

**Command (Invalid Date):**
```powershell
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"invalid-date","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
} catch {
    Write-Host "Expected error: $($_.Exception.Message)"
}
```

**Expected Result:**
- HTTP 400 error with validation details

**Command (Invalid Coordinates):**
```powershell
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":999,"lon":-74.0060}}'
} catch {
    Write-Host "Expected error: $($_.Exception.Message)"
}
```

**Expected Result:**
- HTTP 400 error with validation details

## Test 4: Rate Limiting

**Command (Rapid Requests):**
```powershell
for ($i = 1; $i -le 15; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
        Write-Host "Request $i: Success"
    } catch {
        Write-Host "Request $i: $($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds 100
}
```

**Expected Result:**
- First 10 requests succeed
- Requests 11+ return HTTP 429 (Too Many Requests)

## Test 5: Direct Express Access

**Command:**
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
Write-Host "Direct Express - explanation.spec: $($response.explanation.spec)"
Write-Host "Direct Express - audio.url: $($response.audio.url)"
```

**Expected Result:**
- Same response format as Test 1
- Confirms proxy is working correctly

## Test 6: Health Check

**Command:**
```powershell
$health = Invoke-RestMethod -Uri "http://localhost:3000/health"
Write-Host "Express health: $($health.status)"
```

**Expected Result:**
- Output: "Express health: ok"

## Test 7: Fallback Mode (Express Down)

**Command (with Express server stopped):**
```powershell
# Stop Express server first, then:
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
Write-Host "Fallback mode: $($response.engine_fallback)"
```

**Expected Result:**
- `$response.engine_fallback` = true
- Response contains basic controlSurface and explanation.text
- Audio.url = null

## Automated Test Script

```powershell
# Run all tests
Write-Host "=== Astradio Black-Box Tests ==="

# Test 1: Unified Spec
Write-Host "`n1. Testing Unified Spec v1.1..."
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
if ($response.explanation.spec -eq "UnifiedSpecV1.1" -and $response.audio.url -ne $null) {
    Write-Host "✓ Unified Spec test passed"
} else {
    Write-Host "✗ Unified Spec test failed"
}

# Test 2: Determinism
Write-Host "`n2. Testing determinism..."
$response1 = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
$response2 = Invoke-RestMethod -Uri "http://localhost:3001/api/compose" -Method Post -ContentType "application/json" -Body '{"date":"1990-01-01","time":"12:00","location":"New York","geo":{"lat":40.7128,"lon":-74.0060}}'
if ($response1.hashes.control -eq $response2.hashes.control) {
    Write-Host "✓ Determinism test passed"
} else {
    Write-Host "✗ Determinism test failed"
}

# Test 3: Health Check
Write-Host "`n3. Testing health check..."
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health"
    if ($health.status -eq "ok") {
        Write-Host "✓ Health check passed"
    } else {
        Write-Host "✗ Health check failed"
    }
} catch {
    Write-Host "✗ Health check failed: $($_.Exception.Message)"
}

Write-Host "`n=== Tests Complete ==="
```

