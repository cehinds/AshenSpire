@echo off
REM Spire of the Erdtree — build the standalone, refresh dist\, then serve on
REM localhost and open the game in your browser. Double-click to play.
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is required but was not found on your PATH.
  echo   Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)
node "%~dp0tools\launch.mjs" %*
pause
endlocal
