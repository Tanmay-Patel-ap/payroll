#pragma once

#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class Employee {
public:
    Employee();
    Employee(const std::string& id, const std::string& name, const std::string& designation, double baseSalary);

    // Getters
    std::string getId() const;
    std::string getName() const;
    std::string getDesignation() const;
    double getBaseSalary() const;

    // Setters
    void setId(const std::string& id);
    void setName(const std::string& name);
    void setDesignation(const std::string& designation);
    void setBaseSalary(double baseSalary);

    // JSON serialization
    json toJson() const;
    static Employee fromJson(const json& j);

private:
    std::string m_id;
    std::string m_name;
    std::string m_designation;
    double m_baseSalary;
};
