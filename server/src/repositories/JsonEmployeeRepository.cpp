#include "repositories/JsonEmployeeRepository.hpp"
#include "utils/FileUtils.hpp"
#include "utils/Logger.hpp"
#include <nlohmann/json.hpp>

using json = nlohmann::json;

JsonEmployeeRepository::JsonEmployeeRepository(const std::string& filePath)
    : m_filePath(filePath) {
    seedSampleDataIfEmpty();
}

void JsonEmployeeRepository::seedSampleDataIfEmpty() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (!FileUtils::fileExists(m_filePath)) {
        std::vector<Employee> samples = {
            Employee("EMP001", "John Doe", "Senior Accountant", 65000.0),
            Employee("EMP002", "Sarah Smith", "Finance Manager", 85000.0),
            Employee("EMP003", "David Miller", "Junior Auditor", 42000.0),
            Employee("EMP004", "Emma Watson", "Payroll Specialist", 50000.0)
        };
        saveToFile(samples);
        Logger::info("Seeded initial employee master data into " + m_filePath);
    }
}

void JsonEmployeeRepository::loadFromFile(std::vector<Employee>& list) {
    list.clear();
    std::string content;
    if (!FileUtils::readFile(m_filePath, content)) {
        return;
    }
    try {
        json root = json::parse(content);
        if (root.is_array()) {
            for (const auto& item : root) {
                list.push_back(Employee::fromJson(item));
            }
        }
    } catch (const std::exception& e) {
        Logger::error("Failed to parse employees JSON: " + std::string(e.what()));
    }
}

void JsonEmployeeRepository::saveToFile(const std::vector<Employee>& list) {
    json root = json::array();
    for (const auto& emp : list) {
        root.push_back(emp.toJson());
    }
    FileUtils::writeFile(m_filePath, root.dump(2));
}

std::vector<Employee> JsonEmployeeRepository::getAll() {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Employee> list;
    loadFromFile(list);
    return list;
}

std::optional<Employee> JsonEmployeeRepository::getById(const std::string& id) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Employee> list;
    loadFromFile(list);
    for (const auto& emp : list) {
        if (emp.getId() == id) {
            return emp;
        }
    }
    return std::nullopt;
}

bool JsonEmployeeRepository::add(const Employee& employee) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Employee> list;
    loadFromFile(list);
    for (const auto& emp : list) {
        if (emp.getId() == employee.getId()) {
            return false;
        }
    }
    list.push_back(employee);
    saveToFile(list);
    return true;
}

bool JsonEmployeeRepository::update(const Employee& employee) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Employee> list;
    loadFromFile(list);
    bool found = false;
    for (auto& emp : list) {
        if (emp.getId() == employee.getId()) {
            emp = employee;
            found = true;
            break;
        }
    }
    if (found) {
        saveToFile(list);
    }
    return found;
}

bool JsonEmployeeRepository::remove(const std::string& id) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Employee> list;
    loadFromFile(list);
    size_t beforeSize = list.size();
    std::vector<Employee> updated;
    for (const auto& emp : list) {
        if (emp.getId() != id) {
            updated.push_back(emp);
        }
    }
    if (updated.size() < beforeSize) {
        saveToFile(updated);
        return true;
    }
    return false;
}
