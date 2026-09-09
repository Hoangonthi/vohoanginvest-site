@echo off
setlocal
cd /d "%~dp0"
title VO HOANG - AmiBridge Launcher

set "PSRUN=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PSRUN%" set "PSRUN=powershell.exe"

echo VO HOANG AmiBridge + Market Sync
echo.
echo Dang tai cac script ban moi nhat...
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -Command "try { $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); Invoke-WebRequest -UseBasicParsing -Uri ('https://raw.githubusercontent.com/Hoangonthi/vohoanginvest-site/main/ami-bridge/start-bridge.ps1?v='+$t) -OutFile '%~dp0start-bridge.ps1'; Invoke-WebRequest -UseBasicParsing -Uri ('https://raw.githubusercontent.com/Hoangonthi/vohoanginvest-site/main/ami-bridge/push-market.ps1?v='+$t) -OutFile '%~dp0push-market.ps1' } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo Khong tai duoc script tu GitHub.
  pause
  exit /b 1
)

echo.
echo ==== BAT AMIBRIDGE ====
start "VO HOANG - AmiBridge" "%PSRUN%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"

ping 127.0.0.1 -n 4 >nul

echo ==== BAT MARKET SYNC ====
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-market.ps1"

echo.
echo Market Sync da dung. Cua so AmiBridge co the van dang mo.
pause
