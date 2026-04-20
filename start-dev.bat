@echo off
chcp 65001 >nul
echo 🚀 Starting Asset Manager Dev Environment...
echo.

:: Kill any processes on port 5000 (API server)
echo [1/4] Checking for existing API server on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo   → Killing process %%a on port 5000...
    taskkill /F /PID %%a 2>nul
)

:: Kill any processes on port 5173 (Dashboard)
echo [2/4] Checking for existing Dashboard on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo   → Killing process %%a on port 5173...
    taskkill /F /PID %%a 2>nul
)

:: Give ports time to release
timeout /t 2 /nobreak >nul

echo.
echo [3/4] Starting API Server on http://localhost:5000...
start "API Server" cmd /k "cd /d "%~dp0artifacts\api-server" && corepack pnpm run dev"

:: Wait for API to start
timeout /t 5 /nobreak >nul

echo [4/4] Starting Dashboard on http://localhost:5173...
start "Dashboard" cmd /k "cd /d "%~dp0artifacts\dashboard" && corepack pnpm run dev"

echo.
echo ✅ Servers starting...
echo    API Server:   http://localhost:5000
echo    Dashboard:    http://localhost:5173
echo.
echo Press any key to exit this window (servers will keep running)...
pause >nul
