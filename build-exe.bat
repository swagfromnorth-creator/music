@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "CSC_EXE=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC_EXE%" set "CSC_EXE=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC_EXE%" (
    echo [ERROR] .NET Framework csc.exe compiler not found.
    exit /b 1
)

if not exist "desktop\vaultstream.ico" (
    node desktop/generate-icon.ts
)

echo Building VaultStream.exe...
"%CSC_EXE%" /nologo /target:winexe /optimize+ /win32icon:desktop\vaultstream.ico /out:VaultStream.exe /r:System.Windows.Forms.dll /r:System.Drawing.dll desktop\VaultStream.cs

if errorlevel 1 (
    echo [ERROR] Build failed.
    exit /b 1
)

echo Built VaultStream.exe successfully!
exit /b 0
