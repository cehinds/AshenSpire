@echo off
REM Ashen Spire — build the standalone, refresh dist\, then serve on
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

REM Refresh the family board before launching. PUSH, not pull: a dashboard you
REM have to REMEMBER to open gets opened twice and then never again, and while
REM unopened it is worse than nothing — we would believe your queue was visible
REM to you when it wasn't. So it rides on something already in your hand.
REM Silent, and skipped entirely, if the family folder isn't there.
set "FAMILY=%USERPROFILE%\Documents\claude\family\shared"
if exist "%FAMILY%\tools\build-board.mjs" (
  node "%FAMILY%\tools\build-board.mjs" >nul 2>nul
  start "" "%FAMILY%\BOARD.html"
)

node "%~dp0tools\launch.mjs" %*
pause
endlocal
