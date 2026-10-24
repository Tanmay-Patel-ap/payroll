#include "server.h"
#include "services/PayrollCalculator.hpp"
#include "utils/Logger.hpp"
#include <httplib.h>
#include <nlohmann/json.hpp>
#include <iostream>
#include <thread>
#include <filesystem>

using json = nlohmann::json;

// ── CORS HEADERS ──────────────────────────────────────────────────
static void setCORS(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── RESPONSE HELPERS ──────────────────────────────────────────────
static void sendJson(httplib::Response& res, const json& j, int status = 200) {
    setCORS(res);
    res.status = status;
    res.set_content(j.dump(), "application/json; charset=utf-8");
}

static void sendError(httplib::Response& res, const std::string& msg, int status = 400) {
    sendJson(res, {{"error", msg}}, status);
}

// ── BIDIRECTIONAL EXCEL SYNCHRONIZATION HELPERS ───────────────────
static std::filesystem::file_time_type g_lastEmployeeExcelTime;
static bool g_lastEmployeeExcelExisted = false;
static bool g_employeeExcelTimeInit = false;

static std::map<std::string, std::filesystem::file_time_type> g_payrollExcelFiles;
static bool g_payrollExcelFilesInit = false;

static std::string findExcelFile(const std::string& path) {
    if (std::filesystem::exists(path)) return path;
    if (std::filesystem::exists("../" + path)) return "../" + path;
    return path;
}

static std::string getFyForMonth(const std::string& monthStr) {
    int year = 2026;
    int month = 10;
    if (monthStr.length() >= 7 && monthStr[4] == '-') {
        try {
            year = std::stoi(monthStr.substr(0, 4));
            month = std::stoi(monthStr.substr(5, 2));
        } catch (...) {}
    } else {
        std::istringstream iss(monthStr);
        std::string mPart, yPart;
        iss >> mPart >> yPart;
        if (!yPart.empty()) {
            try { year = std::stoi(yPart); } catch (...) {}
        }
        std::string mLower = mPart;
        for (char& c : mLower) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        if (mLower.rfind("jan", 0) == 0) month = 1;
        else if (mLower.rfind("feb", 0) == 0) month = 2;
        else if (mLower.rfind("mar", 0) == 0) month = 3;
        else if (mLower.rfind("apr", 0) == 0) month = 4;
        else if (mLower.rfind("may", 0) == 0) month = 5;
        else if (mLower.rfind("jun", 0) == 0) month = 6;
        else if (mLower.rfind("jul", 0) == 0) month = 7;
        else if (mLower.rfind("aug", 0) == 0) month = 8;
        else if (mLower.rfind("sep", 0) == 0) month = 9;
        else if (mLower.rfind("oct", 0) == 0) month = 10;
        else if (mLower.rfind("nov", 0) == 0) month = 11;
        else if (mLower.rfind("dec", 0) == 0) month = 12;
    }
    int y1 = (month >= 4) ? (year % 100) : ((year - 1) % 100);
    int y2 = (month >= 4) ? ((year + 1) % 100) : (year % 100);
    char buf[16];
    snprintf(buf, sizeof(buf), "%02d-%02d", y1, y2);
    return std::string(buf);
}

static void syncEmployeesFromExcelIfNeeded() {
    std::string path = findExcelFile("data/employee_info.xlsx");
    bool exists = std::filesystem::exists(path);

    if (!g_employeeExcelTimeInit) {
        g_employeeExcelTimeInit = true;
        g_lastEmployeeExcelExisted = exists;
        if (exists) {
            try { g_lastEmployeeExcelTime = std::filesystem::last_write_time(path); } catch (...) {}
            std::system("python server/excel_sync.py --import-employees 2>nul || python excel_sync.py --import-employees 2>nul");
        } else {
            std::system("python server/excel_sync.py --import-employees 2>nul || python excel_sync.py --import-employees 2>nul");
        }
        return;
    }

    if (!exists) {
        if (g_lastEmployeeExcelExisted) {
            g_lastEmployeeExcelExisted = false;
            Logger::info("Detected data/employee_info.xlsx was deleted. Synchronizing empty directory...");
            std::system("python server/excel_sync.py --import-employees 2>nul || python excel_sync.py --import-employees 2>nul");
        }
        return;
    }

    try {
        auto currentWriteTime = std::filesystem::last_write_time(path);
        if (!g_lastEmployeeExcelExisted || currentWriteTime != g_lastEmployeeExcelTime) {
            g_lastEmployeeExcelTime = currentWriteTime;
            g_lastEmployeeExcelExisted = true;
            Logger::info("Detected data/employee_info.xlsx modified. Importing to web database...");
            std::system("python server/excel_sync.py --import-employees 2>nul || python excel_sync.py --import-employees 2>nul");
        }
    } catch (...) {}
}

static void syncPayrollFromExcelIfNeeded() {
    std::string centralDir = findExcelFile("data/central payroll");
    bool exists = std::filesystem::exists(centralDir);

    std::map<std::string, std::filesystem::file_time_type> currentFiles;
    if (exists) {
        try {
            for (const auto& entry : std::filesystem::directory_iterator(centralDir)) {
                if (entry.is_regular_file() && entry.path().extension() == ".xlsx") {
                    std::string fname = entry.path().filename().string();
                    if (fname.rfind("~$", 0) == 0) continue;
                    currentFiles[fname] = entry.last_write_time();
                }
            }
        } catch (...) {}
    }

    if (!g_payrollExcelFilesInit) {
        g_payrollExcelFilesInit = true;
        g_payrollExcelFiles = currentFiles;
        std::system("python server/excel_sync.py --import-payroll 2>nul || python excel_sync.py --import-payroll 2>nul");
        return;
    }

    bool changed = false;
    if (currentFiles.size() != g_payrollExcelFiles.size()) {
        changed = true;
    } else {
        for (const auto& [fname, t] : currentFiles) {
            auto it = g_payrollExcelFiles.find(fname);
            if (it == g_payrollExcelFiles.end() || it->second != t) {
                changed = true;
                break;
            }
        }
    }

    if (changed) {
        g_payrollExcelFiles = currentFiles;
        Logger::info("Detected central payroll Excel files changed, added, or deleted. Syncing web database immediately...");
        std::system("python server/excel_sync.py --import-payroll 2>nul || python excel_sync.py --import-payroll 2>nul");
    }
}

static bool triggerExcelSync() {
    Logger::info("Synchronizing Excel workbooks immediately...");
    int ret = std::system("python excel_sync.py --export-all || python server/excel_sync.py --export-all");
    if (ret != 0) {
        Logger::warn("Excel synchronization script returned exit code " + std::to_string(ret));
        return false;
    } else {
        Logger::info("Excel synchronization completed successfully.");
        std::string path = findExcelFile("data/employee_info.xlsx");
        if (std::filesystem::exists(path)) {
            try {
                g_lastEmployeeExcelTime = std::filesystem::last_write_time(path);
                g_lastEmployeeExcelExisted = true;
            } catch (...) {}
        }
        std::string centralDir = findExcelFile("data/central payroll");
        if (std::filesystem::exists(centralDir)) {
            try {
                for (const auto& entry : std::filesystem::directory_iterator(centralDir)) {
                    if (entry.is_regular_file() && entry.path().extension() == ".xlsx") {
                        std::string fname = entry.path().filename().string();
                        if (fname.rfind("~$", 0) == 0) continue;
                        g_payrollExcelFiles[fname] = entry.last_write_time();
                    }
                }
            } catch (...) {}
        }
        return true;
    }
}

// ── SERVER RUNNER ─────────────────────────────────────────────────
void runServer(
    const ServerConfig& config,
    std::shared_ptr<IEmployeeRepository> empRepo,
    std::shared_ptr<IPayrollRepository> payrollRepo,
    std::shared_ptr<IRoleRepository> roleRepo
) {
    httplib::Server svr;

    // ── CORS PREFLIGHT ────────────────────────────────────────────
    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) {
        if (req.method == "OPTIONS") {
            setCORS(res);
            res.status = 204;
            return httplib::Server::HandlerResponse::Handled;
        }
        return httplib::Server::HandlerResponse::Unhandled;
    });

    // ── EMPLOYEE ENDPOINTS ────────────────────────────────────────
    // GET /api/employees
    svr.Get("/api/employees", [empRepo](const httplib::Request&, httplib::Response& res) {
        syncEmployeesFromExcelIfNeeded();
        std::string path = findExcelFile("data/employee_info.xlsx");
        if (!std::filesystem::exists(path)) {
            sendJson(res, json::array());
            return;
        }
        auto list = empRepo->getAll();
        json arr = json::array();
        for (const auto& emp : list) {
            arr.push_back(emp.toJson());
        }
        sendJson(res, arr);
    });

    // GET /api/employees/:id
    svr.Get(R"(/api/employees/([^/]+))", [empRepo](const httplib::Request& req, httplib::Response& res) {
        syncEmployeesFromExcelIfNeeded();
        std::string path = findExcelFile("data/employee_info.xlsx");
        if (!std::filesystem::exists(path)) {
            sendError(res, "Employee not found", 404);
            return;
        }
        std::string id = req.matches[1];
        auto emp = empRepo->getById(id);
        if (!emp) {
            sendError(res, "Employee not found", 404);
            return;
        }
        sendJson(res, emp->toJson());
    });

    // ── EMPLOYEE UNIQUENESS HELPERS ──────────────────────────────
    auto normalizePhone = [](const std::string& phone) -> std::string {
        std::string digits;
        for (char c : phone) {
            if (std::isdigit(static_cast<unsigned char>(c))) {
                digits.push_back(c);
            }
        }
        if (digits.length() > 10) {
            return digits.substr(digits.length() - 10);
        }
        return digits;
    };

    auto toLowerTrim = [](const std::string& str) -> std::string {
        size_t first = str.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) return "";
        size_t last = str.find_last_not_of(" \t\r\n");
        std::string res = str.substr(first, (last - first + 1));
        for (char& c : res) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        return res;
    };

    auto toUpperTrim = [](const std::string& str) -> std::string {
        size_t first = str.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) return "";
        size_t last = str.find_last_not_of(" \t\r\n");
        std::string res = str.substr(first, (last - first + 1));
        for (char& c : res) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
        return res;
    };

    auto validateEmployeeUniqueness = [&](
        const std::vector<Employee>& allEmployees,
        const std::string& currentEmpId,
        const std::string& phone,
        const std::string& email,
        const std::string& bankAccountNo,
        const std::string& panTaxNo
    ) -> std::string {
        std::string normPhone = normalizePhone(phone);
        std::string normEmail = toLowerTrim(email);
        std::string normAccount = toUpperTrim(bankAccountNo);
        std::string normPan = toUpperTrim(panTaxNo);

        for (const auto& emp : allEmployees) {
            if (!currentEmpId.empty() && emp.getId() == currentEmpId) {
                continue; // Skip the employee being edited
            }

            // Phone check (if provided and >= 5 digits)
            if (!normPhone.empty() && normPhone.length() >= 5) {
                std::string existingPhone = normalizePhone(emp.getPhone());
                if (!existingPhone.empty() && existingPhone == normPhone) {
                    return "Phone number '" + phone + "' is already registered to employee " + emp.getId() + " (" + emp.getName() + ")";
                }
            }

            // Email check (if provided)
            if (!normEmail.empty()) {
                std::string existingEmail = toLowerTrim(emp.getEmail());
                if (!existingEmail.empty() && existingEmail == normEmail) {
                    return "Email address '" + email + "' is already registered to employee " + emp.getId() + " (" + emp.getName() + ")";
                }
            }

            // Bank Account check (if provided)
            if (!normAccount.empty()) {
                std::string existingAccount = toUpperTrim(emp.getBankAccountNo());
                if (!existingAccount.empty() && existingAccount == normAccount) {
                    return "Bank account number '" + bankAccountNo + "' is already registered to employee " + emp.getId() + " (" + emp.getName() + ")";
                }
            }

            // PAN check (if provided)
            if (!normPan.empty()) {
                std::string existingPan = toUpperTrim(emp.getPanTaxNo());
                if (!existingPan.empty() && existingPan == normPan) {
                    return "PAN number '" + panTaxNo + "' is already registered to employee " + emp.getId() + " (" + emp.getName() + ")";
                }
            }
        }
        return "";
    };

    // POST /api/employees
    svr.Post("/api/employees", [empRepo, validateEmployeeUniqueness](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            std::string name = body.value("name", "");
            if (name.empty()) {
                sendError(res, "Employee name is required", 400);
                return;
            }

            std::string email = body.value("email", "");
            std::string phone = body.value("phone", "");
            std::string bankAccountNo = body.value("bankAccountNo", "");
            std::string panTaxNo = body.value("panTaxNo", "");

            std::string dupErr = validateEmployeeUniqueness(empRepo->getAll(), "", phone, email, bankAccountNo, panTaxNo);
            if (!dupErr.empty()) {
                sendError(res, dupErr, 400);
                return;
            }

            std::string id = body.value("id", "");
            if (id.empty()) {
                auto existing = empRepo->getAll();
                int maxNum = 0;
                for (const auto& e : existing) {
                    std::string curId = e.getId();
                    if (curId.rfind("EMP", 0) == 0) {
                        try {
                            int num = std::stoi(curId.substr(3));
                            if (num > maxNum) maxNum = num;
                        } catch (...) {}
                    }
                }
                char buf[32];
                snprintf(buf, sizeof(buf), "EMP%03d", maxNum + 1);
                id = buf;
            }

            Employee emp;
            emp.setId(id);
            emp.setName(name);
            emp.setDesignation(body.value("designation", "Staff"));
            emp.setEmail(email);
            emp.setPhone(phone);
            emp.setJoinDate(body.value("joinDate", "2024-04-01"));
            emp.setLeaveDate(body.value("leaveDate", ""));
            emp.setBankName(body.value("bankName", ""));
            emp.setBankAccountNo(bankAccountNo);
            emp.setBankIfscCode(body.value("bankIfscCode", ""));
            emp.setPanTaxNo(panTaxNo);

            double salary = 0.0;
            if (body.contains("salary")) {
                salary = body.value("salary", 0.0);
            } else if (body.contains("monthlySalary")) {
                salary = body.value("monthlySalary", 0.0);
            } else if (body.contains("baseSalary")) {
                salary = body.value("baseSalary", 0.0);
            }

            double dailyRate = body.value("dailyRate", 0.0);
            if (salary > 0.0) {
                emp.setSalary(salary);
                if (dailyRate > 0.0) emp.setDailyRate(dailyRate);
            } else if (dailyRate > 0.0) {
                emp.setDailyRate(dailyRate);
                emp.setSalary(dailyRate * 30.0);
            }
            emp.setIsActive(body.value("isActive", true));

            if (!empRepo->add(emp)) {
                sendError(res, "Employee with ID " + id + " already exists", 400);
                return;
            }

            Logger::info("Created employee: " + id + " (" + name + ")");
            triggerExcelSync();
            sendJson(res, emp.toJson(), 201);
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // PUT /api/employees/:id
    svr.Put(R"(/api/employees/([^/]+))", [empRepo, validateEmployeeUniqueness](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        try {
            json body = json::parse(req.body);
            auto existing = empRepo->getById(id);
            if (!existing) {
                sendError(res, "Employee not found", 404);
                return;
            }

            std::string name = body.value("name", existing->getName());
            if (name.empty()) {
                sendError(res, "Employee name cannot be empty", 400);
                return;
            }

            std::string email = body.contains("email") ? body.value("email", "") : existing->getEmail();
            std::string phone = body.contains("phone") ? body.value("phone", "") : existing->getPhone();
            std::string bankAccountNo = body.contains("bankAccountNo") ? body.value("bankAccountNo", "") : existing->getBankAccountNo();
            std::string panTaxNo = body.contains("panTaxNo") ? body.value("panTaxNo", "") : existing->getPanTaxNo();

            std::string dupErr = validateEmployeeUniqueness(empRepo->getAll(), id, phone, email, bankAccountNo, panTaxNo);
            if (!dupErr.empty()) {
                sendError(res, dupErr, 400);
                return;
            }

            Employee emp = *existing;
            emp.setName(name);
            if (body.contains("designation")) emp.setDesignation(body.value("designation", "Staff"));
            emp.setEmail(email);
            emp.setPhone(phone);
            if (body.contains("joinDate")) emp.setJoinDate(body.value("joinDate", "2024-04-01"));
            if (body.contains("leaveDate")) emp.setLeaveDate(body.value("leaveDate", ""));
            if (body.contains("bankName")) emp.setBankName(body.value("bankName", ""));
            emp.setBankAccountNo(bankAccountNo);
            if (body.contains("bankIfscCode")) emp.setBankIfscCode(body.value("bankIfscCode", ""));
            emp.setPanTaxNo(panTaxNo);

            if (body.contains("salary")) {
                emp.setSalary(body.value("salary", 0.0));
            } else if (body.contains("monthlySalary")) {
                emp.setSalary(body.value("monthlySalary", 0.0));
            } else if (body.contains("baseSalary")) {
                emp.setSalary(body.value("baseSalary", 0.0));
            } else if (body.contains("dailyRate")) {
                emp.setDailyRate(body.value("dailyRate", 0.0));
                emp.setSalary(body.value("dailyRate", 0.0) * 30.0);
            }
            if (body.contains("isActive")) emp.setIsActive(body.value("isActive", true));

            if (empRepo->update(emp)) {
                Logger::info("Updated employee: " + id + " (" + name + ")");
                triggerExcelSync();
                sendJson(res, emp.toJson());
            } else {
                sendError(res, "Failed to update employee", 500);
            }
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // DELETE /api/employees/:id
    svr.Delete(R"(/api/employees/([^/]+))", [empRepo](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        if (empRepo->remove(id)) {
            Logger::info("Removed employee: " + id);
            triggerExcelSync();
            sendJson(res, {{"success", true}, {"message", "Employee removed"}});
        } else {
            sendError(res, "Employee not found", 404);
        }
    });

    // ── ROLE ENDPOINTS ────────────────────────────────────────────
    // GET /api/roles
    svr.Get("/api/roles", [roleRepo](const httplib::Request&, httplib::Response& res) {
        syncEmployeesFromExcelIfNeeded();
        std::string path = findExcelFile("data/employee_info.xlsx");
        if (!std::filesystem::exists(path)) {
            sendJson(res, json::array());
            return;
        }
        auto list = roleRepo->getAll();
        json arr = json::array();
        for (const auto& r : list) {
            arr.push_back(r.toJson());
        }
        sendJson(res, arr);
    });

    // POST /api/roles
    svr.Post("/api/roles", [roleRepo](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            std::string name = body.value("name", "");
            size_t first = name.find_first_not_of(" \t\r\n");
            if (first != std::string::npos) {
                size_t last = name.find_last_not_of(" \t\r\n");
                name = name.substr(first, last - first + 1);
            } else {
                name = "";
            }

            if (name.empty()) {
                sendError(res, "Role title cannot be empty", 400);
                return;
            }

            double salary = body.value("salary", 0.0);
            if (salary <= 0.0) {
                sendError(res, "Monthly salary must be greater than zero", 400);
                return;
            }

            if (roleRepo->getByName(name).has_value()) {
                sendError(res, "Role with title '" + name + "' already exists", 400);
                return;
            }

            std::string id = body.value("id", "");
            if (id.empty()) {
                auto existing = roleRepo->getAll();
                int maxNum = 0;
                for (const auto& r : existing) {
                    std::string curId = r.getId();
                    if (curId.rfind("ROLE", 0) == 0) {
                        try {
                            int num = std::stoi(curId.substr(4));
                            if (num > maxNum) maxNum = num;
                        } catch (...) {}
                    }
                }
                char buf[32];
                snprintf(buf, sizeof(buf), "ROLE%03d", maxNum + 1);
                id = buf;
            }

            Role r(id, name, salary);
            if (!roleRepo->add(r)) {
                sendError(res, "Failed to add role (duplicate ID or name)", 400);
                return;
            }

            Logger::info("Created role: " + id + " (" + name + ")");
            triggerExcelSync();
            sendJson(res, r.toJson(), 201);
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // PUT /api/roles/:id
    svr.Put(R"(/api/roles/([^/]+))", [roleRepo, empRepo](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        try {
            json body = json::parse(req.body);
            auto existing = roleRepo->getById(id);
            if (!existing) {
                sendError(res, "Role not found", 404);
                return;
            }

            std::string oldName = existing->getName();
            double oldSalary = existing->getSalary();

            std::string name = body.value("name", oldName);
            size_t first = name.find_first_not_of(" \t\r\n");
            if (first != std::string::npos) {
                size_t last = name.find_last_not_of(" \t\r\n");
                name = name.substr(first, last - first + 1);
            }
            if (name.empty()) {
                sendError(res, "Role title cannot be empty", 400);
                return;
            }

            double salary = body.value("salary", oldSalary);
            if (salary <= 0.0) {
                sendError(res, "Monthly salary must be greater than zero", 400);
                return;
            }

            Role r(id, name, salary);
            if (roleRepo->update(r)) {
                Logger::info("Updated role: " + id + " (" + name + ", salary: " + std::to_string(salary) + ")");

                // Helper to normalize strings for comparison (case-insensitive & trimmed)
                auto normStr = [](const std::string& s) -> std::string {
                    std::string res;
                    for (char c : s) {
                        if (!std::isspace(static_cast<unsigned char>(c))) {
                            res.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
                        }
                    }
                    return res;
                };

                std::string normOld = normStr(oldName);
                std::string normNew = normStr(name);

                int employeesUpdated = 0;
                auto allEmps = empRepo->getAll();
                for (auto emp : allEmps) {
                    std::string empDesig = normStr(emp.getDesignation());
                    if (empDesig == normOld || empDesig == normNew) {
                        emp.setDesignation(name);
                        emp.setSalary(salary);
                        emp.setMonthlySalary(salary);
                        // Standardize daily rate for 31-day month calculation
                        double daily = std::round((salary / 31.0) * 100.0) / 100.0;
                        emp.setDailyRate(daily);
                        empRepo->update(emp);
                        employeesUpdated++;
                    }
                }

                if (employeesUpdated > 0) {
                    Logger::info("Cascaded role changes to " + std::to_string(employeesUpdated) + " employee(s) having designation " + name);
                }

                triggerExcelSync();
                sendJson(res, r.toJson());
            } else {
                sendError(res, "Role title already in use by another role", 400);
            }
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // DELETE /api/roles/:id
    svr.Delete(R"(/api/roles/([^/]+))", [roleRepo](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        if (roleRepo->remove(id)) {
            Logger::info("Removed role: " + id);
            triggerExcelSync();
            sendJson(res, {{"success", true}, {"message", "Role removed"}});
        } else {
            sendError(res, "Role not found", 404);
        }
    });

    // ── PAYROLL ENDPOINTS ─────────────────────────────────────────
    // GET /api/payroll?month=...
    svr.Get("/api/payroll", [payrollRepo](const httplib::Request& req, httplib::Response& res) {
        syncPayrollFromExcelIfNeeded();
        if (!req.has_param("month")) {
            sendError(res, "Missing parameter: month", 400);
            return;
        }
        std::string month = req.get_param_value("month");
        std::string fy = getFyForMonth(month);
        std::string sheetFile = findExcelFile("data/central payroll/SALARY SHEET " + fy + ".xlsx");
        if (!std::filesystem::exists(sheetFile)) {
            // Excel salary sheet does not exist on disk: return empty records immediately
            json summary = {
                {"month", month},
                {"employeeCount", 0},
                {"totalDailyRate", 0.0},
                {"totalEarnedSalary", 0.0},
                {"totalGrossSalary", 0.0},
                {"totalLossOfPay", 0.0},
                {"totalAdvanceDeducted", 0.0},
                {"totalDeductions", 0.0},
                {"totalNetSalary", 0.0},
                {"totalPresentDays", 0.0},
                {"totalCasualLeaveDays", 0.0},
                {"totalSundays", 0.0},
                {"totalAbsentDays", 0.0},
                {"totalPaidDays", 0.0}
            };
            sendJson(res, {
                {"month", month},
                {"records", json::array()},
                {"summary", summary}
            });
            return;
        }
        auto records = payrollRepo->getByMonth(month);

        double totalDailyRate = 0.0;
        double totalEarned = 0.0;
        double totalGross = 0.0;
        double totalLossOfPay = 0.0;
        double totalAdvance = 0.0;
        double totalDeductions = 0.0;
        double totalNet = 0.0;
        double totalPresent = 0.0;
        double totalCasual = 0.0;
        double totalSundays = 0.0;
        double totalAbsent = 0.0;
        double totalPaidDays = 0.0;

        json recordsArr = json::array();
        for (const auto& r : records) {
            recordsArr.push_back(r.toJson());
            totalDailyRate += r.getDailyRate();
            totalEarned += r.getEarnedSalary();
            totalGross += r.getGrossSalary();
            totalLossOfPay += r.getLossOfPay();
            totalAdvance += r.getAdvanceDeducted();
            totalDeductions += r.getTotalDeductions();
            totalNet += r.getNetSalary();
            totalPresent += r.getPresentDays();
            totalCasual += r.getCasualLeaveDays();
            totalSundays += r.getSundays();
            totalAbsent += r.getAbsentDays();
            totalPaidDays += r.getPaidDays();
        }

        json summary = {
            {"month", month},
            {"employeeCount", static_cast<int>(records.size())},
            {"totalDailyRate", PayrollCalculator::round2(totalDailyRate)},
            {"totalEarnedSalary", PayrollCalculator::round2(totalEarned)},
            {"totalGrossSalary", PayrollCalculator::round2(totalGross)},
            {"totalLossOfPay", PayrollCalculator::round2(totalLossOfPay)},
            {"totalAdvanceDeducted", PayrollCalculator::round2(totalAdvance)},
            {"totalDeductions", PayrollCalculator::round2(totalDeductions)},
            {"totalNetSalary", PayrollCalculator::round2(totalNet)},
            {"totalPresentDays", totalPresent},
            {"totalCasualLeaveDays", totalCasual},
            {"totalSundays", totalSundays},
            {"totalAbsentDays", totalAbsent},
            {"totalPaidDays", totalPaidDays}
        };

        sendJson(res, {
            {"month", month},
            {"records", recordsArr},
            {"summary", summary}
        });
    });

    // GET /api/payroll/record?month=...&employeeId=...
    svr.Get("/api/payroll/record", [payrollRepo](const httplib::Request& req, httplib::Response& res) {
        syncPayrollFromExcelIfNeeded();
        if (!req.has_param("month") || !req.has_param("employeeId")) {
            sendError(res, "Missing parameters: month, employeeId", 400);
            return;
        }
        std::string month = req.get_param_value("month");
        std::string empId = req.get_param_value("employeeId");

        std::string fy = getFyForMonth(month);
        std::string sheetFile = findExcelFile("data/central payroll/SALARY SHEET " + fy + ".xlsx");
        if (!std::filesystem::exists(sheetFile)) {
            sendError(res, "Record not found (central salary sheet does not exist)", 404);
            return;
        }

        auto rec = payrollRepo->getByMonthAndEmployee(month, empId);
        if (!rec) {
            sendError(res, "Record not found", 404);
            return;
        }
        sendJson(res, rec->toJson());
    });

    // POST /api/payroll/single
    svr.Post("/api/payroll/single", [empRepo, payrollRepo](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            std::string month = body.value("month", "");
            std::string empId = body.value("employeeId", "");
            double present = body.value("presentDays", 0.0);
            double casual = body.value("casualLeaveDays", 0.0);
            double absent = body.value("absentDays", 0.0);
            double sundays = body.value("sundays", 0.0);
            double overtime = body.value("overtimeAmount", 0.0);
            double bonus = body.value("bonusAmount", 0.0);
            double advance = body.value("advanceDeducted", 0.0);
            double dailyOverride = body.value("dailyRate", -1.0);
            std::string remarks = body.value("remarks", "");

            if (month.empty() || empId.empty()) {
                sendError(res, "Missing month or employeeId", 400);
                return;
            }

            auto emp = empRepo->getById(empId);
            if (!emp) {
                sendError(res, "Employee not found", 404);
                return;
            }

            PayrollRecord rec = PayrollCalculator::compute(
                *emp, month, present, casual, absent, sundays,
                overtime, bonus, advance, dailyOverride, remarks
            );

            if (payrollRepo->saveRecord(rec)) {
                Logger::info("Saved payroll for " + empId + " (" + month + ")");
                bool syncOk = triggerExcelSync();
                json resp = rec.toJson();
                if (!syncOk) {
                    resp["warning"] = "Saved to app database! However, the Excel file is open in Microsoft Excel. Please close Excel so changes can sync to the spreadsheet.";
                }
                sendJson(res, resp);
            } else {
                sendError(res, "Failed to save payroll", 500);
            }
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // POST /api/payroll/batch
    svr.Post("/api/payroll/batch", [empRepo, payrollRepo](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            std::string month = body.value("month", "");
            if (month.empty() || !body.contains("records") || !body["records"].is_array()) {
                sendError(res, "Missing month or records array", 400);
                return;
            }

            std::vector<PayrollRecord> computed;
            for (const auto& item : body["records"]) {
                std::string empId = item.value("employeeId", "");
                double present = item.value("presentDays", 0.0);
                double casual = item.value("casualLeaveDays", 0.0);
                double absent = item.value("absentDays", 0.0);
                double sundays = item.value("sundays", 0.0);
                double overtime = item.value("overtimeAmount", 0.0);
                double bonus = item.value("bonusAmount", 0.0);
                double advance = item.value("advanceDeducted", 0.0);
                double dailyOverride = item.value("dailyRate", -1.0);
                std::string remarks = item.value("remarks", "");

                auto emp = empRepo->getById(empId);
                if (emp) {
                    computed.push_back(PayrollCalculator::compute(
                        *emp, month, present, casual, absent, sundays,
                        overtime, bonus, advance, dailyOverride, remarks
                    ));
                }
            }

            if (payrollRepo->saveBatch(month, computed)) {
                Logger::info("Batch saved " + std::to_string(computed.size()) + " records for " + month);
                bool syncOk = triggerExcelSync();
                json resp = {
                    {"success", true},
                    {"month", month},
                    {"savedCount", static_cast<int>(computed.size())}
                };
                if (!syncOk) {
                    resp["warning"] = "Saved to app database! However, the Excel file is open in Microsoft Excel. Please close Excel so changes can sync to the spreadsheet.";
                }
                sendJson(res, resp);
            } else {
                sendError(res, "Failed to save batch payroll", 500);
            }
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // GET /api/payroll/months
    svr.Get("/api/payroll/months", [payrollRepo](const httplib::Request&, httplib::Response& res) {
        syncPayrollFromExcelIfNeeded();
        std::string centralDir = findExcelFile("data/central payroll");
        bool hasFiles = false;
        if (std::filesystem::exists(centralDir)) {
            for (const auto& entry : std::filesystem::directory_iterator(centralDir)) {
                if (entry.is_regular_file() && entry.path().extension() == ".xlsx" && entry.path().filename().string().rfind("~$", 0) != 0) {
                    hasFiles = true;
                    break;
                }
            }
        }
        if (!hasFiles) {
            sendJson(res, json::array());
            return;
        }
        auto months = payrollRepo->getDistinctMonths();
        json arr = json::array();
        for (const auto& m : months) arr.push_back(m);
        sendJson(res, arr);
    });

    // DELETE /api/payroll?month=...&employeeId=...
    svr.Delete("/api/payroll", [payrollRepo](const httplib::Request& req, httplib::Response& res) {
        if (!req.has_param("month") || !req.has_param("employeeId")) {
            sendError(res, "Missing parameters: month, employeeId", 400);
            return;
        }
        std::string month = req.get_param_value("month");
        std::string empId = req.get_param_value("employeeId");

        if (payrollRepo->deleteRecord(month, empId)) {
            triggerExcelSync();
            sendJson(res, {{"success", true}});
        } else {
            sendError(res, "Record not found", 404);
        }
    });

    // ── PAYSLIP PDF ENDPOINTS (Designated Space: data/individual payrolls/<FY>/<MONTH>/) ──
    // GET /api/payroll/slip-pdf?month=...&employeeId=...
    svr.Get("/api/payroll/slip-pdf", [empRepo, payrollRepo](const httplib::Request& req, httplib::Response& res) {
        if (!req.has_param("month") || !req.has_param("employeeId")) {
            sendError(res, "Missing parameters: month, employeeId", 400);
            return;
        }
        std::string month = req.get_param_value("month");
        std::string empId = req.get_param_value("employeeId");

        // Force generate / replace PDF in designated space via excel_sync.py
        std::string cmd = "python server/excel_sync.py --slip-pdf --month \"" + month + "\" --emp \"" + empId + "\" --force 2>nul || python excel_sync.py --slip-pdf --month \"" + month + "\" --emp \"" + empId + "\" --force 2>nul";
        std::system(cmd.c_str());

        auto emp = empRepo->getById(empId);
        std::string empName = emp ? emp->getName() : "Employee";
        for (char& c : empName) {
            if (c == ' ') c = '_';
        }
        std::string targetFilename = empId + "_" + empName + "_Payslip.pdf";

        std::string pdfPath = "";
        std::string indDir = findExcelFile("data/individual payrolls");
        if (std::filesystem::exists(indDir)) {
            for (const auto& entry : std::filesystem::recursive_directory_iterator(indDir)) {
                if (entry.is_regular_file() && entry.path().filename().string() == targetFilename) {
                    pdfPath = entry.path().string();
                    break;
                }
            }
        }

        if (pdfPath.empty() || !std::filesystem::exists(pdfPath)) {
            sendError(res, "Payslip PDF not found or could not be generated", 500);
            return;
        }

        std::ifstream f(pdfPath, std::ios::binary);
        if (!f.is_open()) {
            sendError(res, "Could not open generated payslip PDF", 500);
            return;
        }

        std::string pdfData((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
        res.set_content(pdfData, "application/pdf");
        res.set_header("Content-Disposition", "attachment; filename=\"" + targetFilename + "\"");
    });

    // POST /api/payroll/slip-pdf
    svr.Post("/api/payroll/slip-pdf", [empRepo, payrollRepo](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            std::string month = body.value("month", "");
            std::string empId = body.value("employeeId", "");

            if (month.empty() || empId.empty()) {
                sendError(res, "Missing month or employeeId", 400);
                return;
            }

            auto emp = empRepo->getById(empId);
            if (!emp) {
                sendError(res, "Employee not found", 404);
                return;
            }

            // If payload contains attendance/advance edits, save them first
            if (body.contains("presentDays") || body.contains("casualLeaveDays") || body.contains("absentDays") || body.contains("advanceDeducted")) {
                double present = body.value("presentDays", 0.0);
                double casual = body.value("casualLeaveDays", 0.0);
                double absent = body.value("absentDays", 0.0);
                double sundays = body.value("sundays", 0.0);
                double overtime = body.value("overtimeAmount", 0.0);
                double bonus = body.value("bonusAmount", 0.0);
                double advance = body.value("advanceDeducted", 0.0);
                double dailyOverride = body.value("dailyRate", -1.0);
                std::string remarks = body.value("remarks", "");

                PayrollRecord rec = PayrollCalculator::compute(
                    *emp, month, present, casual, absent, sundays,
                    overtime, bonus, advance, dailyOverride, remarks
                );
                payrollRepo->saveRecord(rec);
                triggerExcelSync();
            }

            // Generate/replace PDF in designated space
            std::string cmd = "python server/excel_sync.py --slip-pdf --month \"" + month + "\" --emp \"" + empId + "\" --force 2>nul || python excel_sync.py --slip-pdf --month \"" + month + "\" --emp \"" + empId + "\" --force 2>nul";
            std::system(cmd.c_str());

            std::string empName = emp->getName();
            for (char& c : empName) {
                if (c == ' ') c = '_';
            }
            std::string targetFilename = empId + "_" + empName + "_Payslip.pdf";

            std::string pdfPath = "";
            std::string indDir = findExcelFile("data/individual payrolls");
            if (std::filesystem::exists(indDir)) {
                for (const auto& entry : std::filesystem::recursive_directory_iterator(indDir)) {
                    if (entry.is_regular_file() && entry.path().filename().string() == targetFilename) {
                        pdfPath = entry.path().string();
                        break;
                    }
                }
            }

            if (pdfPath.empty() || !std::filesystem::exists(pdfPath)) {
                sendError(res, "Failed to generate or locate payslip PDF", 500);
                return;
            }

            std::ifstream f(pdfPath, std::ios::binary);
            if (!f.is_open()) {
                sendError(res, "Could not open generated payslip PDF", 500);
                return;
            }

            std::string pdfData((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
            res.set_content(pdfData, "application/pdf");
            res.set_header("Content-Disposition", "attachment; filename=\"" + targetFilename + "\"");
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // ── STATIC ASSETS (client/ DIRECTORY) ─────────────────────────
    // Supports launching from project root ("client") or inside server folder ("../client")
    if (!svr.set_mount_point("/", "client")) {
        if (!svr.set_mount_point("/", "../client")) {
            Logger::error("Failed to mount client/ directory for static files");
        } else {
            Logger::info("Mounted static frontend assets from ../client");
        }
    } else {
        Logger::info("Mounted static frontend assets from client/");
    }

    // ── START SERVER ──────────────────────────────────────────────
    std::cout << "======================================================" << std::endl;
    std::cout << "  ACCOUNTANT PAYROLL & PAYSLIP SYSTEM (Windows C++)   " << std::endl;
    std::cout << "======================================================" << std::endl;
    std::cout << "  Local Server running at: http://localhost:" << config.port << std::endl;
    std::cout << "  Press Ctrl+C to terminate the server safely." << std::endl;
    std::cout << "======================================================" << std::endl;

    if (!svr.listen(config.host, config.port)) {
        Logger::error("Failed to bind port " + std::to_string(config.port));
    }
}
