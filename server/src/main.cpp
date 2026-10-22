#include "server.h"
#include "repositories/JsonEmployeeRepository.hpp"
#include "repositories/JsonPayrollRepository.hpp"
#include "utils/FileUtils.hpp"
#include "utils/Logger.hpp"

int main(int argc, char* argv[]) {
    ServerConfig config;
    config.host = "127.0.0.1";
    config.port = 8080;

    if (argc > 1) {
        try {
            config.port = std::stoi(argv[1]);
        } catch (...) {
            Logger::warn("Invalid port provided, falling back to 8080");
        }
    }

    std::string dataDir = "data";
    if (!FileUtils::fileExists("data") && FileUtils::fileExists("server/data")) {
        dataDir = "server/data";
    }
    FileUtils::ensureDirectoryExists(dataDir);

    auto employeeRepo = std::make_shared<JsonEmployeeRepository>(dataDir + "/employees.json");
    auto payrollRepo = std::make_shared<JsonPayrollRepository>(dataDir + "/payroll.json");

    // Perform initial Excel synchronization on start
    std::system("python server/excel_sync.py 2>nul || python excel_sync.py 2>nul");

    runServer(config, employeeRepo, payrollRepo);

    return 0;
}
