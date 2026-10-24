@echo off
echo ======================================================
echo   Starting Windows Accountant Payroll Server...
echo ======================================================

cd /d "%~dp0"

if not exist "server\payroll_server.exe" (
    echo [INFO] server\payroll_server.exe not found. Building now...
    call build.bat
    if not exist "server\payroll_server.exe" (
        echo [ERROR] Build failed! Unable to start server.
        pause
        exit /b 1
    )
)

echo Opening http://localhost:8080 in your browser...
start http://localhost:8080

cd server
payroll_server.exe 8080
pause
