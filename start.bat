@echo off
setlocal EnableExtensions
title VaultStream - Auto-Updating Lossless Player
cd /d "%~dp0"

set "VAULTSTREAM_SUPERVISED=1"
set "OPENED_BROWSER=0"

:Loop
call :AutoPull
echo Starting VaultStream at http://127.0.0.1:3456 ...
if "%OPENED_BROWSER%"=="0" (
    set "OPENED_BROWSER=1"
    start "" "http://127.0.0.1:3456"
)

node src/server.ts
set "EXIT_CODE=%ERRORLEVEL%"

if "%EXIT_CODE%"=="42" (
    echo.
    echo Applying GitHub update and restarting VaultStream...
    timeout /t 1 /nobreak >nul
    goto :Loop
)

if not "%EXIT_CODE%"=="0" (
    echo.
    echo VaultStream exited with code %EXIT_CODE%.
    pause
)
exit /b %EXIT_CODE%

:AutoPull
set "GIT_EXE="
where git >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%G in ('where git 2^>nul') do (
        set "GIT_EXE=%%G"
        goto :DoPull
    )
)
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.MinGit*") do (
    if exist "%%~D\cmd\git.exe" (
        set "GIT_EXE=%%~D\cmd\git.exe"
        goto :DoPull
    )
)
if exist "C:\Program Files\Git\cmd\git.exe" set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
if exist "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe" set "GIT_EXE=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe"

:DoPull
if not defined GIT_EXE goto :eof
if not exist ".git" goto :eof
set "GIT_TERMINAL_PROMPT=0"
echo Checking GitHub for updates...
for /f "delims=" %%H in ('"%GIT_EXE%" rev-parse --short HEAD 2^>nul') do set "BEFORE_HASH=%%H"
"%GIT_EXE%" pull --rebase --autostash origin main >nul 2>&1
for /f "delims=" %%H in ('"%GIT_EXE%" rev-parse --short HEAD 2^>nul') do set "AFTER_HASH=%%H"
if not "%BEFORE_HASH%"=="%AFTER_HASH%" (
    echo Updated %BEFORE_HASH% -^> %AFTER_HASH%
    "%GIT_EXE%" diff --name-only %BEFORE_HASH% %AFTER_HASH% | findstr /I "package.json package-lock.json" >nul
    if not errorlevel 1 call npm.cmd install
)
goto :eof
