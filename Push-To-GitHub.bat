@echo off
setlocal EnableExtensions
title Push VaultStream to GitHub (music)
cd /d "%~dp0"

call :FindGit
if not defined GIT_EXE (
    echo [ERROR] Could not find git.exe on this machine.
    echo Install Git via: winget install Git.MinGit
    pause
    exit /b 1
)

echo ============================================================
echo Pushing VaultStream to:
echo   https://github.com/swagfromnorth-creator/music
echo (node_modules, data, and cache are ignored via .gitignore)
echo ============================================================
echo.

set "GIT_TERMINAL_PROMPT=0"

if not exist ".git" (
    echo [First-Time Git Setup] Initializing repository...
    "%GIT_EXE%" init -b main
    "%GIT_EXE%" config user.name "swagfromnorth-creator"
    "%GIT_EXE%" config user.email "swagfromnorth-creator@users.noreply.github.com"
    "%GIT_EXE%" remote add origin https://github.com/swagfromnorth-creator/music.git
) else (
    "%GIT_EXE%" remote set-url origin https://github.com/swagfromnorth-creator/music.git 2>nul || "%GIT_EXE%" remote add origin https://github.com/swagfromnorth-creator/music.git
)

"%GIT_EXE%" branch -M main
"%GIT_EXE%" add -A
"%GIT_EXE%" commit -m "Update VaultStream" 2>nul
"%GIT_EXE%" pull --rebase --autostash origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Rebase pull failed. Resolve conflicts before pushing.
    pause
    exit /b 1
)
"%GIT_EXE%" push -u origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed. Check GitHub auth or network connection.
    pause
    exit /b 1
)

echo.
echo Done! Check https://github.com/swagfromnorth-creator/music
pause
exit /b 0

:FindGit
set "GIT_EXE="
where git >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%G in ('where git 2^>nul') do (
        set "GIT_EXE=%%G"
        goto :eof
    )
)
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.MinGit*") do (
    if exist "%%~D\cmd\git.exe" (
        set "GIT_EXE=%%~D\cmd\git.exe"
        goto :eof
    )
)
if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
    goto :eof
)
if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
    set "GIT_EXE=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    goto :eof
)
if exist "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe" (
    set "GIT_EXE=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe"
    goto :eof
)
goto :eof
