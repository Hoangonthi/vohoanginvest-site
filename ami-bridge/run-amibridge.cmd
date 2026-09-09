@echo off
setlocal
cd /d "%~dp0"
title VO HOANG - AmiBridge

if not exist "%~dp0start-bridge.ps1" (
  echo Khong tim thay start-bridge.ps1. Dang tai ban moi tu GitHub...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Hoangonthi/vohoanginvest-site/main/ami-bridge/start-bridge.ps1' -OutFile '%~dp0start-bridge.ps1' } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
  if errorlevel 1 (
    echo.
    echo Khong tai duoc start-bridge.ps1. Vui long tai lai thu muc ami-bridge tu repo chinh.
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"
echo.
echo AmiBridge da dung. Nhan phim bat ky de dong cua so.
pause >nul
