@echo off
setlocal
cd /d "%~dp0"
title VO HOANG - AmiBridge + Market Sync

set "PSRUN=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PSRUN%" set "PSRUN=powershell.exe"

echo VO HOANG AmiBridge + Market Sync
echo.
echo Dang tai cac script ban moi nhat...
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -Command "try { $t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); $base='https://raw.githubusercontent.com/Hoangonthi/vohoanginvest-site/main/ami-bridge/'; Invoke-WebRequest -UseBasicParsing -Uri ($base+'start-bridge.ps1?v='+$t) -OutFile '%~dp0start-bridge.ps1'; Invoke-WebRequest -UseBasicParsing -Uri ($base+'push-market.ps1?v='+$t) -OutFile '%~dp0push-market.ps1'; Invoke-WebRequest -UseBasicParsing -Uri ($base+'vndirect-enrich.ps1?v='+$t) -OutFile '%~dp0vndirect-enrich.ps1'; Invoke-WebRequest -UseBasicParsing -Uri ($base+'vndirect-market-probe.py?v='+$t) -OutFile '%~dp0vndirect-market-probe.py'; Invoke-WebRequest -UseBasicParsing -Uri ($base+'vnstock-enrich.ps1?v='+$t) -OutFile '%~dp0vnstock-enrich.ps1'; Invoke-WebRequest -UseBasicParsing -Uri ($base+'vnstock-market-summary.py?v='+$t) -OutFile '%~dp0vnstock-market-summary.py'; Invoke-WebRequest -UseBasicParsing -Uri ($base+'index-extra-enrich.ps1?v='+$t) -OutFile '%~dp0index-extra-enrich.ps1'; } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo Khong tai duoc script tu GitHub.
  pause
  exit /b 1
)

echo.
echo ==== KIEM TRA VNDIRECT REALTIME FEED ====
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; foreach($v in @('3.13','3.12','3.11')){ try { py -$v -c 'import paho.mqtt.client' 2>$null; if($LASTEXITCODE -eq 0){$ok=$true; break} } catch {} }; if(-not $ok){ Write-Host 'Chua co paho-mqtt. Dang cai tren Python 3.13...' -ForegroundColor Cyan; try { py -3.13 -m pip install -U paho-mqtt } catch {} }; exit 0"

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
echo CUA SO NAY SE GIU MARKET SYNC CHAY. KHONG DONG TRONG GIO GIAO DICH.
echo.
"%PSRUN%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-market.ps1"

echo.
echo Market Sync da dung.
pause