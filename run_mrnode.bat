@echo off
title MRNode Application
color 0b

echo ========================================================
echo                 MRNode Startup
echo ========================================================
echo.
echo 1. Configuring environment...
set "PATH=C:\Program Files\nodejs;%PATH%"

echo 1. Launch with Local Access (localhost:3000)
echo 2. Launch with Internet Access (Shareable link)
echo.
set /p choice="Choose mode (1 or 2): "

if "%choice%"=="2" (
    echo.
    echo 2. Launching Tunnel...
    start "MRNode-Tunnel" cmd /c "node scripts/start-tunnel.js & pause"
    echo    [WAIT] Please wait for the tunnel link to appear in the second window.
    timeout /t 5 >nul
) else (
    echo 2. Setting local auth...
    findstr /c:"NEXTAUTH_URL" .env >nul
    if %errorlevel%==0 (
        powershell -Command "(gc .env) -replace 'NEXTAUTH_URL=.*', 'NEXTAUTH_URL=\"http://localhost:3000\"' | Out-File -encoding utf8 .env"
    ) else (
        echo NEXTAUTH_URL="http://localhost:3000" >> .env
    )
    echo 2. Opening application in browser...
    timeout /t 3 >nul
    start "" "http://localhost:3000"
)

echo 3. Starting server...
echo.
echo    [IMPORTANT] Do not close this window while working.
echo    If the browser shows "Connection Refused", wait a few
echo    seconds and refresh the page.
echo.

call npm run dev
pause
