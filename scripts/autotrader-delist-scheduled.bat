@echo off
REM AutoTrader Delist Check - Windows Scheduled Task launcher
REM Runs 1x/day at 22:00 CET via Task Scheduler.

setlocal
set "ROOT=C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace"
set "LOG=scripts\logs\autotrader-windows.log"

cd /d "%ROOT%"
if not exist scripts\logs mkdir scripts\logs

echo [%date% %time%] AutoTrader delist check starting >> "%LOG%"

set "MONZA_WINDOWS_TASK=1"

call "C:\Program Files\nodejs\npx.cmd" tsx scripts/autotrader-delist-check.ts --delayMs=500 >> "%LOG%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo [%date% %time%] AutoTrader delist check finished exit_code=%EXIT_CODE% >> "%LOG%"
echo. >> "%LOG%"

exit /b %EXIT_CODE%
