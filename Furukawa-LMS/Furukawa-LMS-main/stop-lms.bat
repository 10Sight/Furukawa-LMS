@echo off
setlocal
title Furukawa LMS - Stop Launcher

echo ========================================================
echo             FURUKAWA LMS - STOP SERVICES
echo ========================================================
echo.

set "PROJECT_DIR=%~dp0"
if not exist "%PROJECT_DIR%ecosystem.config.js" (
    if exist "C:\Users\%USERNAME%\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\ecosystem.config.js" (
        set "PROJECT_DIR=C:\Users\%USERNAME%\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\"
    ) else if exist "C:\Users\testuser2\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\ecosystem.config.js" (
        set "PROJECT_DIR=C:\Users\testuser2\Desktop\FMESoftware\New\Furukawa-LMS-main\Furukawa-LMS\Furukawa-LMS-main\"
    ) else if exist "D:\10Sight Agency\Sarvagaya Institute\FME\Furukawa-LMS\Furukawa-LMS\Furukawa-LMS-main\ecosystem.config.js" (
        set "PROJECT_DIR=D:\10Sight Agency\Sarvagaya Institute\FME\Furukawa-LMS\Furukawa-LMS\Furukawa-LMS-main\"
    )
)
cd /d "%PROJECT_DIR%"

where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set "PM2_CMD=npx pm2"
) else (
    set "PM2_CMD=pm2"
)

echo [INFO] Stopping lms-backend and lms-frontend...
call %PM2_CMD% stop lms-backend lms-frontend
call %PM2_CMD% save >nul 2>&1

echo.
call %PM2_CMD% list

echo.
echo [INFO] All LMS services stopped successfully.
echo Window closing in 4 seconds...
timeout /t 4 >nul
exit /b 0
