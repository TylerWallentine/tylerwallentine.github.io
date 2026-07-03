@echo off
REM ============================================================
REM  Local preview for the v2 revamp (does NOT touch the live site)
REM  Starts a local web server and opens the homepage.
REM ============================================================
cd /d "%~dp0"
echo Starting local preview at http://localhost:8000/
echo Press Ctrl+C in this window to stop the server.
start "" "http://localhost:8000/"
python preview-server.py 8000
