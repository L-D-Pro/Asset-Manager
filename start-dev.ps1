# Asset Manager Dev Environment Starter Script
# Run with: .\start-dev.ps1

Write-Host "🚀 Starting Asset Manager Dev Environment..." -ForegroundColor Green
Write-Host ""

# Function to kill process on a port
function Kill-PortProcess {
    param([int]$Port, [string]$Name)
    
    Write-Host "[$($stepCounter)/4] " -NoNewline -ForegroundColor Yellow
    Write-Host "Checking for existing $Name on port $Port..."
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($connection) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  → Killing process $($process.Id) ($($process.ProcessName)) on port $Port..." -ForegroundColor Red
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        # Port might not be in use, that's fine
    }
    
    $script:stepCounter++
}

$script:stepCounter = 1

# Kill existing servers
Kill-PortProcess -Port 5000 -Name "API Server"
Kill-PortProcess -Port 5173 -Name "Dashboard"

# Give ports time to release
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[3/4] " -NoNewline -ForegroundColor Yellow
Write-Host "Starting API Server on http://localhost:5000..."
$apiPath = Join-Path $PSScriptRoot "artifacts\api-server"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$apiPath'; corepack pnpm run dev" -WindowStyle Normal

# Wait for API to start
Start-Sleep -Seconds 5

Write-Host "[4/4] " -NoNewline -ForegroundColor Yellow
Write-Host "Starting Dashboard on http://localhost:5173..."
$dashboardPath = Join-Path $PSScriptRoot "artifacts\dashboard"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dashboardPath'; corepack pnpm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Servers starting..." -ForegroundColor Green
Write-Host "   API Server:   http://localhost:5000"
Write-Host "   Dashboard:    http://localhost:5173"
Write-Host ""
Write-Host "Press any key to exit this window (servers will keep running)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
