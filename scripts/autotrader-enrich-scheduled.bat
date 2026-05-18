@echo off
REM AutoTrader Enrichment - Windows Scheduled Task launcher
REM Runs 4x/day between 10:00-19:00 CET via Task Scheduler.

setlocal
set "ROOT=C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace"
set "LOG=scripts\logs\autotrader-windows.log"

cd /d "%ROOT%"
if not exist scripts\logs mkdir scripts\logs

echo [%date% %time%] AutoTrader enrichment starting >> "%LOG%"

set "MONZA_WINDOWS_TASK=1"

"C:\Program Files\nodejs\npx.cmd" tsx scripts/autotrader-enrich.ts --limit=500 --delayMs=2000 >> "%LOG%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo [%date% %time%] AutoTrader enrichment finished exit_code=%EXIT_CODE% >> "%LOG%"
echo. >> "%LOG%"

exit /b %EXIT_CODE%
