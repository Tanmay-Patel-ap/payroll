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
        std::vector<Employee> samples;

        Employee e1;
        e1.setId("EMP001"); e1.setName("John Doe"); e1.setDesignation("Senior Accountant");
        e1.setDailyRate(2500.0); e1.setJoinDate("2024-04-01");
        e1.setBankName("State Bank of India"); e1.setBankAccountNo("30981245678"); e1.setBankIfscCode("SBIN0001234");
        e1.setPanTaxNo("ABCDE1234F");
        samples.push_back(e1);

        Employee e2;
        e2.setId("EMP002"); e2.setName("Sarah Smith"); e2.setDesignation("Finance Manager");
        e2.setDailyRate(3000.0); e2.setJoinDate("2023-08-15");
        e2.setBankName("HDFC Bank"); e2.setBankAccountNo("50100234567891"); e2.setBankIfscCode("HDFC0000456");
        e2.setPanTaxNo("FGHIJ5678K");
        samples.push_back(e2);

        Employee e3;
        e3.setId("EMP003"); e3.setName("David Miller"); e3.setDesignation("Junior Auditor");
        e3.setDailyRate(1500.0); e3.setJoinDate("2025-01-10");
        e3.setBankName("ICICI Bank"); e3.setBankAccountNo("002301567890"); e3.setBankIfscCode("ICIC0000789");
        e3.setPanTaxNo("LMNOP9012Q");
        samples.push_back(e3);

        Employee e4;
        e4.setId("EMP004"); e4.setName("Emma Watson"); e4.setDesignation("HR Executive");
        e4.setDailyRate(1800.0); e4.setJoinDate("2024-11-01");
        e4.setBankName("Punjab National Bank"); e4.setBankAccountNo("1234002100567890"); e4.setBankIfscCode("PUNB0123400");
        e4.setPanTaxNo("RSTUV3456W");
        samples.push_back(e4);

        Employee e5;
        e5.setId("EMP005"); e5.setName("Robert Brown"); e5.setDesignation("Operations Lead");
        e5.setDailyRate(2200.0); e5.setJoinDate("2023-06-01");
        e5.setBankName("Axis Bank"); e5.setBankAccountNo("918010045678901"); e5.setBankIfscCode("UTIB0000123");
        e5.setPanTaxNo("XYZAB7890C");
        samples.push_back(e5);

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

