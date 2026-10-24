#include "services/PayrollCalculator.hpp"
#include <cmath>
#include <cctype>
#include <string>
#include <algorithm>

double PayrollCalculator::round2(double val) {
    return std::round(val * 100.0) / 100.0;
}

int PayrollCalculator::getDaysInMonth(const std::string& monthStr) {
    if (monthStr.empty()) return 30;

    std::string s = monthStr;
    for (char& c : s) {
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }

    // Extract 4-digit year if present
    int year = 0;
    for (size_t i = 0; i + 3 < s.size(); ++i) {
        if (std::isdigit(static_cast<unsigned char>(s[i])) &&
            std::isdigit(static_cast<unsigned char>(s[i+1])) &&
            std::isdigit(static_cast<unsigned char>(s[i+2])) &&
            std::isdigit(static_cast<unsigned char>(s[i+3]))) {
            try {
                year = std::stoi(s.substr(i, 4));
                break;
            } catch (...) {}
        }
    }
    bool isLeap = (year > 0) && ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0));

    // 31 days: Jan, Mar, May, Jul, Aug, Oct, Dec
    if (s.find("jan") != std::string::npos || s.find("-01") != std::string::npos || s.find("/01") != std::string::npos) return 31;
    if (s.find("mar") != std::string::npos || s.find("-03") != std::string::npos || s.find("/03") != std::string::npos) return 31;
    if (s.find("may") != std::string::npos || s.find("-05") != std::string::npos || s.find("/05") != std::string::npos) return 31;
    if (s.find("jul") != std::string::npos || s.find("-07") != std::string::npos || s.find("/07") != std::string::npos) return 31;
    if (s.find("aug") != std::string::npos || s.find("-08") != std::string::npos || s.find("/08") != std::string::npos) return 31;
    if (s.find("oct") != std::string::npos || s.find("-10") != std::string::npos || s.find("/10") != std::string::npos) return 31;
    if (s.find("dec") != std::string::npos || s.find("-12") != std::string::npos || s.find("/12") != std::string::npos) return 31;

    // 30 days: Apr, Jun, Sep, Nov
    if (s.find("apr") != std::string::npos || s.find("-04") != std::string::npos || s.find("/04") != std::string::npos) return 30;
    if (s.find("jun") != std::string::npos || s.find("-06") != std::string::npos || s.find("/06") != std::string::npos) return 30;
    if (s.find("sep") != std::string::npos || s.find("-09") != std::string::npos || s.find("/09") != std::string::npos) return 30;
    if (s.find("nov") != std::string::npos || s.find("-11") != std::string::npos || s.find("/11") != std::string::npos) return 30;

    // Feb: 28 or 29
    if (s.find("feb") != std::string::npos || s.find("-02") != std::string::npos || s.find("/02") != std::string::npos) {
        return isLeap ? 29 : 28;
    }

    return 30;
}

PayrollRecord PayrollCalculator::compute(
    const Employee& employee,
    const std::string& month,
    double presentDays,
    double casualLeaveDays,
    double absentDays,
    double sundays,
    double overtimeAmount,
    double bonusAmount,
    double advanceDeducted,
    double dailyRateOverride,
    const std::string& remarks
) {
    PayrollRecord rec;
    rec.setId(employee.getId() + "_" + month);
    rec.setMonth(month);
    rec.setEmployeeId(employee.getId());
    rec.setEmployeeName(employee.getName());
    rec.setDesignation(employee.getDesignation());
    rec.setBankName(employee.getBankName());
    rec.setBankAccountNo(employee.getBankAccountNo());
    rec.setBankIfscCode(employee.getBankIfscCode());
    rec.setPanTaxNo(employee.getPanTaxNo());

    // Attendance
    rec.setPresentDays(presentDays);
    rec.setCasualLeaveDays(casualLeaveDays);
    rec.setSundays(sundays);
    rec.setAbsentDays(absentDays);

    int daysInMonth = getDaysInMonth(month);
    rec.setTotalDays(static_cast<double>(daysInMonth));

    double paidDays = presentDays + casualLeaveDays + sundays;
    rec.setPaidDays(paidDays);

    // Dynamic Daily Rate calculation based on days in the month (e.g. 20k/31 for 31 days)
    double monthlySalary = employee.getSalary();
    if (monthlySalary <= 0.0) monthlySalary = employee.getBaseSalary();
    rec.setMonthlySalary(monthlySalary);

    double dailyRate = 0.0;
    if (dailyRateOverride > 0.0) {
        dailyRate = dailyRateOverride;
    } else if (monthlySalary > 0.0 && daysInMonth > 0) {
        dailyRate = monthlySalary / static_cast<double>(daysInMonth);
    } else {
        dailyRate = employee.getDailyRate();
    }
    dailyRate = round2(dailyRate);
    rec.setDailyRate(dailyRate);

    // Earnings: formal (paid day / total) * monthly salary
    double earnedSalary = 0.0;
    if (daysInMonth > 0 && monthlySalary > 0.0) {
        earnedSalary = round2((paidDays / static_cast<double>(daysInMonth)) * monthlySalary);
    } else {
        earnedSalary = round2(paidDays * dailyRate);
    }
    rec.setEarnedSalary(earnedSalary);
    rec.setOvertimeAmount(round2(overtimeAmount));
    rec.setBonusAmount(round2(bonusAmount));

    double grossSalary = round2(earnedSalary + overtimeAmount + bonusAmount);
    rec.setGrossSalary(grossSalary);

    // Loss of Pay
    double lossOfPay = round2(absentDays * dailyRate);
    rec.setLossOfPay(lossOfPay);

    // Deductions (Advance Salary Recovery)
    double finalAdvance = round2(advanceDeducted);
    rec.setAdvanceDeducted(finalAdvance);
    rec.setTotalDeductions(finalAdvance);

    // Net Salary
    double net = round2(grossSalary - finalAdvance);
    if (net < 0.0) net = 0.0;
    rec.setNetSalary(net);

    rec.setRemarks(remarks);

    return rec;
}
