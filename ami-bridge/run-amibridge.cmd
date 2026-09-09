@echo off
setlocal
cd /d "%~dp0"
title VO HOANG - AmiBridge

set "PS32=%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
set "PS64=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "PSRUN=%PS32%"
if not exist "%PSRUN%" set "PSRUN=%PS64%"
if not exist "%PSRUN%" set "PSRUN=powershell.exe"

echo Dang dung PowerShell: %PSRUN%
echo.

if not exist "%~dp0start-bridge.ps1" (
  echo Khong tim thay start-bridge.ps1. Dang tai ban moi tu GitHub...
  "%PSRUN%" -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Hoangonthi/vohoanginvest-site/main/ami-bridge/start-bridge.ps1' -OutFile '%~dp0start-bridge.ps1' } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
  if errorlevel 1 (
    echo.
    echo Khong tai duoc start-bridge.ps1. Vui long tai lai thu muc ami-bridge tu repo chinh.
    pause
    exit /b 1
  )
)

"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"
echo.
echo AmiBridge da dung. Nhan phim bat ky de dong cua so.
pause >nul
