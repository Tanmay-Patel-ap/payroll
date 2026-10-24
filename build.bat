@echo off
echo ======================================================
echo   Compiling Windows Payroll C++ Server...
echo ======================================================

cd /d "%~dp0server"

taskkill /f /im payroll_server.exe 2>nul

echo Compiling source files...
g++ -std=c++17 -Iinclude -c src/main.cpp src/models/*.cpp src/repositories/*.cpp src/services/*.cpp src/utils/*.cpp
g++ -std=c++17 -Iinclude -c src/server.cpp -o server.o

echo Linking payroll_server.exe...
g++ *.o -o payroll_server.exe -lws2_32
del /f /q *.o 2>nul

if exist "payroll_server.exe" (
    echo.
    echo [SUCCESS] server\payroll_server.exe compiled successfully!
) else (
    echo.
    echo [ERROR] Compilation failed. Please check compiler errors above.
)
