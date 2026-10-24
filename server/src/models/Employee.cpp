#include "models/Employee.hpp"

Employee::Employee()
    : m_salary(0.0),
      m_dailyRate(0.0),
      m_joinDate("2024-04-01"),
      m_leaveDate(""),
      m_isActive(true) {}

std::string Employee::getId() const { return m_id; }
std::string Employee::getName() const { return m_name; }
std::string Employee::getDesignation() const { return m_designation; }
double Employee::getDailyRate() const {
    if (m_dailyRate > 0.0) return m_dailyRate;
    return (m_salary > 0.0) ? (m_salary / 30.0) : 0.0;
}
double Employee::getSalary() const {
    if (m_salary > 0.0) return m_salary;
    return (m_dailyRate > 0.0) ? (m_dailyRate * 30.0) : 0.0;
}
double Employee::getMonthlySalary() const { return getSalary(); }
double Employee::getBaseSalary() const { return getSalary(); }
std::string Employee::getEmail() const { return m_email; }
std::string Employee::getPhone() const { return m_phone; }
std::string Employee::getJoinDate() const { return m_joinDate; }
std::string Employee::getLeaveDate() const { return m_leaveDate; }
std::string Employee::getBankName() const { return m_bankName; }
std::string Employee::getBankAccountNo() const { return m_bankAccountNo; }
std::string Employee::getBankIfscCode() const { return m_bankIfscCode; }
std::string Employee::getPanTaxNo() const { return m_panTaxNo; }
bool Employee::getIsActive() const { return m_isActive; }

void Employee::setId(const std::string& id) { m_id = id; }
void Employee::setName(const std::string& name) { m_name = name; }
void Employee::setDesignation(const std::string& designation) { m_designation = designation; }
void Employee::setDailyRate(double dailyRate) {
    m_dailyRate = dailyRate;
    if (m_salary <= 0.0 && dailyRate > 0.0) {
        m_salary = dailyRate * 30.0;
    }
}
void Employee::setSalary(double salary) {
    m_salary = salary;
    if (salary > 0.0) {
        m_dailyRate = salary / 30.0;
    }
}
void Employee::setMonthlySalary(double salary) { setSalary(salary); }
void Employee::setEmail(const std::string& email) { m_email = email; }
void Employee::setPhone(const std::string& phone) { m_phone = phone; }
void Employee::setJoinDate(const std::string& joinDate) { m_joinDate = joinDate; }
void Employee::setLeaveDate(const std::string& leaveDate) { m_leaveDate = leaveDate; }
void Employee::setBankName(const std::string& bankName) { m_bankName = bankName; }
void Employee::setBankAccountNo(const std::string& bankAccountNo) { m_bankAccountNo = bankAccountNo; }
void Employee::setBankIfscCode(const std::string& bankIfscCode) { m_bankIfscCode = bankIfscCode; }
void Employee::setPanTaxNo(const std::string& panTaxNo) { m_panTaxNo = panTaxNo; }
void Employee::setIsActive(bool isActive) { m_isActive = isActive; }

json Employee::toJson() const {
    double sal = getSalary();
    double daily = getDailyRate();
    return json{
        {"id", m_id},
        {"name", m_name},
        {"designation", m_designation},
        {"salary", sal},
        {"monthlySalary", sal},
        {"baseSalary", sal},
        {"dailyRate", daily},
        {"email", m_email},
        {"phone", m_phone},
        {"joinDate", m_joinDate},
        {"leaveDate", m_leaveDate},
        {"bankName", m_bankName},
        {"bankAccountNo", m_bankAccountNo},
        {"bankIfscCode", m_bankIfscCode},
        {"panTaxNo", m_panTaxNo},
        {"isActive", m_isActive}
    };
}

Employee Employee::fromJson(const json& j) {
    Employee emp;
    if (j.contains("id")) emp.setId(j["id"].get<std::string>());
    if (j.contains("name")) emp.setName(j["name"].get<std::string>());
    if (j.contains("designation")) emp.setDesignation(j["designation"].get<std::string>());
    if (j.contains("email")) emp.setEmail(j["email"].get<std::string>());
    if (j.contains("phone")) emp.setPhone(j["phone"].get<std::string>());
    if (j.contains("joinDate")) emp.setJoinDate(j["joinDate"].get<std::string>());
    if (j.contains("leaveDate")) emp.setLeaveDate(j["leaveDate"].get<std::string>());
    if (j.contains("bankName")) emp.setBankName(j["bankName"].get<std::string>());
    if (j.contains("bankAccountNo")) emp.setBankAccountNo(j["bankAccountNo"].get<std::string>());
    if (j.contains("bankIfscCode")) emp.setBankIfscCode(j["bankIfscCode"].get<std::string>());
    if (j.contains("panTaxNo")) emp.setPanTaxNo(j["panTaxNo"].get<std::string>());

    double salary = 0.0;
    if (j.contains("salary")) {
        salary = j.value("salary", 0.0);
    } else if (j.contains("monthlySalary")) {
        salary = j.value("monthlySalary", 0.0);
    } else if (j.contains("baseSalary")) {
        salary = j.value("baseSalary", 0.0);
    }

    double daily = j.value("dailyRate", 0.0);
    if (salary > 0.0) {
        emp.setSalary(salary);
        if (daily > 0.0) emp.setDailyRate(daily);
    } else if (daily > 0.0) {
        emp.setDailyRate(daily);
        emp.setSalary(daily * 30.0);
    }

    emp.setIsActive(j.value("isActive", true));

    return emp;
}
