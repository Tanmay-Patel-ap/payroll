#pragma once

#include <string>
#include <iostream>
#include <mutex>

class Logger {
public:
    enum class Level {
        INFO,
        WARNING,
        ERR
    };

    static void log(Level level, const std::string& message);
    static void info(const std::string& message);
    static void warn(const std::string& message);
    static void error(const std::string& message);

private:
    static std::mutex s_mutex;
    static std::string currentTimestamp();
    static std::string levelToString(Level level);
};

