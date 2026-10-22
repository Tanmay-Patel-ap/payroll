#include "repositories/JsonPayrollRepository.hpp"
#include "utils/FileUtils.hpp"
#include "utils/Logger.hpp"
#include <nlohmann/json.hpp>
#include <algorithm>
#include <set>

using json = nlohmann::json;

JsonPayrollRepository::JsonPayrollRepository(const std::string& filePath)
    : m_filePath(filePath) {}

void JsonPayrollRepository::loadFromFile(std::vector<PayrollRecord>& list) {
    list.clear();
    std::string content;
    if (!FileUtils::readFile(m_filePath, content)) {
        return;
    }
    try {
        json root = json::parse(content);
        if (root.is_array()) {
            for (const auto& item : root) {
                list.push_back(PayrollRecord::fromJson(item));
            }
        }
    } catch (const std::exception& e) {
        Logger::error("Failed to parse payroll JSON: " + std::string(e.what()));
    }
}

void JsonPayrollRepository::saveToFile(const std::vector<PayrollRecord>& list) {
    json root = json::array();
    for (const auto& rec : list) {
        root.push_back(rec.toJson());
    }
    FileUtils::writeFile(m_filePath, root.dump(2));
}

std::vector<PayrollRecord> JsonPayrollRepository::getByMonth(const std::string& month) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<PayrollRecord> list;
    loadFromFile(list);
    std::vector<PayrollRecord> filtered;
    for (const auto& r : list) {
        if (r.getMonth() == month) {
            filtered.push_back(r);
        }
    }
    return filtered;
}

std::optional<PayrollRecord> JsonPayrollRepository::getByMonthAndEmployee(const std::string& month, const std::string& employeeId) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<PayrollRecord> list;
    loadFromFile(list);
    for (const auto& r : list) {
        if (r.getMonth() == month && r.getEmployeeId() == employeeId) {
            return r;
        }
    }
    return std::nullopt;
}

bool JsonPayrollRepository::saveRecord(const PayrollRecord& record) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<PayrollRecord> list;
    loadFromFile(list);
    bool found = false;
    for (auto& r : list) {
        if (r.getMonth() == record.getMonth() && r.getEmployeeId() == record.getEmployeeId()) {
            r = record;
            found = true;
            break;
        }
    }
    if (!found) {
        list.push_back(record);
    }
    saveToFile(list);
    return true;
}

bool JsonPayrollRepository::saveBatch(const std::string& month, const std::vector<PayrollRecord>& records) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<PayrollRecord> list;
    loadFromFile(list);

    for (const auto& newRec : records) {
        bool found = false;
        for (auto& oldRec : list) {
            if (oldRec.getMonth() == month && oldRec.getEmployeeId() == newRec.getEmployeeId()) {
                oldRec = newRec;
                found = true;
                break;
            }
        }
        if (!found) {
            list.push_back(newRec);
        }
    }
    saveToFile(list);
    return true;
}

std::vector<std::string> JsonPayrollRepository::getDistinctMonths() {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<PayrollRecord> list;
    loadFromFile(list);
    std::set<std::string> months;
    for (const auto& r : list) {
        if (!r.getMonth().empty()) {
            months.insert(r.getMonth());
        }
    }
    return std::vector<std::string>(months.begin(), months.end());
}

bool JsonPayrollRepository::deleteRecord(const std::string& month, const std::string& employeeId) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<PayrollRecord> list;
    loadFromFile(list);
    size_t before = list.size();
    std::vector<PayrollRecord> updated;
    for (const auto& r : list) {
        if (!(r.getMonth() == month && r.getEmployeeId() == employeeId)) {
            updated.push_back(r);
        }
    }
    if (updated.size() < before) {
        saveToFile(updated);
        return true;
    }
    return false;
}
