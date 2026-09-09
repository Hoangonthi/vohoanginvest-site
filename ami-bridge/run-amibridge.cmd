@echo off
setlocal
cd /d "%~dp0"
title VO HOANG - AmiBridge
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"
echo.
echo AmiBridge da dung. Nhan phim bat ky de dong cua so.
pause >nul
