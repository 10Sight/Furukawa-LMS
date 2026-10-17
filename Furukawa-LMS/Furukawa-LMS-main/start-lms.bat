@echo off
setlocal enabledelayedexpansion
title Furukawa LMS - Server Launcher

echo ========================================================
echo             FURUKAWA LMS - SERVER LAUNCHER
echo ========================================================
echo.

:: Network Configuration
set "LAN_IP=192.168.90.19"
set "FRONTEND_PORT=5174"
set "BACKEND_PORT=3000"
set "APP_URL=http://%LAN_IP%:%FRONTEND_PORT%"

:: 1. Detect project directory
set "PROJECT_DIR=%~dp0"

:: If not found in current folder, check standard known locations
if not exist "%PROJECT_DIR%ecosystem.config.js" (
    if exist "C:\Users\%USERNAME%\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\ecosystem.config.js" (
        set "PROJECT_DIR=C:\Users\%USERNAME%\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\"
    ) else if exist "C:\Users\testuser2\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\ecosystem.config.js" (
        set "PROJECT_DIR=C:\Users\testuser2\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\"
    ) else if exist "D:\10Sight Agency\Sarvagaya Institute\FME\Furukawa-LMS\Furukawa-LMS\Furukawa-LMS-main\ecosystem.config.js" (
        set "PROJECT_DIR=D:\10Sight Agency\Sarvagaya Institute\FME\Furukawa-LMS\Furukawa-LMS\Furukawa-LMS-main\"
    )
)

:: Navigate to project directory
cd /d "%PROJECT_DIR%"

if not exist "%PROJECT_DIR%ecosystem.config.js" (
    echo [ERROR] Could not find ecosystem.config.js in:
    echo %PROJECT_DIR%
    echo.
    echo Please make sure this file is placed inside the project folder
    echo or configure the path inside this .bat file.
    pause
    exit /b 1
)

echo [INFO] Project directory: %PROJECT_DIR%
echo [INFO] Server LAN IP:     %LAN_IP%
echo.

:: 2. Check if PM2 is available
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] 'pm2' command not found directly in PATH.
    echo Trying through npx pm2...
    set "PM2_CMD=npx pm2"
) else (
    set "PM2_CMD=pm2"
)

:: 3. Check if PM2 apps are already running or need starting
echo [INFO] Checking PM2 status...
call %PM2_CMD% describe lms-backend >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] LMS apps are already registered in PM2. Restarting processes...
    call %PM2_CMD% restart ecosystem.config.js --update-env
) else (
    echo [INFO] Launching LMS apps via PM2 ecosystem.config.js...
    call %PM2_CMD% start ecosystem.config.js
)

:: Save current PM2 state
call %PM2_CMD% save >nul 2>&1

echo.
call %PM2_CMD% list

echo.
echo ========================================================
echo   LMS Started Successfully!
echo   - LAN Access (Network):  %APP_URL%
echo   - Local Access:          http://localhost:%FRONTEND_PORT%
echo   - Backend API:           http://%LAN_IP%:%BACKEND_PORT%
echo ========================================================
echo.

:: 4. Open LMS Frontend in Browser (or App Mode if Chrome / Edge is available)
echo [INFO] Opening LMS (%APP_URL%)...

set "BROWSER_OPENED=0"
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=%APP_URL%
    set "BROWSER_OPENED=1"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=%APP_URL%
    set "BROWSER_OPENED=1"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=%APP_URL%
    set "BROWSER_OPENED=1"
)

if "%BROWSER_OPENED%"=="0" (
    start %APP_URL%
)

echo [INFO] Done. PM2 is managing the server in background.
echo This window will close in 5 seconds...
timeout /t 5 >nul
exit /b 0
