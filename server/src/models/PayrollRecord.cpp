#include "models/PayrollRecord.hpp"

PayrollRecord::PayrollRecord()
    : m_baseSalary(0.0), m_presentDays(0.0), m_casualLeaveDays(0.0),
      m_absentDays(0.0), m_totalDays(0.0), m_paidDays(0.0),
      m_dailyRate(0.0), m_lossOfPay(0.0), m_netSalary(0.0) {}

std::string PayrollRecord::getId() const { return m_id; }
std::string PayrollRecord::getMonth() const { return m_month; }
std::string PayrollRecord::getEmployeeId() const { return m_employeeId; }
std::string PayrollRecord::getEmployeeName() const { return m_employeeName; }
std::string PayrollRecord::getDesignation() const { return m_designation; }
double PayrollRecord::getBaseSalary() const { return m_baseSalary; }
double PayrollRecord::getPresentDays() const { return m_presentDays; }
double PayrollRecord::getCasualLeaveDays() const { return m_casualLeaveDays; }
double PayrollRecord::getAbsentDays() const { return m_absentDays; }
double PayrollRecord::getTotalDays() const { return m_totalDays; }
double PayrollRecord::getPaidDays() const { return m_paidDays; }
double PayrollRecord::getDailyRate() const { return m_dailyRate; }
double PayrollRecord::getLossOfPay() const { return m_lossOfPay; }
double PayrollRecord::getNetSalary() const { return m_netSalary; }

void PayrollRecord::setId(const std::string& id) { m_id = id; }
void PayrollRecord::setMonth(const std::string& month) { m_month = month; }
void PayrollRecord::setEmployeeId(const std::string& employeeId) { m_employeeId = employeeId; }
void PayrollRecord::setEmployeeName(const std::string& employeeName) { m_employeeName = employeeName; }
void PayrollRecord::setDesignation(const std::string& designation) { m_designation = designation; }
void PayrollRecord::setBaseSalary(double baseSalary) { m_baseSalary = baseSalary; }
void PayrollRecord::setPresentDays(double presentDays) { m_presentDays = presentDays; }
void PayrollRecord::setCasualLeaveDays(double casualLeaveDays) { m_casualLeaveDays = casualLeaveDays; }
void PayrollRecord::setAbsentDays(double absentDays) { m_absentDays = absentDays; }
void PayrollRecord::setTotalDays(double totalDays) { m_totalDays = totalDays; }
void PayrollRecord::setPaidDays(double paidDays) { m_paidDays = paidDays; }
void PayrollRecord::setDailyRate(double dailyRate) { m_dailyRate = dailyRate; }
void PayrollRecord::setLossOfPay(double lossOfPay) { m_lossOfPay = lossOfPay; }
void PayrollRecord::setNetSalary(double netSalary) { m_netSalary = netSalary; }

json PayrollRecord::toJson() const {
    return json{
        {"id", m_id},
        {"month", m_month},
        {"employeeId", m_employeeId},
        {"employeeName", m_employeeName},
        {"designation", m_designation},
        {"baseSalary", m_baseSalary},
        {"presentDays", m_presentDays},
        {"casualLeaveDays", m_casualLeaveDays},
        {"absentDays", m_absentDays},
        {"totalDays", m_totalDays},
        {"paidDays", m_paidDays},
        {"dailyRate", m_dailyRate},
        {"lossOfPay", m_lossOfPay},
        {"netSalary", m_netSalary}
    };
}

PayrollRecord PayrollRecord::fromJson(const json& j) {
    PayrollRecord r;
    if (j.contains("id")) r.setId(j["id"].get<std::string>());
    if (j.contains("month")) r.setMonth(j["month"].get<std::string>());
    if (j.contains("employeeId")) r.setEmployeeId(j["employeeId"].get<std::string>());
    if (j.contains("employeeName")) r.setEmployeeName(j["employeeName"].get<std::string>());
    if (j.contains("designation")) r.setDesignation(j["designation"].get<std::string>());
    if (j.contains("baseSalary")) r.setBaseSalary(j["baseSalary"].get<double>());
    if (j.contains("presentDays")) r.setPresentDays(j["presentDays"].get<double>());
    if (j.contains("casualLeaveDays")) r.setCasualLeaveDays(j["casualLeaveDays"].get<double>());
    if (j.contains("absentDays")) r.setAbsentDays(j["absentDays"].get<double>());
    if (j.contains("totalDays")) r.setTotalDays(j["totalDays"].get<double>());
    if (j.contains("paidDays")) r.setPaidDays(j["paidDays"].get<double>());
    if (j.contains("dailyRate")) r.setDailyRate(j["dailyRate"].get<double>());
    if (j.contains("lossOfPay")) r.setLossOfPay(j["lossOfPay"].get<double>());
    if (j.contains("netSalary")) r.setNetSalary(j["netSalary"].get<double>());
    return r;
}
