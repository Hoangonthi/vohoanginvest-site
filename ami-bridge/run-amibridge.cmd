@echo off
setlocal
cd /d "%~dp0"
title VO HOANG - AmiBridge

set "PSRUN=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PSRUN%" set "PSRUN=powershell.exe"

echo VO HOANG AmiBridge - MetaStock direct mode
echo.
echo Dang tai start-bridge.ps1 ban moi nhat...
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri ('https://raw.githubusercontent.com/Hoangonthi/vohoanginvest-site/main/ami-bridge/start-bridge.ps1?v=' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -OutFile '%~dp0start-bridge.ps1' } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo.
  echo Khong tai duoc start-bridge.ps1 tu GitHub.
  pause
  exit /b 1
)

echo.
echo ==== BAT DAU AMIBRIDGE ====
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"

echo.
echo AmiBridge da dung. Nhan phim bat ky de dong cua so.
pause >nul
