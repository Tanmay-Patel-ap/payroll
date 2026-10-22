#pragma once

#include <string>
#include <memory>
#include "repositories/IEmployeeRepository.hpp"
#include "repositories/IPayrollRepository.hpp"

struct ServerConfig {
    std::string host = "0.0.0.0";
    int         port = 8080;
};

void runServer(
    const ServerConfig& config,
    std::shared_ptr<IEmployeeRepository> empRepo,
    std::shared_ptr<IPayrollRepository> payrollRepo
);

