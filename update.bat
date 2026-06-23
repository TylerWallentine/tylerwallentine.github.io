@echo off
REM ============================================================
REM  One-click website publisher for tylerwallentine.github.io
REM  Double-click this file to push your latest changes live.
REM ============================================================

cd /d "%~dp0"

echo.
echo === Changes to be published ===
git status --short

echo.
set /p MSG="Describe this update (or press Enter for a timestamp): "
if "%MSG%"=="" set MSG=Update site %date% %time%

echo.
echo === Publishing... ===
git add -A
git commit -m "%MSG%"
git push

echo.
echo === Done! Your site will update at https://vaporrain.com in about a minute. ===
echo.
pause
