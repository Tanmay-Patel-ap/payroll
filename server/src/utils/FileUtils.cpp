#include "utils/FileUtils.hpp"
#include <fstream>
#include <sstream>
#include <filesystem>

namespace fs = std::filesystem;

bool FileUtils::readFile(const std::string& filePath, std::string& outContent) {
    std::ifstream file(filePath, std::ios::in | std::ios::binary);
    if (!file.is_open()) {
        return false;
    }
    std::ostringstream ss;
    ss << file.rdbuf();
    outContent = ss.str();
    return true;
}

bool FileUtils::writeFile(const std::string& filePath, const std::string& content) {
    fs::path p(filePath);
    if (p.has_parent_path()) {
        fs::create_directories(p.parent_path());
    }
    std::ofstream file(filePath, std::ios::out | std::ios::trunc | std::ios::binary);
    if (!file.is_open()) {
        return false;
    }
    file << content;
    return true;
}

bool FileUtils::fileExists(const std::string& filePath) {
    return fs::exists(filePath);
}

bool FileUtils::ensureDirectoryExists(const std::string& dirPath) {
    try {
        if (!fs::exists(dirPath)) {
            return fs::create_directories(dirPath);
        }
        return true;
    } catch (...) {
        return false;
    }
}

