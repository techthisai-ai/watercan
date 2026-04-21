@echo off
set USERPROFILE=C:\project\waterbottle
set HOME=C:\project\waterbottle
set EXPO_HOME=C:\project\waterbottle\.expo
set XDG_CACHE_HOME=C:\project\waterbottle\.cache
set TEMP=C:\project\waterbottle\tmp
set TMP=C:\project\waterbottle\tmp
set BROWSER=none
cd /d %~dp0
npm run web -- --clear --max-workers 1
