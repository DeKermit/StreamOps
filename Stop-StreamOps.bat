@echo off
echo Stopping StreamOps (backend on port 4200, frontend on port 5200)...

for /f "tokens=5" %%p in ('netstat -aon ^| findstr :4200 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>nul
)
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :5200 ^| findstr LISTENING') do (
  taskkill /F /PID %%p >nul 2>nul
)

echo Done. You can close any remaining StreamOps windows manually.
pause
