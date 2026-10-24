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
    std::string getBankName() const;
    std::string getBankAccountNo() const;
    std::string getBankIfscCode() const;
    std::string getPanTaxNo() const;

    double getTotalDays() const;
    double getPresentDays() const;
    double getCasualLeaveDays() const;
    double getSundays() const;
    double getAbsentDays() const;
    double getPaidDays() const;

    double getMonthlySalary() const;
    double getDailyRate() const;
    double getEarnedSalary() const;
    double getOvertimeAmount() const;
    double getBonusAmount() const;
    double getGrossSalary() const;

    double getLossOfPay() const;
    double getAdvanceDeducted() const;
    double getTotalDeductions() const;
    double getNetSalary() const;
    std::string getRemarks() const;

    // Setters
    void setId(const std::string& id);
    void setMonth(const std::string& month);
    void setEmployeeId(const std::string& employeeId);
    void setEmployeeName(const std::string& employeeName);
    void setDesignation(const std::string& designation);
    void setBankName(const std::string& bankName);
    void setBankAccountNo(const std::string& bankAccountNo);
    void setBankIfscCode(const std::string& bankIfscCode);
    void setPanTaxNo(const std::string& panTaxNo);

    void setTotalDays(double totalDays);
    void setPresentDays(double presentDays);
    void setCasualLeaveDays(double casualLeaveDays);
    void setSundays(double sundays);
    void setAbsentDays(double absentDays);
    void setPaidDays(double paidDays);

    void setMonthlySalary(double monthlySalary);
    void setDailyRate(double dailyRate);
    void setEarnedSalary(double earnedSalary);
    void setOvertimeAmount(double overtimeAmount);
    void setBonusAmount(double bonusAmount);
    void setGrossSalary(double grossSalary);

    void setLossOfPay(double lossOfPay);
    void setAdvanceDeducted(double advanceDeducted);
    void setTotalDeductions(double totalDeductions);
    void setNetSalary(double netSalary);
    void setRemarks(const std::string& remarks);

    // Serialization
    json toJson() const;
    static PayrollRecord fromJson(const json& j);

private:
    std::string m_id;
    std::string m_month;
    std::string m_employeeId;
    std::string m_employeeName;
    std::string m_designation;
    std::string m_bankName;
    std::string m_bankAccountNo;
    std::string m_bankIfscCode;
    std::string m_panTaxNo;

    double m_totalDays;
    double m_presentDays;
    double m_casualLeaveDays;
    double m_sundays;
    double m_absentDays;
    double m_paidDays;

    double m_monthlySalary;
    double m_dailyRate;
    double m_earnedSalary;
    double m_overtimeAmount;
    double m_bonusAmount;
    double m_grossSalary;

    double m_lossOfPay;
    double m_advanceDeducted;
    double m_totalDeductions;
    double m_netSalary;
    std::string m_remarks;
};
