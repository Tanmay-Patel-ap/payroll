#include "utils/Logger.hpp"
#include <chrono>
#include <iomanip>
#include <sstream>

std::mutex Logger::s_mutex;

std::string Logger::currentTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    struct tm buf;
#if defined(_WIN32)
    localtime_s(&buf, &in_time_t);
#else
    localtime_r(&in_time_t, &buf);
#endif
    ss << std::put_time(&buf, "%Y-%m-%d %H:%M:%S");
    return ss.str();
}

std::string Logger::levelToString(Level level) {
    switch (level) {
        case Level::INFO:    return "[INFO]   ";
        case Level::WARNING: return "[WARNING]";
        case Level::ERR:     return "[ERROR]  ";
    }
    return "[LOG]    ";
}

void Logger::log(Level level, const std::string& message) {
    std::lock_guard<std::mutex> lock(s_mutex);
    std::cout << currentTimestamp() << " " << levelToString(level) << " " << message << std::endl;
}

void Logger::info(const std::string& message) {
    log(Level::INFO, message);
}

void Logger::warn(const std::string& message) {
    log(Level::WARNING, message);
}

void Logger::error(const std::string& message) {
    log(Level::ERR, message);
}

