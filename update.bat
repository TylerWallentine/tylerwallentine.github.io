@echo off
REM ============================================================
REM  One-click website publisher for tylerwallentine.github.io
REM  Double-click this file to push your latest changes live.
REM  GitHub Pages builds from the "main" branch.
REM ============================================================

cd /d "%~dp0"

REM --- Make sure we're on main (Pages publishes from main) ---
for /f "delims=" %%b in ('git branch --show-current') do set BRANCH=%%b
if /I not "%BRANCH%"=="main" (
    echo.
    echo *** WARNING: you are on branch "%BRANCH%", not "main". ***
    echo GitHub Pages publishes from "main", so changes on other branches
    echo will NOT appear on the live site until they reach main.
    echo.
    set /p GOON="Continue pushing branch '%BRANCH%' anyway? (y/N): "
    if /I not "%GOON%"=="y" goto :end
)

echo.
echo === Changes to be published ===
git status --short

echo.
set /p MSG="Describe this update (or press Enter for a timestamp): "
if "%MSG%"=="" set MSG=Update site %date% %time%

echo.
echo === Committing... ===
git add -A
git commit -m "%MSG%"
REM (a "nothing to commit" here is fine - we still try to push existing commits)

echo.
echo === Syncing with GitHub... ===
git pull --rebase origin %BRANCH%
if errorlevel 1 goto :fail

echo.
echo === Publishing... ===
git push -u origin %BRANCH%
if errorlevel 1 goto :fail

echo.
echo === Done! Your site will update at https://vaporrain.com in about a minute. ===
goto :end

:fail
echo.
echo *** PUBLISH FAILED. *** The push or sync did not complete (see messages above).
echo Your changes are committed locally but are NOT live yet.
echo Common causes: not signed in to GitHub, no internet, or a merge conflict.

:end
echo.
pause
