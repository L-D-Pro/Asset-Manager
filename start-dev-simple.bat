@echo off
echo Starting Asset Manager Dev Environment...
echo.

echo [1/3] Killing existing servers...
taskkill /F /FI "WINDOWTITLE eq API Server" 2>nul
taskkill /F /FI "WINDOWTITLE eq Dashboard" 2>nul

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Killing process on port 5000...
    taskkill /F /PID %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo Killing process on port 5173...
    taskkill /F /PID %%a 2>nul
)

timeout /t 3 /nobreak >nul

echo.
echo [2/3] Starting API Server...
cd /d "%~dp0artifacts\api-server"
start "API Server" cmd /c "corepack pnpm run dev"

timeout /t 5 /nobreak >nul

echo.
echo [3/3] Starting Dashboard...
cd /d "%~dp0artifacts\dashboard"
start "Dashboard" cmd /c "corepack pnpm run dev"

echo.
echo ==========================================
echo Servers starting...
echo API Server:   http://localhost:5000
echo Dashboard:    http://localhost:5173
echo ==========================================
echo.
echo Wait 10 seconds then refresh your browser
echo Press any key to exit (servers keep running)...
pause >nul
