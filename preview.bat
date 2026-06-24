@echo off
REM ============================================================
REM  Local preview for the v2 revamp (does NOT touch the live site)
REM  Starts a local web server and opens the homepage.
REM ============================================================
cd /d "%~dp0"
echo Starting local preview at http://localhost:8000/h-main.html
echo Press Ctrl+C in this window to stop the server.
start "" "http://localhost:8000/h-main.html"
python -m http.server 8000
