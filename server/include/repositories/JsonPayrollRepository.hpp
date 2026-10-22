#pragma once

#include "repositories/IPayrollRepository.hpp"
#include <mutex>
#include <string>

class JsonPayrollRepository : public IPayrollRepository {
public:
    explicit JsonPayrollRepository(const std::string& filePath = "data/payroll.json");

    std::vector<PayrollRecord> getByMonth(const std::string& month) override;
    std::optional<PayrollRecord> getByMonthAndEmployee(const std::string& month, const std::string& employeeId) override;
    bool saveRecord(const PayrollRecord& record) override;
    bool saveBatch(const std::string& month, const std::vector<PayrollRecord>& records) override;
    std::vector<std::string> getDistinctMonths() override;
    bool deleteRecord(const std::string& month, const std::string& employeeId) override;

private:
    std::string m_filePath;
    std::mutex m_mutex;

    void loadFromFile(std::vector<PayrollRecord>& list);
    void saveToFile(const std::vector<PayrollRecord>& list);
};

