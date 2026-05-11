@echo off
REM AutoTrader Enrichment — Windows Scheduled Task launcher
REM Runs 4x/day between 10:00-19:00 CET via Task Scheduler

cd /d "C:\Users\capos\Documents\Personal\AI\MONZA\monza-Cars-marketplace"

REM Log start
echo [%date% %time%] AutoTrader enrichment starting >> scripts\logs\autotrader-enrich.log

REM Run enrichment (500 listings, 2s delay, 20min budget)
"C:\Program Files\nodejs\npx.cmd" tsx scripts/autotrader-enrich.ts --limit=500 --delayMs=2000 >> scripts\logs\autotrader-enrich.log 2>&1

REM Log end
echo [%date% %time%] AutoTrader enrichment finished >> scripts\logs\autotrader-enrich.log
echo. >> scripts\logs\autotrader-enrich.log
