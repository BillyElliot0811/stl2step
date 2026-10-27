@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 -c "import sys; assert sys.version_info >= (3, 8)" >nul 2>nul
    if not errorlevel 1 (
        py -3 "%~dp0serve.py"
        if errorlevel 1 pause
        exit /b
    )
)
where python >nul 2>nul
if not errorlevel 1 (
    python -c "import sys; assert sys.version_info >= (3, 8)" >nul 2>nul
    if not errorlevel 1 (
        python "%~dp0serve.py"
        if errorlevel 1 pause
        exit /b
    )
)
echo Python 3.8 or newer was not found.
echo Install Python, then open CHAY-WEB.cmd again.
pause
