#include "services/PayrollCalculator.hpp"
#include <cmath>

double PayrollCalculator::round2(double val) {
    return std::round(val * 100.0) / 100.0;
}

PayrollRecord PayrollCalculator::compute(
    const Employee& employee,
    const std::string& month,
    double presentDays,
    double casualLeaveDays,
    double absentDays
) {
    PayrollRecord rec;
    rec.setId(employee.getId() + "_" + month);
    rec.setMonth(month);
    rec.setEmployeeId(employee.getId());
    rec.setEmployeeName(employee.getName());
    rec.setDesignation(employee.getDesignation());
    rec.setBaseSalary(employee.getBaseSalary());

    rec.setPresentDays(presentDays);
    rec.setCasualLeaveDays(casualLeaveDays);
    rec.setAbsentDays(absentDays);

    double totalDays = presentDays + casualLeaveDays + absentDays;
    if (totalDays <= 0.0) {
        totalDays = 30.0;
    }
    rec.setTotalDays(totalDays);

    double paidDays = presentDays + casualLeaveDays;
    rec.setPaidDays(paidDays);

    double dailyRate = employee.getBaseSalary() / totalDays;
    rec.setDailyRate(round2(dailyRate));

    double lossOfPay = absentDays * dailyRate;
    rec.setLossOfPay(round2(lossOfPay));

    double netSalary = paidDays * dailyRate;
    rec.setNetSalary(round2(netSalary));

    return rec;
}

