@echo off
setlocal
title Create Desktop Shortcut - Furukawa LMS

echo ========================================================
echo       CREATING DESKTOP SHORTCUT FOR FURUKAWA LMS
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "TARGET_BAT=%SCRIPT_DIR%start-lms.bat"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT_PATH=%DESKTOP_DIR%\Furukawa LMS.lnk"

if not exist "%TARGET_BAT%" (
    echo [ERROR] start-lms.bat was not found in: %SCRIPT_DIR%
    pause
    exit /b 1
)

echo Target:    %TARGET_BAT%
echo Shortcut:  %SHORTCUT_PATH%
echo.

:: Use PowerShell to create the .lnk shortcut on the user's Desktop
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ws = New-Object -ComObject WScript.Shell; " ^
    "$s = $ws.CreateShortcut('%SHORTCUT_PATH%'); " ^
    "$s.TargetPath = '%TARGET_BAT%'; " ^
    "$s.WorkingDirectory = '%SCRIPT_DIR%'; " ^
    "$s.Description = 'Start Furukawa LMS PM2 Server and Frontend'; " ^
    "$s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] Shortcut 'Furukawa LMS' created on your Desktop!
    echo You can now simply double-click 'Furukawa LMS' on your desktop anytime.
) else (
    echo [WARNING] Could not create shortcut automatically.
    echo You can right-click 'start-lms.bat' ^> Send to ^> Desktop (create shortcut).
)

echo.
timeout /t 5 >nul
exit /b 0
