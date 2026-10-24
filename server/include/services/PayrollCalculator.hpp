#pragma once

#include "models/PayrollRecord.hpp"
#include "models/Employee.hpp"
#include <string>

class PayrollCalculator {
public:
    static int getDaysInMonth(const std::string& month);

    static PayrollRecord compute(
        const Employee& employee,
        const std::string& month,
        double presentDays,
        double casualLeaveDays,
        double absentDays,
        double sundays = 0.0,
        double overtimeAmount = 0.0,
        double bonusAmount = 0.0,
        double advanceDeducted = 0.0,
        double dailyRateOverride = -1.0,
        const std::string& remarks = ""
    );

    static double round2(double val);
};
