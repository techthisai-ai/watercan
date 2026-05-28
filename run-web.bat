@echo off
setlocal
set "HOME=%USERPROFILE%"
set "EXPO_HOME=%~dp0.expo"
set "XDG_CACHE_HOME=%~dp0.cache"
set "TEMP=%~dp0tmp"
set "TMP=%~dp0tmp"
set "BROWSER=none"
set "CI=false"
cd /d %~dp0
if not exist "%TEMP%" mkdir "%TEMP%"
npm run web:clear
