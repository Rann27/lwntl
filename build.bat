@echo off
chcp 65001 >nul 2>&1
title LWNTL - Portable Build

echo ============================================================
echo   LWNTL - Portable Build Script
echo ============================================================
echo.

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

REM ── Step 1: Build frontend ─────────────────────────────────────────
echo [1/3] Building frontend (React)...
echo.
cd /d "%ROOT%\frontend"
call npm run build
if errorlevel 1 (
    echo.
    echo   ERROR: Frontend build failed. Aborting.
    pause
    exit /b 1
)
echo.
echo   Frontend built successfully.

REM ── Step 2: Run PyInstaller ────────────────────────────────────────
echo.
echo [2/3] Running PyInstaller...
echo.
cd /d "%ROOT%"
"%ROOT%\venv\Scripts\pyinstaller.exe" lwntl.spec --clean --noconfirm
if errorlevel 1 (
    echo.
    echo   ERROR: PyInstaller failed. See output above.
    pause
    exit /b 1
)

REM ── Step 3: Done ──────────────────────────────────────────────────
echo.
echo ============================================================
echo   Build complete!
echo.
echo   Portable folder : dist\LWNTL\
echo   Run directly    : dist\LWNTL\LWNTL.exe
echo.
echo   To distribute   : zip the entire dist\LWNTL\ folder.
echo   Requirements    : Windows 10/11 with Microsoft Edge installed
echo                     (WebView2 runtime, already present on Win 10/11).
echo ============================================================
echo.
pause
