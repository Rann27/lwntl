@echo off
chcp 65001 >nul 2>&1
title LWNTL - LN/WN Translator

echo ============================================================
echo   LWNTL - LN/WN Translator
echo ============================================================
echo.

REM Get the directory where this bat file is located
set "ROOT=%~dp0"
REM Remove trailing backslash
set "ROOT=%ROOT:~0,-1%"

echo [1/4] Checking Python virtual environment...
if not exist "%ROOT%\venv\Scripts\python.exe" (
    echo   Creating virtual environment...
    python -m venv "%ROOT%\venv"
    if errorlevel 1 (
        echo   ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo   Virtual environment created.
) else (
    echo   Virtual environment found.
)

echo.
echo [2/4] Installing Python dependencies...
"%ROOT%\venv\Scripts\pip.exe" install -r "%ROOT%\requirements.txt" -q
if errorlevel 1 (
    echo   WARNING: Some dependencies may have failed to install.
)
echo   Dependencies ready.

echo.
echo [3/4] Checking frontend build...
if not exist "%ROOT%\frontend\dist\index.html" (
    echo   Frontend not built. Building now...
    
    REM Check if node_modules exists
    if not exist "%ROOT%\frontend\node_modules" (
        echo   Installing npm packages...
        cd /d "%ROOT%\frontend"
        call npm install
        if errorlevel 1 (
            echo   ERROR: npm install failed.
            pause
            exit /b 1
        )
    )
    
    cd /d "%ROOT%\frontend"
    echo   Running npm build...
    call npm run build
    if errorlevel 1 (
        echo   ERROR: Frontend build failed.
        pause
        exit /b 1
    )
    echo   Frontend built successfully.
) else (
    echo   Frontend build found.
)

echo.
echo [4/4] Starting LWNTL...
echo.
cd /d "%ROOT%"
"%ROOT%\venv\Scripts\python.exe" "%ROOT%\main.py"
if errorlevel 1 (
    echo.
    echo Application exited with an error.
    pause
)