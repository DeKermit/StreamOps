@echo off
setlocal
title StreamOps Launcher
echo ============================================
echo   StreamOps - Live Streamer Control Center
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js was not found on this computer.
  echo Please install Node.js 22.5 or newer from https://nodejs.org and run this again.
  pause
  exit /b 1
)

echo [OK] Node.js found - version:
node -v
echo.

if not exist "%~dp0backend\node_modules" (
  echo Installing backend dependencies for the first time...
  echo This can take a minute or two - please wait.
  pushd "%~dp0backend"
  call npm install
  popd
  if %errorlevel% neq 0 (
    echo.
    echo Backend dependency installation FAILED. See the error above.
    pause
    exit /b 1
  )
)

if not exist "%~dp0frontend\node_modules" (
  echo Installing frontend dependencies for the first time...
  echo This can take a minute or two - please wait.
  pushd "%~dp0frontend"
  call npm install
  popd
  if %errorlevel% neq 0 (
    echo.
    echo Frontend dependency installation FAILED. See the error above.
    pause
    exit /b 1
  )
)

echo.
echo Starting backend and frontend...
start "StreamOps Backend" cmd /k "cd /d "%~dp0backend" && npm start"
timeout /t 2 /nobreak >nul
start "StreamOps Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5200"

echo.
echo StreamOps is starting in two new windows (Backend + Frontend).
echo This window can stay open or be closed - closing it will NOT stop the servers.
echo Use Stop-StreamOps.bat to shut everything down.
echo.
pause
