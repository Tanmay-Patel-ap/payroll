#pragma once

#include <string>

class FileUtils {
public:
    static bool readFile(const std::string& filePath, std::string& outContent);
    static bool writeFile(const std::string& filePath, const std::string& content);
    static bool fileExists(const std::string& filePath);
    static bool ensureDirectoryExists(const std::string& dirPath);
};

