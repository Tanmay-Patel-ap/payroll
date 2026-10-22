#include "models/Employee.hpp"

Employee::Employee() : m_baseSalary(0.0) {}

Employee::Employee(const std::string& id, const std::string& name, const std::string& designation, double baseSalary)
    : m_id(id), m_name(name), m_designation(designation), m_baseSalary(baseSalary) {}

std::string Employee::getId() const { return m_id; }
std::string Employee::getName() const { return m_name; }
std::string Employee::getDesignation() const { return m_designation; }
double Employee::getBaseSalary() const { return m_baseSalary; }

void Employee::setId(const std::string& id) { m_id = id; }
void Employee::setName(const std::string& name) { m_name = name; }
void Employee::setDesignation(const std::string& designation) { m_designation = designation; }
void Employee::setBaseSalary(double baseSalary) { m_baseSalary = baseSalary; }

json Employee::toJson() const {
    return json{
        {"id", m_id},
        {"name", m_name},
        {"designation", m_designation},
        {"baseSalary", m_baseSalary}
    };
}

Employee Employee::fromJson(const json& j) {
    Employee emp;
    if (j.contains("id") && !j["id"].is_null()) emp.setId(j["id"].get<std::string>());
    if (j.contains("name") && !j["name"].is_null()) emp.setName(j["name"].get<std::string>());
    if (j.contains("designation") && !j["designation"].is_null()) emp.setDesignation(j["designation"].get<std::string>());
    if (j.contains("baseSalary") && !j["baseSalary"].is_null()) {
        if (j["baseSalary"].is_number()) {
            emp.setBaseSalary(j["baseSalary"].get<double>());
        } else if (j["baseSalary"].is_string()) {
            emp.setBaseSalary(std::stod(j["baseSalary"].get<std::string>()));
        }
    }
    return emp;
}
