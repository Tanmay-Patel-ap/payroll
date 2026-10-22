#pragma once

#include <vector>
#include <string>
#include <optional>
#include "models/PayrollRecord.hpp"

class IPayrollRepository {
public:
    virtual ~IPayrollRepository() = default;

    virtual std::vector<PayrollRecord> getByMonth(const std::string& month) = 0;
    virtual std::optional<PayrollRecord> getByMonthAndEmployee(const std::string& month, const std::string& employeeId) = 0;
    virtual bool saveRecord(const PayrollRecord& record) = 0;
    virtual bool saveBatch(const std::string& month, const std::vector<PayrollRecord>& records) = 0;
    virtual std::vector<std::string> getDistinctMonths() = 0;
    virtual bool deleteRecord(const std::string& month, const std::string& employeeId) = 0;
};

