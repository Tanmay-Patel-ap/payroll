@echo off
echo ======================================================
echo   Starting Windows Accountant Payroll Server...
echo ======================================================

cd /d "%~dp0"

echo Opening http://localhost:8080 in your browser...
start http://localhost:8080

echo [INFO] Running Direct Excel Payroll Server on port 8080...
python server/app.py 8080

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server terminated or Python was not found.
    echo Please ensure Python is installed and available on your PATH.
    pause
)
