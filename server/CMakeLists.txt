cmake_minimum_required(VERSION 3.15)
project(PayrollServer CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

file(GLOB_RECURSE SOURCES "src/*.cpp")

add_executable(payroll_server ${SOURCES})

if (WIN32)
    target_link_libraries(payroll_server PRIVATE ws2_32)
endif()
