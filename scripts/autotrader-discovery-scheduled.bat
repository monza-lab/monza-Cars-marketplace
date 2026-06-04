@echo off
REM AutoTrader Discovery - Windows Scheduled Task launcher
REM Runs daily via Task Scheduler and records the run in scraper_runs.

setlocal
set "ROOT=C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace"
set "LOG=scripts\logs\autotrader-windows.log"

cd /d "%ROOT%"
if not exist scripts\logs mkdir scripts\logs

echo [%date% %time%] AutoTrader discovery starting >> "%LOG%"

set "MONZA_WINDOWS_TASK=1"
set "SCRAPLING_PYTHON=python"

call "C:\Program Files\nodejs\npx.cmd" tsx src/features/scrapers/autotrader_collector/cli.ts --maxPages=20 --fresh >> "%LOG%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo [%date% %time%] AutoTrader discovery finished exit_code=%EXIT_CODE% >> "%LOG%"
echo. >> "%LOG%"

exit /b %EXIT_CODE%
