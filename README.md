# Accountant Payroll & Payslip System

A lightweight, professional Client-Server payroll web application matching the **`kgp_nav` project structure**:
- **`server/`**: Windows C++ backend using **`cpp-httplib`** (`httplib.h`) and **`nlohmann/json`** (`json.hpp`) with file-backed JSON database persistence.
- **`client/`**: Vanilla HTML5, CSS3, and ES6+ JavaScript frontend with no third-party frameworks.

---

## 🏗️ Project Structure

```
payslip/
├── build.bat                    # 1-Click build script
├── run.bat                      # 1-Click launcher (starts server & opens browser)
├── README.md                    # Project documentation
│
├── client/                      # Frontend Web Client
│   ├── index.html               # Accountant single-page dashboard
│   ├── css/
│   │   └── style.css            # Responsive layout & print media rules
│   └── js/
│       ├── api.js               # OOP ApiClient
│       ├── employees.js         # Employee Manager (Add / Remove)
│       ├── payroll-single.js    # Single Entry (Form View with live calculation)
│       ├── payroll-bulk.js      # Multiple Tabular Entry (Spreadsheet Grid)
│       ├── salary-sheet.js      # Central Salary Sheet & Excel/CSV export
│       ├── payslip.js           # Individual Printable Payslips
│       └── app.js               # Main tab coordinator
│
└── server/                      # C++ Backend Server
    ├── CMakeLists.txt           # CMake build config
    ├── payroll_server.exe       # Compiled 64-bit Windows binary
    ├── data/                    # JSON database storage
    │   ├── employees.json       # Employee master records
    │   └── payroll.json         # Monthly payroll registers
    ├── include/
    │   ├── httplib.h            # Single-header HTTP library
    │   ├── nlohmann/json.hpp    # Single-header JSON library
    │   ├── server.h             # Server runner declaration
    │   ├── models/              # Employee & PayrollRecord entities
    │   ├── repositories/        # JSON repository interfaces & implementations
    │   ├── services/            # Payroll calculation service
    │   └── utils/               # FileUtils & Logger
    └── src/
        ├── main.cpp             # Server entrypoint
        ├── server.cpp           # httplib routes & client/ mount
        ├── models/              # Entity implementations
        ├── repositories/        # Repository implementations
        ├── services/            # Calculator logic
        └── utils/               # Utilities
```

---

## 🚀 Quick Start on Windows

### 1-Click Run
Double-click [**`run.bat`**](file:///f:/portfolio/projects/payslip/run.bat).

It will:
1. Start `server\payroll_server.exe` on port `8080`.
2. Automatically mount the `client/` frontend.
3. Open your browser to **`http://localhost:8080`**.

### To Recompile
Double-click [**`build.bat`**](file:///f:/portfolio/projects/payslip/build.bat) from the root folder.

---

## 💼 Core Features
1. **Multiple Tabular Entry (Spreadsheet Mode)**: Bulk-entry table for all staff with Present, Casual (Paid), and Absent (LOP) days, Quick Fill, and single-click Save All.
2. **Single Entry Form**: Dropdown employee selection with real-time live preview calculation.
3. **Central Salary Sheet**: Master payroll register with grand totals, **Export to Excel / CSV**, and **Print Landscape**.
4. **Individual Payslips**: Professional printable salary slip with **Amount in Words**, Signatures, and **Print / Save as PDF**.
5. **Employee Directory**: Add and Remove staff members with monthly base salary.
