@echo off
cd /d %~dp0
where python >nul 2>nul
if %errorlevel% neq 0 (
  echo Python no esta instalado o no esta en PATH.
  echo Abre index.html manualmente.
  pause
  exit /b
)
start http://localhost:8000
python -m http.server 8000
pause
