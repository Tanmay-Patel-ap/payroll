#pragma once

#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class Role {
public:
    Role();
    Role(const std::string& id, const std::string& name, double salary);

    std::string getId() const;
    std::string getName() const;
    double getSalary() const;

    void setId(const std::string& id);
    void setName(const std::string& name);
    void setSalary(double salary);

    json toJson() const;
    static Role fromJson(const json& j);

private:
    std::string m_id;
    std::string m_name;
    double m_salary;
};

