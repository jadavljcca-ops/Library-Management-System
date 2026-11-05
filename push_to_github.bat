@echo off
title Push Library System to GitHub
echo ===================================================
echo Pushing latest code to GitHub (main branch)...
echo ===================================================
git push origin main
if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo SUCCESS! Code pushed to GitHub successfully.
    echo Render will now automatically deploy the update.
    echo ===================================================
) else (
    echo.
    echo ===================================================
    echo Push failed. Please check your GitHub credentials.
    echo ===================================================
)
echo.
pause
