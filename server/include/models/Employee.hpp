#pragma once

#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class Employee {
public:
    Employee();

    // Getters
    std::string getId() const;
    std::string getName() const;
    std::string getDesignation() const;
    double getDailyRate() const;
    double getSalary() const;         // Monthly Salary
    double getMonthlySalary() const;  // Monthly Salary
    double getBaseSalary() const;     // Monthly Salary
    std::string getEmail() const;
    std::string getPhone() const;
    std::string getJoinDate() const;
    std::string getLeaveDate() const;
    std::string getBankName() const;
    std::string getBankAccountNo() const;
    std::string getBankIfscCode() const;
    std::string getPanTaxNo() const;
    bool getIsActive() const;

    // Setters
    void setId(const std::string& id);
    void setName(const std::string& name);
    void setDesignation(const std::string& designation);
    void setDailyRate(double dailyRate);
    void setSalary(double salary);
    void setMonthlySalary(double salary);
    void setEmail(const std::string& email);
    void setPhone(const std::string& phone);
    void setJoinDate(const std::string& joinDate);
    void setLeaveDate(const std::string& leaveDate);
    void setBankName(const std::string& bankName);
    void setBankAccountNo(const std::string& bankAccountNo);
    void setBankIfscCode(const std::string& bankIfscCode);
    void setPanTaxNo(const std::string& panTaxNo);
    void setIsActive(bool isActive);

    // JSON serialization
    json toJson() const;
    static Employee fromJson(const json& j);

private:
    std::string m_id;             // Primary Employee ID
    std::string m_name;           // Full Name
    std::string m_designation;    // Role / Designation
    double m_salary;              // Monthly Salary (₹)
    double m_dailyRate;           // Daily Pay Rate (₹/day)
    std::string m_email;
    std::string m_phone;
    std::string m_joinDate;
    std::string m_leaveDate;
    std::string m_bankName;
    std::string m_bankAccountNo;
    std::string m_bankIfscCode;
    std::string m_panTaxNo;
    bool m_isActive;
};
