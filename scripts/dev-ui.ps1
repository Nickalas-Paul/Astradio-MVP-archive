# Astradio UI Development Script
# Starts both the backend and frontend development servers

Write-Host "🚀 Starting Astradio Development Environment" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

# Check if Node.js is available
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js v20.12.2" -ForegroundColor Red
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Build vNext system if needed
if (-not (Test-Path "dist/vnext")) {
    Write-Host "🔨 Building vNext system..." -ForegroundColor Yellow
    npm run vnext:build
}

# Start backend server
Write-Host "🔧 Starting backend server on port 3000..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    npm start 
}

# Wait for backend to start
Write-Host "⏳ Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start frontend development server
Write-Host "🎨 Starting frontend development server on port 3001..." -ForegroundColor Cyan
$frontendJob = Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    npm run ui:dev 
}

Write-Host ""
Write-Host "✅ Development environment started!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "   Frontend: http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow

# Function to cleanup on exit
function Cleanup {
    Write-Host ""
    Write-Host "🛑 Stopping development servers..." -ForegroundColor Red
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    exit 0
}

# Set up signal handlers
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup }

# Monitor jobs
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if jobs are still running
        if ($backendJob.State -eq "Failed") {
            Write-Host "❌ Backend server failed to start" -ForegroundColor Red
            break
        }
        
        if ($frontendJob.State -eq "Failed") {
            Write-Host "❌ Frontend server failed to start" -ForegroundColor Red
            break
        }
    }
} catch {
    Cleanup
}
