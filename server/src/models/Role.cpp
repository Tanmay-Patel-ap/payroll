#include "models/Role.hpp"

Role::Role() : m_salary(0.0) {}

Role::Role(const std::string& id, const std::string& name, double salary)
    : m_id(id), m_name(name), m_salary(salary) {}

std::string Role::getId() const { return m_id; }
std::string Role::getName() const { return m_name; }
double Role::getSalary() const { return m_salary; }

void Role::setId(const std::string& id) { m_id = id; }
void Role::setName(const std::string& name) { m_name = name; }
void Role::setSalary(double salary) { m_salary = salary; }

json Role::toJson() const {
    return json{
        {"id", m_id},
        {"name", m_name},
        {"salary", m_salary}
    };
}

Role Role::fromJson(const json& j) {
    Role r;
    if (j.contains("id")) r.setId(j["id"].get<std::string>());
    if (j.contains("name")) r.setName(j["name"].get<std::string>());
    if (j.contains("salary")) r.setSalary(j["salary"].get<double>());
    return r;
}

