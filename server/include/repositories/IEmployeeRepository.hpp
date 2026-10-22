#pragma once

#include <vector>
#include <optional>
#include "models/Employee.hpp"

class IEmployeeRepository {
public:
    virtual ~IEmployeeRepository() = default;

    virtual std::vector<Employee> getAll() = 0;
    virtual std::optional<Employee> getById(const std::string& id) = 0;
    virtual bool add(const Employee& employee) = 0;
    virtual bool update(const Employee& employee) = 0;
    virtual bool remove(const std::string& id) = 0;
};

