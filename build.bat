@echo off
echo ======================================================
echo   Compiling Windows Payroll C++ Server...
echo ======================================================

cd /d "%~dp0server"

g++ -std=c++17 -Iinclude -O2 src/main.cpp src/server.cpp src/models/*.cpp src/repositories/*.cpp src/services/*.cpp src/utils/*.cpp -o payroll_server.exe -lws2_32

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] server\payroll_server.exe compiled successfully!
) else (
    echo.
    echo [ERROR] Compilation failed. Please check compiler errors above.
)
