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
echo ==== KIEM TRA AMIBROKER COM ====
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -Command "$reg32 = Test-Path 'Registry::HKEY_CLASSES_ROOT\Broker.Application'; $regWow = Test-Path 'Registry::HKEY_CLASSES_ROOT\WOW6432Node\Broker.Application'; Write-Host ('Broker.Application HKCR: ' + $reg32); Write-Host ('Broker.Application WOW6432Node: ' + $regWow); try { $ab = New-Object -ComObject 'Broker.Application'; Write-Host ('COM TEST: OK - AmiBroker ' + $ab.Version) -ForegroundColor Green; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($ab); exit 0 } catch { Write-Host ('COM TEST: FAIL - ' + $_.Exception.Message) -ForegroundColor Red; exit 2 }"
if errorlevel 2 (
  echo.
  echo AmiBroker COM/OLE chua hoat dong trong Windows.
  echo Khong chay bridge tiep de tranh bao loi lap lai.
  echo.
  echo Neu ca 2 dong Registry o tren la False: can khoi phuc dang ky OLE cua AmiBroker 32-bit.
  echo Neu Registry co True ma COM TEST van FAIL: can kiem tra lai dang ky/installation.
  echo.
  pause
  exit /b 2
)

echo.
echo ==== BAT DAU AMIBRIDGE ====

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
