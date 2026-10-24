#include "repositories/JsonRoleRepository.hpp"
#include "utils/FileUtils.hpp"
#include "utils/Logger.hpp"
#include <nlohmann/json.hpp>
#include <algorithm>
#include <cctype>

using json = nlohmann::json;

static std::string toUpperTrimStr(const std::string& str) {
    size_t first = str.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t\r\n");
    std::string res = str.substr(first, (last - first + 1));
    for (char& c : res) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return res;
}

JsonRoleRepository::JsonRoleRepository(const std::string& filePath)
    : m_filePath(filePath) {
    seedSampleDataIfEmpty();
}

void JsonRoleRepository::seedSampleDataIfEmpty() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (!FileUtils::fileExists(m_filePath)) {
        std::vector<Role> samples = {
            Role("ROLE001", "HR MANAGER", 20000.0),
            Role("ROLE002", "ACCOUNTANT", 32000.0),
            Role("ROLE003", "EXECUTIVE MANAGER", 20000.0),
            Role("ROLE004", "REPORT WRITER", 20000.0),
            Role("ROLE005", "DATA ENTRY", 17000.0)
        };
        saveToFile(samples);
        Logger::info("Seeded standard roles data into " + m_filePath);
    }
}

void JsonRoleRepository::loadFromFile(std::vector<Role>& list) {
    list.clear();
    std::string content;
    if (!FileUtils::readFile(m_filePath, content)) {
        return;
    }
    try {
        json root = json::parse(content);
        if (root.is_array()) {
            for (const auto& item : root) {
                list.push_back(Role::fromJson(item));
            }
        }
    } catch (const std::exception& e) {
        Logger::error("Failed to parse roles JSON: " + std::string(e.what()));
    }
}

void JsonRoleRepository::saveToFile(const std::vector<Role>& list) {
    json root = json::array();
    for (const auto& r : list) {
        root.push_back(r.toJson());
    }
    FileUtils::writeFile(m_filePath, root.dump(2));
}

std::vector<Role> JsonRoleRepository::getAll() {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Role> list;
    loadFromFile(list);
    return list;
}

std::optional<Role> JsonRoleRepository::getById(const std::string& id) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Role> list;
    loadFromFile(list);
    for (const auto& r : list) {
        if (r.getId() == id) return r;
    }
    return std::nullopt;
}

std::optional<Role> JsonRoleRepository::getByName(const std::string& name) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Role> list;
    loadFromFile(list);
    std::string target = toUpperTrimStr(name);
    for (const auto& r : list) {
        if (toUpperTrimStr(r.getName()) == target) return r;
    }
    return std::nullopt;
}

bool JsonRoleRepository::add(const Role& role) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Role> list;
    loadFromFile(list);

    // Check duplicate by name or id
    std::string targetName = toUpperTrimStr(role.getName());
    for (const auto& r : list) {
        if (r.getId() == role.getId() || toUpperTrimStr(r.getName()) == targetName) {
            return false;
        }
    }

    list.push_back(role);
    saveToFile(list);
    return true;
}

bool JsonRoleRepository::update(const Role& role) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Role> list;
    loadFromFile(list);

    std::string targetName = toUpperTrimStr(role.getName());
    auto it = list.end();
    for (auto i = list.begin(); i != list.end(); ++i) {
        if (i->getId() == role.getId()) {
            it = i;
        } else if (toUpperTrimStr(i->getName()) == targetName) {
            return false; // Name conflict with another role
        }
    }

    if (it == list.end()) return false;

    *it = role;
    saveToFile(list);
    return true;
}

bool JsonRoleRepository::remove(const std::string& id) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Role> list;
    loadFromFile(list);

    auto it = std::remove_if(list.begin(), list.end(), [&](const Role& r) {
        return r.getId() == id;
    });

    if (it == list.end()) return false;

    list.erase(it, list.end());
    saveToFile(list);
    return true;
}

