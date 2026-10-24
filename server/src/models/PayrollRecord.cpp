#include "models/PayrollRecord.hpp"

PayrollRecord::PayrollRecord()
    : m_totalDays(30.0), m_presentDays(0.0), m_casualLeaveDays(0.0), m_sundays(4.0), m_absentDays(0.0), m_paidDays(0.0),
      m_monthlySalary(0.0), m_dailyRate(0.0), m_earnedSalary(0.0), m_overtimeAmount(0.0), m_bonusAmount(0.0), m_grossSalary(0.0),
      m_lossOfPay(0.0), m_advanceDeducted(0.0), m_totalDeductions(0.0), m_netSalary(0.0) {}

std::string PayrollRecord::getId() const { return m_id; }
std::string PayrollRecord::getMonth() const { return m_month; }
std::string PayrollRecord::getEmployeeId() const { return m_employeeId; }
std::string PayrollRecord::getEmployeeName() const { return m_employeeName; }
std::string PayrollRecord::getDesignation() const { return m_designation; }
std::string PayrollRecord::getBankName() const { return m_bankName; }
std::string PayrollRecord::getBankAccountNo() const { return m_bankAccountNo; }
std::string PayrollRecord::getBankIfscCode() const { return m_bankIfscCode; }
std::string PayrollRecord::getPanTaxNo() const { return m_panTaxNo; }

double PayrollRecord::getTotalDays() const { return m_totalDays; }
double PayrollRecord::getPresentDays() const { return m_presentDays; }
double PayrollRecord::getCasualLeaveDays() const { return m_casualLeaveDays; }
double PayrollRecord::getSundays() const { return m_sundays; }
double PayrollRecord::getAbsentDays() const { return m_absentDays; }
double PayrollRecord::getPaidDays() const { return m_paidDays; }

double PayrollRecord::getMonthlySalary() const { return m_monthlySalary; }
double PayrollRecord::getDailyRate() const { return m_dailyRate; }
double PayrollRecord::getEarnedSalary() const { return m_earnedSalary; }
double PayrollRecord::getOvertimeAmount() const { return m_overtimeAmount; }
double PayrollRecord::getBonusAmount() const { return m_bonusAmount; }
double PayrollRecord::getGrossSalary() const { return m_grossSalary; }

double PayrollRecord::getLossOfPay() const { return m_lossOfPay; }
double PayrollRecord::getAdvanceDeducted() const { return m_advanceDeducted; }
double PayrollRecord::getTotalDeductions() const { return m_totalDeductions; }
double PayrollRecord::getNetSalary() const { return m_netSalary; }
std::string PayrollRecord::getRemarks() const { return m_remarks; }

void PayrollRecord::setId(const std::string& id) { m_id = id; }
void PayrollRecord::setMonth(const std::string& month) { m_month = month; }
void PayrollRecord::setEmployeeId(const std::string& employeeId) { m_employeeId = employeeId; }
void PayrollRecord::setEmployeeName(const std::string& employeeName) { m_employeeName = employeeName; }
void PayrollRecord::setDesignation(const std::string& designation) { m_designation = designation; }
void PayrollRecord::setBankName(const std::string& bankName) { m_bankName = bankName; }
void PayrollRecord::setBankAccountNo(const std::string& bankAccountNo) { m_bankAccountNo = bankAccountNo; }
void PayrollRecord::setBankIfscCode(const std::string& bankIfscCode) { m_bankIfscCode = bankIfscCode; }
void PayrollRecord::setPanTaxNo(const std::string& panTaxNo) { m_panTaxNo = panTaxNo; }

void PayrollRecord::setTotalDays(double totalDays) { m_totalDays = totalDays; }
void PayrollRecord::setPresentDays(double presentDays) { m_presentDays = presentDays; }
void PayrollRecord::setCasualLeaveDays(double casualLeaveDays) { m_casualLeaveDays = casualLeaveDays; }
void PayrollRecord::setSundays(double sundays) { m_sundays = sundays; }
void PayrollRecord::setAbsentDays(double absentDays) { m_absentDays = absentDays; }
void PayrollRecord::setPaidDays(double paidDays) { m_paidDays = paidDays; }

void PayrollRecord::setMonthlySalary(double monthlySalary) { m_monthlySalary = monthlySalary; }
void PayrollRecord::setDailyRate(double dailyRate) { m_dailyRate = dailyRate; }
void PayrollRecord::setEarnedSalary(double earnedSalary) { m_earnedSalary = earnedSalary; }
void PayrollRecord::setOvertimeAmount(double overtimeAmount) { m_overtimeAmount = overtimeAmount; }
void PayrollRecord::setBonusAmount(double bonusAmount) { m_bonusAmount = bonusAmount; }
void PayrollRecord::setGrossSalary(double grossSalary) { m_grossSalary = grossSalary; }

void PayrollRecord::setLossOfPay(double lossOfPay) { m_lossOfPay = lossOfPay; }
void PayrollRecord::setAdvanceDeducted(double advanceDeducted) { m_advanceDeducted = advanceDeducted; }
void PayrollRecord::setTotalDeductions(double totalDeductions) { m_totalDeductions = totalDeductions; }
void PayrollRecord::setNetSalary(double netSalary) { m_netSalary = netSalary; }
void PayrollRecord::setRemarks(const std::string& remarks) { m_remarks = remarks; }

json PayrollRecord::toJson() const {
    return json{
        {"id", m_id},
        {"month", m_month},
        {"employeeId", m_employeeId},
        {"employeeName", m_employeeName},
        {"designation", m_designation},
        {"bankName", m_bankName},
        {"bankAccountNo", m_bankAccountNo},
        {"bankIfscCode", m_bankIfscCode},
        {"panTaxNo", m_panTaxNo},
        {"totalDays", m_totalDays},
        {"presentDays", m_presentDays},
        {"casualLeaveDays", m_casualLeaveDays},
        {"sundays", m_sundays},
        {"absentDays", m_absentDays},
        {"paidDays", m_paidDays},
        {"monthlySalary", m_monthlySalary},
        {"dailyRate", m_dailyRate},
        {"earnedSalary", m_earnedSalary},
        {"overtimeAmount", m_overtimeAmount},
        {"bonusAmount", m_bonusAmount},
        {"grossSalary", m_grossSalary},
        {"lossOfPay", m_lossOfPay},
        {"advanceDeducted", m_advanceDeducted},
        {"totalDeductions", m_totalDeductions},
        {"netSalary", m_netSalary},
        {"remarks", m_remarks}
    };
}

PayrollRecord PayrollRecord::fromJson(const json& j) {
    PayrollRecord r;
    if (j.contains("id")) r.setId(j["id"].get<std::string>());
    if (j.contains("month")) r.setMonth(j["month"].get<std::string>());
    if (j.contains("employeeId")) r.setEmployeeId(j["employeeId"].get<std::string>());
    if (j.contains("employeeName")) r.setEmployeeName(j["employeeName"].get<std::string>());
    if (j.contains("designation")) r.setDesignation(j["designation"].get<std::string>());
    if (j.contains("bankName")) r.setBankName(j["bankName"].get<std::string>());
    if (j.contains("bankAccountNo")) r.setBankAccountNo(j["bankAccountNo"].get<std::string>());
    if (j.contains("bankIfscCode")) r.setBankIfscCode(j["bankIfscCode"].get<std::string>());
    if (j.contains("panTaxNo")) r.setPanTaxNo(j["panTaxNo"].get<std::string>());

    r.setTotalDays(j.value("totalDays", 30.0));
    r.setPresentDays(j.value("presentDays", 0.0));
    r.setCasualLeaveDays(j.value("casualLeaveDays", 0.0));
    r.setSundays(j.value("sundays", 4.0));
    r.setAbsentDays(j.value("absentDays", 0.0));
    r.setPaidDays(j.value("paidDays", 0.0));

    double mSal = j.value("monthlySalary", 0.0);
    if (mSal == 0.0 && j.contains("baseSalary")) mSal = j.value("baseSalary", 0.0);
    r.setMonthlySalary(mSal);

    double dailyRate = j.value("dailyRate", 0.0);
    if (dailyRate == 0.0 && j.contains("baseSalary")) {
        dailyRate = j.value("baseSalary", 0.0) / (r.getTotalDays() > 0 ? r.getTotalDays() : 30.0);
    }
    r.setDailyRate(dailyRate);

    double earned = j.value("earnedSalary", 0.0);
    if (earned == 0.0 && (r.getPaidDays() > 0 && dailyRate > 0)) {
        earned = r.getPaidDays() * dailyRate;
    }
    r.setEarnedSalary(earned);

    r.setOvertimeAmount(j.value("overtimeAmount", 0.0));
    r.setBonusAmount(j.value("bonusAmount", 0.0));
    r.setGrossSalary(j.value("grossSalary", 0.0));

    r.setLossOfPay(j.value("lossOfPay", 0.0));
    r.setAdvanceDeducted(j.value("advanceDeducted", 0.0));
    r.setTotalDeductions(j.value("totalDeductions", 0.0));
    r.setNetSalary(j.value("netSalary", 0.0));
    r.setRemarks(j.value("remarks", ""));

    return r;
}
