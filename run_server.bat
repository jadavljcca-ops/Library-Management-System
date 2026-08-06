@echo off
title Library System Server
echo Starting Library System Server...
".node\node-v20.15.0-win-x64\node.exe" backend/server.js
pause
