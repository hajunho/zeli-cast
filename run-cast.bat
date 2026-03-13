@echo off
echo ====================================
echo   ZeliCast Weather Server (Express)
echo ====================================
echo.

cd /d "%~dp0backend_cast"

echo [1/2] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

node --version

echo.
echo [1-1/2] Checking dependencies...

:: Check if node_modules exists
if exist "node_modules\express" (
    echo   Dependencies already installed. Skipping npm install.
    echo   [To force reinstall, delete backend_cast\node_modules]
) else (
    echo   Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
    echo   Dependencies installed successfully.
)

echo.
echo [2/2] Starting ZeliCast Server (Port 5171)...
echo.
echo ZeliCast will be available at: http://localhost:5171
echo API endpoint: http://localhost:5171/api/cast/weather?lat=37.5665^&lon=126.9780
echo Press Ctrl+C to stop the server.
echo.

node index.js

pause
