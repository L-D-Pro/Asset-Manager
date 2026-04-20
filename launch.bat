@echo off
echo ==========================================
echo Asset Manager Dev Server Launcher
echo ==========================================
echo.

echo Step 1: Closing existing server windows...
taskkill /F /FI "WINDOWTITLE eq API Server - Port 5000" 2>nul
taskkill /F /FI "WINDOWTITLE eq Dashboard - Port 5173" 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Step 2: Starting API Server on port 5000...
start "API Server - Port 5000" cmd /k "cd /d "%~dp0artifacts\api-server" && echo Starting API server... && corepack pnpm run dev"

echo.
echo Step 3: Waiting for API server to start...
timeout /t 8 /nobreak >nul

echo.
echo Step 4: Starting Dashboard on port 5173...
start "Dashboard - Port 5173" cmd /k "cd /d "%~dp0artifacts\dashboard" && echo Starting dashboard... && corepack pnpm run dev"

echo.
echo ==========================================
echo DONE! Servers are starting in new windows.
echo.
echo API Server:   http://localhost:5000
echo Dashboard:    http://localhost:5173
echo ==========================================
echo.
echo Wait about 10-15 seconds for both servers to fully start,
echo then open your browser to http://localhost:5173
echo.
pause
