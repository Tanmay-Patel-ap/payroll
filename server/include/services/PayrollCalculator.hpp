#pragma once

#include "models/PayrollRecord.hpp"
#include "models/Employee.hpp"

class PayrollCalculator {
public:
    static PayrollRecord compute(
        const Employee& employee,
        const std::string& month,
        double presentDays,
        double casualLeaveDays,
        double absentDays
    );

    static double round2(double val);
};

