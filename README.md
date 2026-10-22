# Accountant Payroll & Payslip System (Windows)

A fast, lightweight, and professional Client-Server payroll web application built natively for **Windows**:
- **Organization**: **STIFLINK MANAGEMENT (OPC) PVT. LTD**
- **Address**: `OFFICE NO. 301 FIFTH FLOOR, ADHARHSILA COMPLEX, GANDHI MAIDAN, PATNA, BIHAR 800001.`
- **Backend**: C++ using **`cpp-httplib`** (`httplib.h`) and **`nlohmann/json`** (`json.hpp`) with automated Excel workbook synchronization.
- **Frontend**: Vanilla HTML5, CSS3, and ES6+ JavaScript client (clean modular distribution, zero external dependencies).

---

## 📁 Data & Excel Storage Structure

The `data/` directory organizes all accounting and payroll records in Excel format:

```
payslip/
├── data/
│   ├── employee_info.xlsx           # 1. Master Excel sheet with all employee profiles & salaries
│   │
│   ├── central payroll/             # 2. Central monthly registers
│   │   └── SALARY SHEET 26-27.xlsx  # Workbook for FY 26-27
│   │                                # Tabs: 'APRIL 2026', 'MAY 2026', ... up to current started month
│   │                                # (New month sheets are created only when that month begins)
│   │
│   └── individual payrolls/         # 3. Individual employee salary slips
│       └── 26-27/                   # Financial Year folder
│           ├── APRIL 2026/          # Individual .xlsx payslips for April 2026
│           │   ├── EMP001_John_Doe_Payslip.xlsx
│           │   ├── EMP002_Sarah_Smith_Payslip.xlsx
│           │   └── ...
│           ├── MAY 2026/
│           ├── JUNE 2026/
│           ├── JULY 2026/
│           ├── AUGUST 2026/
│           ├── SEPTEMBER 2026/
│           └── OCTOBER 2026/
│
├── client/                          # Frontend Web Client
│   ├── index.html                   # Accountant dashboard shell
│   ├── css/style.css                # Responsive styles & print layout
│   └── js/                          # Modular Vanilla JavaScript
│
├── server/                          # C++ Backend Server
│   ├── payroll_server.exe           # Pre-compiled Windows 64-bit binary
│   ├── excel_sync.py                # Automated Excel synchronization engine
│   ├── include/                     # Headers (httplib.h, json.hpp, models, repos)
│   ├── src/                         # Server and model implementations
│   └── data/                        # Internal JSON persistence storage
│
├── build.bat                        # 1-Click compiler script
└── run.bat                          # 1-Click launcher
```

---

## 🚀 How to Run

Double-click [**`run.bat`**](file:///f:/portfolio/projects/payslip/run.bat) to:
1. Start `server\payroll_server.exe` on port `8080`.
2. Automatically sync Excel workbooks with the web database.
3. Open **`http://localhost:8080`** in your default web browser.

---

## 💼 Automated Excel Synchronization

Whenever you add or remove employees or save payroll entries (via **Tabular Bulk Entry** or **Single Entry Form**):
- `data/employee_info.xlsx` is automatically updated.
- `data/central payroll/SALARY SHEET [FY].xlsx` is updated with the monthly tab and totals row.
- `data/individual payrolls/[FY]/[MONTH]/` receives individual employee `.xlsx` salary slips with attendance summary, earnings, deductions, and Net Salary in words!
