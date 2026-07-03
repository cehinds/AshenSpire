@echo off
chcp 65001 >nul
REM ===========================================================================
REM  run.bat - build, test, and run EldenSpire from the repo root.
REM
REM  Usage:   run.bat [port]        (default port 8000)
REM  Steps:   1) build - validate the content bundle (tools\build.mjs)
REM           2) test  - headless engine suite       (tests\run-node.mjs)
REM           3) run   - serve the game + open the browser (tools\serve.mjs)
REM
REM  Only Node.js (18+) is required - no npm install, no build toolchain.
REM  Set NO_OPEN=1 to serve without launching a browser (headless / CI-ish).
REM ===========================================================================
setlocal
cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8000"

echo ============================================
echo   EldenSpire  -  build / test / run
echo ============================================

REM --- prerequisite: Node.js on PATH ---
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found on PATH. Install Node 18+ from https://nodejs.org
  pause
  exit /b 1
)

REM --- 1/3  build: validate all content ---
echo.
echo [1/3] Build: validating content bundle...
call node tools\build.mjs
if errorlevel 1 (
  echo.
  echo *** BUILD FAILED - aborting. ***
  pause
  exit /b 1
)

REM --- 2/3  test: headless engine suite ---
echo.
echo [2/3] Test: running headless engine suite...
call node tests\run-node.mjs
if errorlevel 1 (
  echo.
  echo *** TESTS FAILED - aborting. ***
  pause
  exit /b 1
)

REM --- 3/3  run: serve + open browser ---
echo.
echo [3/3] Run: serving http://localhost:%PORT%/  (Ctrl+C to stop)
if defined NO_OPEN (
  echo       NO_OPEN set - not launching a browser.
) else (
  REM open the default browser after a short delay so the server is listening
  start "EldenSpire browser" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%/"
)
call node tools\serve.mjs %PORT%

endlocal
