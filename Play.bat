@echo off
title Aiden's Coin Game
cd /d "%~dp0"

echo.
echo   ======================================
echo      Starting Aiden's Coin Game...
echo   ======================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   Node.js is not installed.
  echo   Download it from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   First run - installing what the game needs. This takes a minute...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

REM Open the game in the default browser once the server has had a moment to boot.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

echo   The game is opening in your browser.
echo.
echo   To play on a tablet or phone on the same Wi-Fi, use this address:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=1" %%b in ("%%a") do echo        http://%%b:3000
)
echo.
echo   Close this window when you are done playing.
echo.

node server.js
pause
