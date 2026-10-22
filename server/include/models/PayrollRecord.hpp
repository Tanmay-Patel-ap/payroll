#pragma once

#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class PayrollRecord {
public:
    PayrollRecord();

    // Getters
    std::string getId() const;
    std::string getMonth() const;
    std::string getEmployeeId() const;
    std::string getEmployeeName() const;
    std::string getDesignation() const;
    double getBaseSalary() const;
    double getPresentDays() const;
    double getCasualLeaveDays() const;
    double getAbsentDays() const;
    double getTotalDays() const;
    double getPaidDays() const;
    double getDailyRate() const;
    double getLossOfPay() const;
    double getNetSalary() const;

    // Setters
    void setId(const std::string& id);
    void setMonth(const std::string& month);
    void setEmployeeId(const std::string& employeeId);
    void setEmployeeName(const std::string& employeeName);
    void setDesignation(const std::string& designation);
    void setBaseSalary(double baseSalary);
    void setPresentDays(double presentDays);
    void setCasualLeaveDays(double casualLeaveDays);
    void setAbsentDays(double absentDays);
    void setTotalDays(double totalDays);
    void setPaidDays(double paidDays);
    void setDailyRate(double dailyRate);
    void setLossOfPay(double lossOfPay);
    void setNetSalary(double netSalary);

    // Serialization
    json toJson() const;
    static PayrollRecord fromJson(const json& j);

private:
    std::string m_id;
    std::string m_month;
    std::string m_employeeId;
    std::string m_employeeName;
    std::string m_designation;
    double m_baseSalary;
    double m_presentDays;
    double m_casualLeaveDays;
    double m_absentDays;
    double m_totalDays;
    double m_paidDays;
    double m_dailyRate;
    double m_lossOfPay;
    double m_netSalary;
};
