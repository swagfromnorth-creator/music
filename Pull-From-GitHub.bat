@echo off
setlocal EnableExtensions
title Pull Latest Updates from GitHub (music)
cd /d "%~dp0"

call :FindGit
if not defined GIT_EXE (
    echo [ERROR] Could not find git.exe on this machine.
    echo Install Git via: winget install Git.MinGit
    pause
    exit /b 1
)

echo ============================================================
echo Pulling updates from:
echo   https://github.com/swagfromnorth-creator/music
echo ============================================================
echo.

set "GIT_TERMINAL_PROMPT=0"
set "CURRENT_BRANCH="
for /f "delims=" %%B in ('"%GIT_EXE%" rev-parse --abbrev-ref HEAD 2^>nul') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="main" (
    echo ERROR: This updater is for the main branch. Current branch: "%CURRENT_BRANCH%"
    echo Switch to your main branch before running this script.
    pause
    exit /b 1
)

for /f "delims=" %%H in ('"%GIT_EXE%" rev-parse --short HEAD 2^>nul') do set "BEFORE_HASH=%%H"

"%GIT_EXE%" pull --rebase --autostash origin main
if errorlevel 1 (
    echo.
    echo Update failed. Resolve any Git errors before continuing.
    pause
    exit /b 1
)

for /f "delims=" %%H in ('"%GIT_EXE%" rev-parse --short HEAD 2^>nul') do set "AFTER_HASH=%%H"

if not "%BEFORE_HASH%"=="%AFTER_HASH%" (
    echo Updated: %BEFORE_HASH% -^> %AFTER_HASH%
    "%GIT_EXE%" diff --name-only %BEFORE_HASH% %AFTER_HASH% | findstr /I "package.json package-lock.json" >nul
    if not errorlevel 1 (
        echo Package files changed - running npm install...
        call npm.cmd install
    )
)

echo.
echo Update complete.
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
