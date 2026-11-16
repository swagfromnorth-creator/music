@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo   VaultStream - Pull Latest From GitHub
echo ============================================
echo.

call :FindGit
if not defined GIT_EXE (
    echo [ERROR] Could not find git.exe on this machine.
    echo Install Git or MinGit first: winget install Git.MinGit
    pause
    exit /b 1
)

echo Using Git: "%GIT_EXE%"
set "GIT_TERMINAL_PROMPT=0"

if not exist ".git" (
    echo [ERROR] No .git directory found in "%CD%".
    pause
    exit /b 1
)

for /f "delims=" %%H in ('"%GIT_EXE%" rev-parse --short HEAD 2^>nul') do set "BEFORE_HASH=%%H"

echo Fetching origin/main...
"%GIT_EXE%" fetch origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to fetch from GitHub. Check your internet connection or GitHub auth.
    pause
    exit /b 1
)

echo Pulling latest changes (fast-forward only)...
"%GIT_EXE%" pull --ff-only origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Pull failed. You may have local uncommitted changes.
    "%GIT_EXE%" status --short
    pause
    exit /b 1
)

for /f "delims=" %%H in ('"%GIT_EXE%" rev-parse --short HEAD 2^>nul') do set "AFTER_HASH=%%H"

if "%BEFORE_HASH%"=="%AFTER_HASH%" (
    echo.
    echo Already up to date at commit %AFTER_HASH%.
    goto :Done
)

echo.
echo Updated: %BEFORE_HASH% -^> %AFTER_HASH%
"%GIT_EXE%" diff --name-only %BEFORE_HASH% %AFTER_HASH% | findstr /I "package.json package-lock.json" >nul
if not errorlevel 1 (
    echo Package files changed - running npm install...
    call npm.cmd install
)

:Done
echo.
echo Done! If VaultStream is currently running, restart it to apply backend updates.
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
if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
    goto :eof
)
if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
    set "GIT_EXE=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    goto :eof
)
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.MinGit*") do (
    if exist "%%~D\cmd\git.exe" (
        set "GIT_EXE=%%~D\cmd\git.exe"
        goto :eof
    )
)
for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Git.Git*") do (
    if exist "%%~D\cmd\git.exe" (
        set "GIT_EXE=%%~D\cmd\git.exe"
        goto :eof
    )
)
goto :eof
