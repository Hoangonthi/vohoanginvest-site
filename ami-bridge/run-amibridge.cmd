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

echo Dang cho AmiBridge san sang...
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 30;$i++){ try { $r=Invoke-RestMethod -UseBasicParsing -Uri 'http://127.0.0.1:8765/health' -TimeoutSec 2; if($r.ok){$ok=$true; break} } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){ exit 2 }"
if errorlevel 1 (
  echo AmiBridge khong khoi dong duoc trong 30 giay.
  echo Kiem tra cua so VO HOANG - AmiBridge de xem loi.
  pause
  exit /b 2
)

echo AmiBridge da san sang.
echo ==== BAT MARKET SYNC ====
start "VO HOANG - Market Sync" "%PSRUN%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-market.ps1"

echo.
echo Da khoi dong AmiBridge va Market Sync thanh cong.
echo Co the dong cua so launcher nay; hai cua so dich vu van tiep tuc chay.
timeout /t 3 >nul
exit /b 0
