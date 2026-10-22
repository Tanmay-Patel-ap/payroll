#pragma once

#include "repositories/IEmployeeRepository.hpp"
#include <mutex>
#include <string>

class JsonEmployeeRepository : public IEmployeeRepository {
public:
    explicit JsonEmployeeRepository(const std::string& filePath = "data/employees.json");

    std::vector<Employee> getAll() override;
    std::optional<Employee> getById(const std::string& id) override;
    bool add(const Employee& employee) override;
    bool update(const Employee& employee) override;
    bool remove(const std::string& id) override;

private:
    std::string m_filePath;
    std::mutex m_mutex;

    void loadFromFile(std::vector<Employee>& list);
    void saveToFile(const std::vector<Employee>& list);
    void seedSampleDataIfEmpty();
};

