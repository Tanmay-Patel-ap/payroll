#include "server.h"
#include "services/PayrollCalculator.hpp"
#include "utils/Logger.hpp"
#include <httplib.h>
#include <nlohmann/json.hpp>
#include <iostream>

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

static void triggerExcelSync() {
    std::thread([]() {
        system("python server/excel_sync.py 2>nul || python excel_sync.py 2>nul");
    }).detach();
}

// ── SERVER RUNNER ─────────────────────────────────────────────────
void runServer(
    const ServerConfig& config,
    std::shared_ptr<IEmployeeRepository> empRepo,
    std::shared_ptr<IPayrollRepository> payrollRepo
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
        auto list = empRepo->getAll();
        json arr = json::array();
        for (const auto& emp : list) {
            arr.push_back(emp.toJson());
        }
        sendJson(res, arr);
    });

    // GET /api/employees/:id
    svr.Get(R"(/api/employees/([^/]+))", [empRepo](const httplib::Request& req, httplib::Response& res) {
        std::string id = req.matches[1];
        auto emp = empRepo->getById(id);
        if (!emp) {
            sendError(res, "Employee not found", 404);
            return;
        }
        sendJson(res, emp->toJson());
    });

    // POST /api/employees
    svr.Post("/api/employees", [empRepo](const httplib::Request& req, httplib::Response& res) {
        try {
            json body = json::parse(req.body);
            std::string name = body.value("name", "");
            std::string designation = body.value("designation", "");
            double baseSalary = body.value("baseSalary", 0.0);

            if (name.empty()) {
                sendError(res, "Employee name is required", 400);
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

            Employee emp(id, name, designation, baseSalary);
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

    // ── PAYROLL ENDPOINTS ─────────────────────────────────────────
    // GET /api/payroll?month=...
    svr.Get("/api/payroll", [payrollRepo](const httplib::Request& req, httplib::Response& res) {
        if (!req.has_param("month")) {
            sendError(res, "Missing parameter: month", 400);
            return;
        }
        std::string month = req.get_param_value("month");
        auto records = payrollRepo->getByMonth(month);

        double totalBase = 0.0;
        double totalLossOfPay = 0.0;
        double totalNet = 0.0;
        double totalPresent = 0.0;
        double totalCasual = 0.0;
        double totalAbsent = 0.0;

        json recordsArr = json::array();
        for (const auto& r : records) {
            recordsArr.push_back(r.toJson());
            totalBase += r.getBaseSalary();
            totalLossOfPay += r.getLossOfPay();
            totalNet += r.getNetSalary();
            totalPresent += r.getPresentDays();
            totalCasual += r.getCasualLeaveDays();
            totalAbsent += r.getAbsentDays();
        }

        json summary = {
            {"month", month},
            {"employeeCount", static_cast<int>(records.size())},
            {"totalBaseSalary", PayrollCalculator::round2(totalBase)},
            {"totalLossOfPay", PayrollCalculator::round2(totalLossOfPay)},
            {"totalNetSalary", PayrollCalculator::round2(totalNet)},
            {"totalPresentDays", totalPresent},
            {"totalCasualLeaveDays", totalCasual},
            {"totalAbsentDays", totalAbsent}
        };

        sendJson(res, {
            {"month", month},
            {"records", recordsArr},
            {"summary", summary}
        });
    });

    // GET /api/payroll/record?month=...&employeeId=...
    svr.Get("/api/payroll/record", [payrollRepo](const httplib::Request& req, httplib::Response& res) {
        if (!req.has_param("month") || !req.has_param("employeeId")) {
            sendError(res, "Missing parameters: month, employeeId", 400);
            return;
        }
        std::string month = req.get_param_value("month");
        std::string empId = req.get_param_value("employeeId");

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

            if (month.empty() || empId.empty()) {
                sendError(res, "Missing month or employeeId", 400);
                return;
            }

            auto emp = empRepo->getById(empId);
            if (!emp) {
                sendError(res, "Employee not found", 404);
                return;
            }

            PayrollRecord rec = PayrollCalculator::compute(*emp, month, present, casual, absent);
            if (payrollRepo->saveRecord(rec)) {
                Logger::info("Saved payroll for " + empId + " (" + month + ")");
                triggerExcelSync();
                sendJson(res, rec.toJson());
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

                auto emp = empRepo->getById(empId);
                if (emp) {
                    computed.push_back(PayrollCalculator::compute(*emp, month, present, casual, absent));
                }
            }

            if (payrollRepo->saveBatch(month, computed)) {
                Logger::info("Batch saved " + std::to_string(computed.size()) + " records for " + month);
                triggerExcelSync();
                sendJson(res, {
                    {"success", true},
                    {"month", month},
                    {"savedCount", static_cast<int>(computed.size())}
                });
            } else {
                sendError(res, "Failed to save batch payroll", 500);
            }
        } catch (const std::exception& e) {
            sendError(res, "Invalid JSON: " + std::string(e.what()), 400);
        }
    });

    // GET /api/payroll/months
    svr.Get("/api/payroll/months", [payrollRepo](const httplib::Request&, httplib::Response& res) {
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

