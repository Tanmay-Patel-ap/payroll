import os
import sys
import json
import datetime
import time
import subprocess
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

try:
    from pdf_generator import generate_payslip_pdf, compute_record_hash, is_attendance_green
except ImportError:
    from server.pdf_generator import generate_payslip_pdf, compute_record_hash, is_attendance_green

COMPANY_NAME = "STIFLINK MANAGEMENT (OPC) PVT. LTD"
COMPANY_ADDRESS = "OFFICE NO. 301 FIFTH FLOOR, ADHARHSILA COMPLEX, GANDHI MAIDAN, PATNA, BIHAR 800001."

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
CENTRAL_DIR = os.path.join(DATA_DIR, "central payroll")
INDIVIDUAL_DIR = os.path.join(DATA_DIR, "individual payrolls")

# Resolve JSON paths whether run from server dir or root dir
def find_data_file(filename):
    candidates = [
        os.path.join(SCRIPT_DIR, "data", filename),
        os.path.join(ROOT_DIR, "server", "data", filename),
        os.path.join(ROOT_DIR, "data", filename)
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return os.path.join(SCRIPT_DIR, "data", filename)

EMPLOYEES_JSON = find_data_file("employees.json")
PAYROLL_JSON = find_data_file("payroll.json")
ROLES_JSON = find_data_file("roles.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CENTRAL_DIR, exist_ok=True)
os.makedirs(INDIVIDUAL_DIR, exist_ok=True)

def force_close_excel():
    """Force close Microsoft Excel or other spreadsheet processes if they hold open locks on the files."""
    if os.name == 'nt':
        try:
            subprocess.run(
                ["taskkill", "/F", "/IM", "EXCEL.EXE"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=3.0
            )
        except Exception:
            pass
        time.sleep(0.6)

def safe_save_workbook(wb, file_path, max_attempts=3):
    """
    Saves the workbook directly to file_path.
    If the file is open and locked by Excel, it attempts to overwrite.
    If locked by another process (user editing in Excel), it warns cleanly without hanging.
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    for attempt in range(1, max_attempts + 1):
        try:
            wb.save(file_path)
            print(f"[Sync] Updated {file_path}")
            return True
        except PermissionError:
            if attempt == 1:
                force_close_excel()
            elif attempt == 2:
                time.sleep(0.8)
            else:
                print(f"[Sync WARN] File '{file_path}' is currently open in Excel. Changes will sync once closed.", file=sys.stderr)
                return False
        except Exception as e:
            print(f"[Sync ERROR] Attempt {attempt} failed to save '{file_path}': {e}", file=sys.stderr)
            return False

    return False

# Styling Constants
FONT_TITLE = Font(name="Calibri", size=15, bold=True, color="1E3A8A")
FONT_SUBTITLE = Font(name="Calibri", size=9, bold=False, color="475569")
FONT_HEADER = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
FONT_BOLD = Font(name="Calibri", size=10, bold=True, color="0F172A")
FONT_REGULAR = Font(name="Calibri", size=10, color="0F172A")
FONT_SMALL_BOLD = Font(name="Calibri", size=9, bold=True, color="475569")

FILL_HEADER = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
FILL_DEDUCT_HEADER = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
FILL_TOTAL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
FILL_HIGHLIGHT = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")

BORDER_THIN = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

BORDER_TOTAL = Border(
    top=Side(style='thin', color='1E3A8A'),
    bottom=Side(style='double', color='1E3A8A')
)

def clean_str(val):
    if val is None:
        return ""
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    return str(val).strip()

def clean_float(val, default=0.0):
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace('₹', '').replace(',', '').strip()
    try:
        return float(s)
    except ValueError:
        return default

def import_employee_info():
    excel_path = os.path.join(DATA_DIR, "employee_info.xlsx")
    if not os.path.exists(excel_path):
        print(f"[Sync] {excel_path} not found on disk. Clearing employee and role database.")
        with open(EMPLOYEES_JSON, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        with open(ROLES_JSON, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    try:
        wb = openpyxl.load_workbook(excel_path, data_only=True)
    except Exception as e:
        print(f"[Sync ERROR] Could not open {excel_path}: {e}", file=sys.stderr)
        return

    employees = []
    if "Employee Master" in wb.sheetnames:
        ws = wb["Employee Master"]

        # Determine column mappings from row 5 header
        col_map = {
            "id": 1, "name": 2, "desig": 3, "salary": 4, "email": 5, "phone": 6,
            "joinDate": 7, "leaveDate": 8, "bankName": 9, "bankAccountNo": 10,
            "bankIfscCode": 11, "panTaxNo": 12
        }
        for c in range(1, ws.max_column + 1):
            hdr = clean_str(ws.cell(row=5, column=c).value).lower()
            if "leav" in hdr or "exit" in hdr or "reliev" in hdr:
                col_map["leaveDate"] = c
            elif "join" in hdr or "doj" in hdr:
                col_map["joinDate"] = c
            elif "bank name" in hdr:
                col_map["bankName"] = c
            elif "a/c" in hdr or "account" in hdr:
                col_map["bankAccountNo"] = c
            elif "ifsc" in hdr:
                col_map["bankIfscCode"] = c
            elif "pan" in hdr:
                col_map["panTaxNo"] = c
            elif "salary" in hdr:
                col_map["salary"] = c
            elif "email" in hdr:
                col_map["email"] = c
            elif "phone" in hdr or "mobile" in hdr:
                col_map["phone"] = c
            elif "desig" in hdr or "role" in hdr:
                col_map["desig"] = c
            elif "name" in hdr and "bank" not in hdr:
                col_map["name"] = c
            elif "id" in hdr and "emp" in hdr:
                col_map["id"] = c

        for row_idx in range(6, ws.max_row + 1):
            emp_id = clean_str(ws.cell(row=row_idx, column=col_map["id"]).value)
            emp_name = clean_str(ws.cell(row=row_idx, column=col_map["name"]).value)
            if not emp_id and not emp_name:
                continue

            desig = clean_str(ws.cell(row=row_idx, column=col_map["desig"]).value) or "Staff"
            salary = clean_float(ws.cell(row=row_idx, column=col_map["salary"]).value, 0.0)
            email = clean_str(ws.cell(row=row_idx, column=col_map["email"]).value)
            phone = clean_str(ws.cell(row=row_idx, column=col_map["phone"]).value)

            raw_doj = ws.cell(row=row_idx, column=col_map["joinDate"]).value
            if isinstance(raw_doj, (datetime.datetime, datetime.date)):
                doj_str = raw_doj.strftime("%Y-%m-%d")
            else:
                doj_str = clean_str(raw_doj) or "2024-04-01"

            leave_str = ""
            if col_map.get("leaveDate"):
                raw_leave = ws.cell(row=row_idx, column=col_map["leaveDate"]).value
                if isinstance(raw_leave, (datetime.datetime, datetime.date)):
                    leave_str = raw_leave.strftime("%Y-%m-%d")
                else:
                    leave_str = clean_str(raw_leave)

            bank_name = clean_str(ws.cell(row=row_idx, column=col_map["bankName"]).value)
            bank_acc = clean_str(ws.cell(row=row_idx, column=col_map["bankAccountNo"]).value)
            bank_ifsc = clean_str(ws.cell(row=row_idx, column=col_map["bankIfscCode"]).value)
            pan = clean_str(ws.cell(row=row_idx, column=col_map["panTaxNo"]).value)

            is_active = not bool(leave_str.strip())

            employees.append({
                "id": emp_id,
                "name": emp_name,
                "designation": desig,
                "salary": salary,
                "monthlySalary": salary,
                "baseSalary": salary,
                "email": email,
                "phone": phone,
                "joinDate": doj_str,
                "leaveDate": leave_str,
                "bankName": bank_name,
                "bankAccountNo": bank_acc,
                "bankIfscCode": bank_ifsc,
                "panTaxNo": pan,
                "isActive": is_active
            })

    roles = []
    if "Roles" in wb.sheetnames:
        ws_r = wb["Roles"]
        for row_idx in range(6, ws_r.max_row + 1):
            r_id = clean_str(ws_r.cell(row=row_idx, column=1).value)
            r_name = clean_str(ws_r.cell(row=row_idx, column=2).value)
            r_sal = clean_float(ws_r.cell(row=row_idx, column=3).value, 0.0)
            if not r_id and not r_name:
                continue
            roles.append({
                "id": r_id,
                "name": r_name,
                "salary": r_sal
            })

    with open(EMPLOYEES_JSON, "w", encoding="utf-8") as f:
        json.dump(employees, f, indent=2)
    with open(ROLES_JSON, "w", encoding="utf-8") as f:
        json.dump(roles, f, indent=2)

    print(f"[Sync] Successfully imported {len(employees)} employees and {len(roles)} roles from {excel_path} -> JSON database.")

def import_payrolls():
    if not os.path.exists(CENTRAL_DIR):
        with open(PAYROLL_JSON, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    excel_files = [
        os.path.join(CENTRAL_DIR, f)
        for f in os.listdir(CENTRAL_DIR)
        if f.lower().endswith(".xlsx") and not f.startswith("~$")
    ]

    if not excel_files:
        with open(PAYROLL_JSON, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)
        return

    all_records = []
    for file_path in excel_files:
        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
        except Exception as e:
            print(f"[Sync WARN] Failed to open {file_path}: {e}", file=sys.stderr)
            continue

        for sheet_name in wb.sheetnames:
            if "_tmp" in sheet_name:
                continue
            ws = wb[sheet_name]
            parts = sheet_name.strip().split()
            if len(parts) >= 2:
                month_display = f"{parts[0].capitalize()} {parts[1]}"
            else:
                month_display = sheet_name.strip().title()

            has_earned_col = (ws.max_column >= 20 and "earned" in clean_str(ws.cell(row=5, column=16).value).lower())

            for row_idx in range(6, ws.max_row + 1):
                col3_val = clean_str(ws.cell(row=row_idx, column=3).value)
                if col3_val.startswith("GRAND TOTALS") or col3_val.startswith("TOTALS"):
                    break

                emp_id = clean_str(ws.cell(row=row_idx, column=2).value)
                emp_name = clean_str(ws.cell(row=row_idx, column=3).value)
                if not emp_id and not emp_name:
                    continue

                desig = clean_str(ws.cell(row=row_idx, column=4).value) or "Staff"
                bank_name = clean_str(ws.cell(row=row_idx, column=5).value)
                bank_acc = clean_str(ws.cell(row=row_idx, column=6).value)
                bank_ifsc = clean_str(ws.cell(row=row_idx, column=7).value)
                pan = clean_str(ws.cell(row=row_idx, column=8).value)

                monthly_sal = clean_float(ws.cell(row=row_idx, column=9).value, 0.0)
                present_days = clean_float(ws.cell(row=row_idx, column=10).value, 0.0)
                casual_days = clean_float(ws.cell(row=row_idx, column=11).value, 0.0)
                absent_days = clean_float(ws.cell(row=row_idx, column=12).value, 0.0)
                sundays = clean_float(ws.cell(row=row_idx, column=13).value, 4.0)
                paid_days = clean_float(ws.cell(row=row_idx, column=14).value, present_days + casual_days + sundays)
                tot_days = clean_float(ws.cell(row=row_idx, column=15).value, 30.0)

                calc_gross = round((paid_days / tot_days) * monthly_sal, 2) if tot_days > 0 else 0.0
                if has_earned_col:
                    raw_gross = clean_float(ws.cell(row=row_idx, column=17).value, 0.0)
                    gross_sal = raw_gross if raw_gross > 0.0 and abs(raw_gross - calc_gross) <= 0.05 else calc_gross
                    adv_deducted = clean_float(ws.cell(row=row_idx, column=18).value, 0.0)
                    remarks = clean_str(ws.cell(row=row_idx, column=20).value) or ""
                else:
                    raw_gross = clean_float(ws.cell(row=row_idx, column=16).value, 0.0)
                    gross_sal = raw_gross if raw_gross > 0.0 and abs(raw_gross - calc_gross) <= 0.05 else calc_gross
                    adv_deducted = clean_float(ws.cell(row=row_idx, column=17).value, 0.0)
                    remarks = clean_str(ws.cell(row=row_idx, column=19).value) or ""

                net_sal = max(0.0, round(gross_sal - adv_deducted, 2))

                all_records.append({
                    "month": month_display,
                    "employeeId": emp_id,
                    "employeeName": emp_name,
                    "designation": desig,
                    "bankName": bank_name,
                    "bankAccountNo": bank_acc,
                    "bankIfscCode": bank_ifsc,
                    "panTaxNo": pan,
                    "monthlySalary": monthly_sal,
                    "totalDays": int(tot_days),
                    "presentDays": present_days,
                    "casualLeaveDays": casual_days,
                    "sundays": sundays,
                    "absentDays": absent_days,
                    "paidDays": paid_days,
                    "earnedSalary": gross_sal,
                    "grossSalary": gross_sal,
                    "lossOfPay": 0.0,
                    "advanceDeducted": adv_deducted,
                    "totalDeductions": adv_deducted,
                    "netSalary": net_sal,
                    "remarks": remarks
                })

    with open(PAYROLL_JSON, "w", encoding="utf-8") as f:
        json.dump(all_records, f, indent=2)

    print(f"[Sync] Successfully imported {len(all_records)} payroll records from central payroll workbooks -> JSON database.")

def number_to_words(n):
    num = int(round(n))
    if num == 0: return 'Zero'
    a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
         'Seventeen', 'Eighteen', 'Nineteen']
    b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

    def words(val):
        if val < 20: return a[val]
        if val < 100: return b[val // 10] + ('' if val % 10 == 0 else ' ' + a[val % 10])
        if val < 1000: return a[val // 100] + ' Hundred' + ('' if val % 100 == 0 else ' and ' + words(val % 100))
        if val < 100000: return words(val // 1000) + ' Thousand' + ('' if val % 1000 == 0 else ' ' + words(val % 1000))
        if val < 10000000: return words(val // 100000) + ' Lakh' + ('' if val % 100000 == 0 else ' ' + words(val % 100000))
        return words(val // 10000000) + ' Crore' + ('' if val % 10000000 == 0 else ' ' + words(val % 10000000))

    return words(num) + ' Rupees Only'

def get_financial_year(year, month):
    if month >= 4:
        y1 = year % 100
        y2 = (year + 1) % 100
    else:
        y1 = (year - 1) % 100
        y2 = year % 100
    return f"{y1:02d}-{y2:02d}"

def sync_employee_info():
    if not os.path.exists(EMPLOYEES_JSON):
        return
    with open(EMPLOYEES_JSON, "r", encoding="utf-8") as f:
        employees = json.load(f)

    # Load roles if available
    roles = []
    if os.path.exists(ROLES_JSON):
        try:
            with open(ROLES_JSON, "r", encoding="utf-8") as f:
                roles = json.load(f)
        except Exception as e:
            print(f"[Sync WARN] Could not load roles.json: {e}", file=sys.stderr)

    wb = openpyxl.Workbook()

    # =============================================================
    # SHEET 1: Employee Master
    # =============================================================
    ws = wb.active
    ws.title = "Employee Master"

    headers = [
        "Emp ID", "Full Name", "Designation", "Monthly Salary (₹)",
        "Email", "Phone", "Date of Joining", "Date of Leaving", "Bank Name", "Bank A/C No", "IFSC Code", "PAN Number"
    ]

    ws.merge_cells("A1:L1")
    ws["A1"] = COMPANY_NAME
    ws["A1"].font = FONT_TITLE
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:L2")
    ws["A2"] = COMPANY_ADDRESS
    ws["A2"].font = FONT_SUBTITLE
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A3:L3")
    ws["A3"] = "EMPLOYEE MASTER DIRECTORY (DATABASE)"
    ws["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
    ws["A3"].alignment = Alignment(horizontal="center", vertical="center")

    ws.append([])
    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=5, column=col_idx)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for emp in employees:
        salary_val = float(emp.get("salary") or emp.get("monthlySalary") or emp.get("baseSalary") or 0.0)
        ws.append([
            emp.get("id", ""),
            emp.get("name", ""),
            emp.get("designation", "Staff"),
            salary_val,
            emp.get("email", ""),
            emp.get("phone", ""),
            emp.get("joinDate", "2024-04-01"),
            emp.get("leaveDate", "") or "",
            emp.get("bankName", ""),
            emp.get("bankAccountNo", ""),
            emp.get("bankIfscCode", ""),
            emp.get("panTaxNo", "")
        ])

    for row in ws.iter_rows(min_row=6, max_row=5 + len(employees), min_col=1, max_col=len(headers)):
        for cell in row:
            cell.font = FONT_REGULAR
            cell.border = BORDER_THIN
            if cell.column == 4:
                cell.number_format = '₹#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            elif cell.column in [1, 7, 8, 11, 12]:
                cell.alignment = Alignment(horizontal="center")

    for col in ws.iter_cols(min_row=5, max_row=5 + len(employees), min_col=1, max_col=len(headers)):
        max_len = 0
        for cell in col:
            val_str = ""
            if cell.value is not None:
                if isinstance(cell.value, float):
                    val_str = f"₹{cell.value:,.2f}" if cell.column == 4 else f"{cell.value:.2f}"
                else:
                    val_str = str(cell.value)
            if len(val_str) > max_len:
                max_len = len(val_str)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 15)

    # =============================================================
    # SHEET 2: Roles (Company Designation & Salary Hierarchy)
    # =============================================================
    ws_roles = wb.create_sheet(title="Roles")

    role_headers = [
        "Role ID", "Role Title / Designation", "Monthly Base Salary (₹)"
    ]

    ws_roles.merge_cells("A1:C1")
    ws_roles["A1"] = COMPANY_NAME
    ws_roles["A1"].font = FONT_TITLE
    ws_roles["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws_roles.merge_cells("A2:C2")
    ws_roles["A2"] = COMPANY_ADDRESS
    ws_roles["A2"].font = FONT_SUBTITLE
    ws_roles["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws_roles.merge_cells("A3:C3")
    ws_roles["A3"] = "COMPANY ROLES & FIXED SALARY STRUCTURE (DATABASE)"
    ws_roles["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
    ws_roles["A3"].alignment = Alignment(horizontal="center", vertical="center")

    ws_roles.append([])
    ws_roles.append(role_headers)

    for col_idx in range(1, len(role_headers) + 1):
        cell = ws_roles.cell(row=5, column=col_idx)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for r in roles:
        sal = float(r.get("salary", 0.0))
        ws_roles.append([
            r.get("id", ""),
            r.get("name", ""),
            sal
        ])

    for row in ws_roles.iter_rows(min_row=6, max_row=5 + len(roles), min_col=1, max_col=len(role_headers)):
        for cell in row:
            cell.font = FONT_REGULAR
            cell.border = BORDER_THIN
            if cell.column == 3:
                cell.number_format = '₹#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            elif cell.column == 1:
                cell.alignment = Alignment(horizontal="center")

    for col in ws_roles.iter_cols(min_row=5, max_row=5 + len(roles), min_col=1, max_col=len(role_headers)):
        max_len = 0
        for cell in col:
            val_str = ""
            if cell.value is not None:
                if isinstance(cell.value, float):
                    val_str = f"₹{cell.value:,.2f}" if cell.column == 3 else f"{cell.value:.2f}"
                else:
                    val_str = str(cell.value)
            if len(val_str) > max_len:
                max_len = len(val_str)
        col_letter = get_column_letter(col[0].column)
        ws_roles.column_dimensions[col_letter].width = max(max_len + 4, 15)

    target_path = os.path.join(DATA_DIR, "employee_info.xlsx")
    safe_save_workbook(wb, target_path)

def sync_payrolls():
    if not os.path.exists(PAYROLL_JSON):
        return
    with open(PAYROLL_JSON, "r", encoding="utf-8") as f:
        records = json.load(f)

    records_by_fy = {}
    now = datetime.datetime.now()

    for r in records:
        month_str = r.get("month", "").strip()
        if not month_str:
            continue
        parts = month_str.split()
        if len(parts) >= 2:
            m_name_part = parts[0].upper()
            try:
                year_part = int(parts[1])
            except ValueError:
                year_part = now.year
        else:
            m_name_part = month_str.upper()
            year_part = now.year

        try:
            m_num = datetime.datetime.strptime(m_name_part[:3], "%b").month
        except:
            m_num = 10

        fy = get_financial_year(year_part, m_num)
        sheet_name = f"{m_name_part} {year_part}"

        if fy not in records_by_fy:
            records_by_fy[fy] = {}
        if sheet_name not in records_by_fy[fy]:
            records_by_fy[fy][sheet_name] = []
        records_by_fy[fy][sheet_name].append(r)

    headers = [
        "S.No", "Emp ID", "Employee Name", "Designation",
        "Bank Name", "A/C Number", "IFSC", "PAN",
        "Monthly Salary (₹)", "Present", "Casual", "Absent Days", "Sundays", "Paid Days", "Total Days",
        "Gross Salary (₹)",
        "Advance Deducted (₹)", "Net Salary Payable (₹)",
        "Remarks"
    ]

    # Dynamic Financial Years: Base start year 2026 ('26-27') up to current/upcoming FY
    cur_fy_start = now.year if now.month >= 4 else (now.year - 1)
    max_fy_start = max(2026, cur_fy_start)
    target_fys = set(records_by_fy.keys())
    for y in range(2026, max_fy_start + 1):
        target_fys.add(f"{y % 100:02d}-{(y + 1) % 100:02d}")
    target_fys = sorted([f for f in target_fys if f >= "26-27"])

    for fy in target_fys:
        months_dict = records_by_fy.get(fy, {})
        central_file = os.path.join(CENTRAL_DIR, f"SALARY SHEET {fy}.xlsx")
        if os.path.exists(central_file):
            wb = openpyxl.load_workbook(central_file)
        else:
            wb = openpyxl.Workbook()
            if not months_dict:
                start_year = 2000 + int(fy.split('-')[0])
                ws_init = wb.active
                ws_init.title = f"APRIL {start_year}"
                ws_init.merge_cells("A1:S1")
                ws_init["A1"] = COMPANY_NAME
                ws_init["A1"].font = FONT_TITLE
                ws_init["A1"].alignment = Alignment(horizontal="center", vertical="center")
                ws_init.merge_cells("A2:S2")
                ws_init["A2"] = COMPANY_ADDRESS
                ws_init["A2"].font = FONT_SUBTITLE
                ws_init["A2"].alignment = Alignment(horizontal="center", vertical="center")
                ws_init.merge_cells("A3:S3")
                ws_init["A3"] = f"CENTRAL SALARY REGISTER — APRIL {start_year} (FY {fy})"
                ws_init["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
                ws_init["A3"].alignment = Alignment(horizontal="center", vertical="center")
                ws_init.append([])
                ws_init.append(headers)
                for col_idx in range(1, len(headers) + 1):
                    cell = ws_init.cell(row=5, column=col_idx)
                    cell.font = FONT_HEADER
                    cell.fill = FILL_HEADER
                    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                for col in ws_init.columns:
                    col_letter = get_column_letter(col[0].column)
                    ws_init.column_dimensions[col_letter].width = 15
            else:
                wb.remove(wb.active)

        for sheet_title, recs in months_dict.items():
            if sheet_title in wb.sheetnames:
                # Replace existing sheet cleanly to clear old ranges and styling
                ws = wb.create_sheet(title=sheet_title + "_tmp")
                del wb[sheet_title]
                ws.title = sheet_title
            else:
                ws = wb.create_sheet(title=sheet_title)

            ws.merge_cells("A1:S1")
            ws["A1"] = COMPANY_NAME
            ws["A1"].font = FONT_TITLE
            ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

            ws.merge_cells("A2:S2")
            ws["A2"] = COMPANY_ADDRESS
            ws["A2"].font = FONT_SUBTITLE
            ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

            ws.merge_cells("A3:S3")
            ws["A3"] = f"CENTRAL SALARY REGISTER — {sheet_title} (FY {fy})"
            ws["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
            ws["A3"].alignment = Alignment(horizontal="center", vertical="center")

            ws.append([])
            ws.append(headers)

            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=5, column=col_idx)
                cell.font = FONT_HEADER
                cell.fill = FILL_HEADER
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

            row_start = 6
            for idx, r in enumerate(recs):
                total_days = r.get("totalDays", 30.0)
                monthly_sal = float(r.get("monthlySalary") or r.get("salary") or 0.0)
                sundays = r.get("sundays", 4.0)
                paid_days = r.get("paidDays", 0.0)
                if paid_days <= 0.0:
                    paid_days = r.get("presentDays", 0.0) + r.get("casualLeaveDays", 0.0) + sundays

                earned_sal = round((paid_days / total_days) * monthly_sal, 2) if total_days > 0 else 0.0
                gross = earned_sal
                advance = float(r.get("advanceDeducted", 0.0))
                net_sal = max(0.0, gross - advance)

                ws.append([
                    idx + 1,
                    r.get("employeeId", ""),
                    r.get("employeeName", ""),
                    r.get("designation", "Staff"),
                    r.get("bankName", ""),
                    r.get("bankAccountNo", ""),
                    r.get("bankIfscCode", ""),
                    r.get("panTaxNo", ""),
                    monthly_sal,
                    r.get("presentDays", 0.0),
                    r.get("casualLeaveDays", 0.0),
                    r.get("absentDays", 0.0),
                    sundays,
                    paid_days,
                    total_days,
                    gross,
                    advance,
                    net_sal,
                    r.get("remarks", "")
                ])

            row_end = row_start + len(recs) - 1

            for row in ws.iter_rows(min_row=row_start, max_row=row_end, min_col=1, max_col=len(headers)):
                for cell in row:
                    cell.font = FONT_REGULAR
                    cell.border = BORDER_THIN
                    if cell.column in [9, 16, 17, 18]:
                        cell.number_format = '₹#,##0.00'
                        cell.alignment = Alignment(horizontal="right")
                    elif cell.column in [1, 2, 6, 7, 8, 10, 11, 12, 13, 14, 15]:
                        cell.alignment = Alignment(horizontal="center")

            # Clean up any trailing rows after the staff list (no grand totals row)
            if ws.max_row > row_end:
                for r in range(row_end + 1, ws.max_row + 1):
                    for c in range(1, len(headers) + 1):
                        cell = ws.cell(row=r, column=c)
                        cell.value = None
                        cell.fill = PatternFill(fill_type=None)
                        cell.border = Border()

            for c_idx in range(1, len(headers) + 1):
                ws.column_dimensions[get_column_letter(c_idx)].width = 16

        safe_save_workbook(wb, central_file)

        # Synchronize Individual Payslips (PDF ONLY - No individual Excel files)
        # Condition 1: Do not create individual Excels.
        # Condition 2: If status is green (attendance complete), automatically generate PDF into designated space.
        # Condition 3: If already existing, replace it ONLY if there is any change in that report.
        fy_folder = os.path.join(INDIVIDUAL_DIR, fy)
        for sheet_title, recs in months_dict.items():
            month_folder = os.path.join(fy_folder, sheet_title)
            os.makedirs(month_folder, exist_ok=True)

            hash_file = os.path.join(month_folder, ".payslip_hashes.json")
            hashes = {}
            if os.path.exists(hash_file):
                try:
                    with open(hash_file, "r", encoding="utf-8") as hf:
                        hashes = json.load(hf)
                except Exception:
                    hashes = {}

            hashes_changed = False
            for r in recs:
                emp_id = r.get("employeeId", "").strip()
                if not emp_id:
                    continue

                # Check if status is green (attendance equals total days in month)
                if not is_attendance_green(r):
                    continue

                curr_hash = compute_record_hash(r)
                emp_name = (r.get("employeeName") or "Employee").replace(" ", "_")
                pdf_filename = f"{emp_id}_{emp_name}_Payslip.pdf"
                pdf_path = os.path.join(month_folder, pdf_filename)

                # Check if existing PDF has changes
                if os.path.exists(pdf_path) and hashes.get(emp_id) == curr_hash:
                    # Report has not changed; keep existing file intact without replacement
                    continue

                # Generate or replace PDF
                try:
                    generate_payslip_pdf(r, pdf_path)
                    hashes[emp_id] = curr_hash
                    hashes_changed = True
                    print(f"[Sync] Saved payslip PDF for {emp_id} ({r.get('employeeName', '')}) -> {pdf_filename}")
                except Exception as e:
                    print(f"[Sync ERROR] Could not generate payslip PDF for {emp_id}: {e}", file=sys.stderr)

            if hashes_changed:
                try:
                    with open(hash_file, "w", encoding="utf-8") as hf:
                        json.dump(hashes, hf, indent=2)
                except Exception as e:
                    print(f"[Sync WARN] Could not update hashes file {hash_file}: {e}", file=sys.stderr)

        print(f"[Sync] Verified individual payslip PDFs inside {fy_folder}")

def generate_single_slip_pdf(month, emp_id, force=True):
    """
    Generates and saves the individual payslip PDF for a given employee and month
    to the designated place: data/individual payrolls/<FY>/<MONTH>/<empId>_<name>_Payslip.pdf
    If already existing, it is replaced.
    Returns the absolute path of the generated PDF.
    """
    if not month or not emp_id:
        print("[Slip PDF ERROR] Month and Employee ID are required", file=sys.stderr)
        return None

    # Load payroll records
    records = []
    if os.path.exists(PAYROLL_JSON):
        try:
            with open(PAYROLL_JSON, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception:
            records = []

    # Load employees for metadata
    employees = []
    if os.path.exists(EMPLOYEES_JSON):
        try:
            with open(EMPLOYEES_JSON, "r", encoding="utf-8") as f:
                employees = json.load(f)
        except Exception:
            employees = []

    emp_meta = next((e for e in employees if e.get("id") == emp_id), {})

    # Find matching payroll record
    rec = next((r for r in records if r.get("month", "").strip().lower() == month.strip().lower() and r.get("employeeId") == emp_id), None)

    parts = month.strip().split()
    now = datetime.datetime.now()
    if len(parts) >= 2:
        m_name_part = parts[0].upper()
        try:
            year_part = int(parts[1])
        except ValueError:
            year_part = now.year
    else:
        m_name_part = month.strip().upper()
        year_part = now.year

    try:
        m_num = datetime.datetime.strptime(m_name_part[:3], "%b").month
    except Exception:
        m_num = 10

    fy = get_financial_year(year_part, m_num)
    sheet_title = f"{m_name_part} {year_part}"

    if not rec:
        # Build default record from employee data
        days_in_month = 30
        try:
            import calendar
            days_in_month = calendar.monthrange(year_part, m_num)[1]
        except Exception:
            pass

        # Calculate sundays
        sundays = 0
        try:
            import calendar
            cal = calendar.Calendar()
            for d, wd in cal.itermonthdays2(year_part, m_num):
                if d != 0 and wd == 6:
                    sundays += 1
        except Exception:
            sundays = 4

        m_sal = float(emp_meta.get("salary") or emp_meta.get("monthlySalary") or 0.0)
        rec = {
            "month": month,
            "employeeId": emp_id,
            "employeeName": emp_meta.get("name", "Employee"),
            "designation": emp_meta.get("designation", "Staff"),
            "bankName": emp_meta.get("bankName", "State Bank of India"),
            "bankAccountNo": emp_meta.get("bankAccountNo", ""),
            "bankIfscCode": emp_meta.get("bankIfscCode", ""),
            "panTaxNo": emp_meta.get("panTaxNo", ""),
            "joinDate": emp_meta.get("joinDate", "2024-04-01"),
            "monthlySalary": m_sal,
            "totalDays": days_in_month,
            "presentDays": 0.0,
            "casualLeaveDays": 0.0,
            "absentDays": 0.0,
            "sundays": sundays,
            "paidDays": sundays,
            "earnedSalary": round((sundays / days_in_month) * m_sal, 2) if days_in_month > 0 else 0.0,
            "grossSalary": round((sundays / days_in_month) * m_sal, 2) if days_in_month > 0 else 0.0,
            "advanceDeducted": 0.0,
            "netSalary": round((sundays / days_in_month) * m_sal, 2) if days_in_month > 0 else 0.0,
            "remarks": ""
        }
    else:
        # Enrich with employee info if empty
        for k in ["bankName", "bankAccountNo", "bankIfscCode", "panTaxNo", "joinDate"]:
            if not rec.get(k) and emp_meta.get(k):
                rec[k] = emp_meta[k]
        if not rec.get("joinDate"):
            rec["joinDate"] = emp_meta.get("joinDate", "2024-04-01")

    month_folder = os.path.join(INDIVIDUAL_DIR, fy, sheet_title)
    os.makedirs(month_folder, exist_ok=True)

    emp_name = (rec.get("employeeName") or "Employee").replace(" ", "_")
    pdf_filename = f"{emp_id}_{emp_name}_Payslip.pdf"
    pdf_path = os.path.join(month_folder, pdf_filename)

    # Generate and overwrite/replace
    generate_payslip_pdf(rec, pdf_path)

    # Update hash
    curr_hash = compute_record_hash(rec)
    hash_file = os.path.join(month_folder, ".payslip_hashes.json")
    hashes = {}
    if os.path.exists(hash_file):
        try:
            with open(hash_file, "r", encoding="utf-8") as hf:
                hashes = json.load(hf)
        except Exception:
            hashes = {}
    hashes[emp_id] = curr_hash
    try:
        with open(hash_file, "w", encoding="utf-8") as hf:
            json.dump(hashes, hf, indent=2)
    except Exception:
        pass

    print(f"[Slip PDF] Successfully saved to designated place: {pdf_path}")
    return pdf_path

def count_sundays(year, month):
    import calendar
    cal = calendar.Calendar()
    s = 0
    for d, wd in cal.itermonthdays2(year, month):
        if d != 0 and wd == 6:
            s += 1
    return s

def parse_ym_index(date_val, default_year=2024, default_month=4):
    if not date_val:
        return default_year * 12 + default_month
    if isinstance(date_val, (datetime.date, datetime.datetime)):
        return date_val.year * 12 + date_val.month
    try:
        s = str(date_val).strip()
        for sep in ["-", "/", "."]:
            if sep in s:
                parts = s.split(sep)
                if len(parts) >= 2:
                    if len(parts[0]) == 4:
                        return int(parts[0]) * 12 + int(parts[1])
                    elif len(parts[-1]) == 4:
                        return int(parts[-1]) * 12 + int(parts[1])
        return default_year * 12 + default_month
    except Exception:
        return default_year * 12 + default_month

def ensure_all_employees_in_sheets():
    """
    Checks every employee in employees.json / employee_info.xlsx.
    Ensures that for every month sheet from their month of joining (strictly FY 26-27 onwards),
    a row exists for the employee in the Excel file SALARY SHEET <FY>.xlsx.
    If not, it automatically adds the employee row.
    Never touches or creates FY before 26-27.
    """
    import calendar

    # Always synchronize employee_info (imports if present, clears if deleted)
    import_employee_info()

    if not os.path.exists(EMPLOYEES_JSON):
        return

    try:
        with open(EMPLOYEES_JSON, "r", encoding="utf-8") as f:
            employees = json.load(f)
    except Exception:
        employees = []

    if not employees:
        return

    # Base financial year: 2026 ('26-27')
    now = datetime.datetime.now()
    cur_fy_start = now.year if now.month >= 4 else (now.year - 1)
    max_fy_start = max(2026, cur_fy_start)

    # Strictly FY 26-27 onwards that actually exist in central payroll
    target_fys = set()
    if os.path.exists(CENTRAL_DIR):
        for fname in os.listdir(CENTRAL_DIR):
            if fname.lower().startswith("salary sheet ") and fname.lower().endswith(".xlsx") and not fname.startswith("~$"):
                fy_part = fname[len("salary sheet "):-len(".xlsx")].strip()
                if fy_part >= "26-27":
                    target_fys.add(fy_part)

    if not target_fys:
        # If central salary sheets do not exist on disk, do not recreate them automatically.
        import_payrolls()
        return

    target_fys = sorted(list(target_fys))
    emp_by_id = {emp.get("id"): emp for emp in employees if emp.get("id")}

    headers = [
        "S.No", "Emp ID", "Employee Name", "Designation",
        "Bank Name", "A/C Number", "IFSC", "PAN",
        "Monthly Salary (₹)", "Present", "Casual", "Absent Days", "Sundays", "Paid Days", "Total Days",
        "Gross Salary (₹)",
        "Advance Deducted (₹)", "Net Salary Payable (₹)",
        "Remarks"
    ]

    for fy in target_fys:
        start_year = 2000 + int(fy.split('-')[0])
        fy_months = [
            ("APRIL", start_year, 4),
            ("MAY", start_year, 5),
            ("JUNE", start_year, 6),
            ("JULY", start_year, 7),
            ("AUGUST", start_year, 8),
            ("SEPTEMBER", start_year, 9),
            ("OCTOBER", start_year, 10),
            ("NOVEMBER", start_year, 11),
            ("DECEMBER", start_year, 12),
            ("JANUARY", start_year + 1, 1),
            ("FEBRUARY", start_year + 1, 2),
            ("MARCH", start_year + 1, 3),
        ]

        central_file = os.path.join(CENTRAL_DIR, f"SALARY SHEET {fy}.xlsx")
        wb_created = False
        if os.path.exists(central_file):
            try:
                wb = openpyxl.load_workbook(central_file)
            except Exception as e:
                print(f"[Sync WARN] Failed to load {central_file}: {e}", file=sys.stderr)
                wb = openpyxl.Workbook()
                wb_created = True
        else:
            wb = openpyxl.Workbook()
            wb_created = True

        workbook_modified = wb_created

        for m_name, m_year, m_num in fy_months:
            sheet_title = f"{m_name} {m_year}"
            month_idx = m_year * 12 + m_num
            days_in_month = calendar.monthrange(m_year, m_num)[1]
            sundays = count_sundays(m_year, m_num)

            is_new_sheet = False
            if sheet_title in wb.sheetnames:
                ws = wb[sheet_title]
            else:
                if len(wb.sheetnames) == 1 and wb.sheetnames[0] == "Sheet":
                    ws = wb.active
                    ws.title = sheet_title
                else:
                    ws = wb.create_sheet(title=sheet_title)
                is_new_sheet = True

            if is_new_sheet or ws.max_row < 5:
                ws.merge_cells("A1:S1")
                ws["A1"] = COMPANY_NAME
                ws["A1"].font = FONT_TITLE
                ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

                ws.merge_cells("A2:S2")
                ws["A2"] = COMPANY_ADDRESS
                ws["A2"].font = FONT_SUBTITLE
                ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

                ws.merge_cells("A3:S3")
                ws["A3"] = f"SALARY SHEET — {sheet_title} (FY {fy})"
                ws["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
                ws["A3"].alignment = Alignment(horizontal="center", vertical="center")

                ws.cell(row=4, column=1, value="")
                for col_idx, h in enumerate(headers, 1):
                    c = ws.cell(row=5, column=col_idx, value=h)
                    c.font = FONT_HEADER
                    c.fill = FILL_HEADER
                    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                workbook_modified = True

            # 1. Purge any employee row who should NOT be in this month (outside working months)
            for r_idx in range(ws.max_row, 5, -1):
                c3 = clean_str(ws.cell(row=r_idx, column=3).value)
                if c3.startswith("GRAND TOTALS") or c3.startswith("TOTALS"):
                    continue
                eid = clean_str(ws.cell(row=r_idx, column=2).value)
                if not eid:
                    continue
                if eid in emp_by_id:
                    emp = emp_by_id[eid]
                    join_str = emp.get("joinDate", "2024-04-01")
                    join_idx = parse_ym_index(join_str, 2024, 4)
                    leave_str = emp.get("leaveDate", "")
                    leave_idx = parse_ym_index(leave_str, 2099, 12) if leave_str else 999999
                    if month_idx < join_idx or month_idx > leave_idx:
                        ws.delete_rows(r_idx, 1)
                        workbook_modified = True

            # 2. Existing employee IDs in this sheet after purging
            existing_ids = set()
            last_staff_row = 5
            for r_idx in range(6, ws.max_row + 1):
                c3 = clean_str(ws.cell(row=r_idx, column=3).value)
                if c3.startswith("GRAND TOTALS") or c3.startswith("TOTALS"):
                    break
                eid = clean_str(ws.cell(row=r_idx, column=2).value)
                if eid:
                    existing_ids.add(eid)
                    last_staff_row = r_idx

            # 3. Find missing employees who should be in this month
            for emp in employees:
                eid = emp.get("id")
                if not eid or eid in existing_ids:
                    continue

                join_str = emp.get("joinDate", "2024-04-01")
                join_idx = parse_ym_index(join_str, 2024, 4)
                leave_str = emp.get("leaveDate", "")
                leave_idx = parse_ym_index(leave_str, 2099, 12) if leave_str else 999999

                # Strictly between join month and leave month
                if not (join_idx <= month_idx <= leave_idx):
                    continue

                row_idx = last_staff_row + 1
                last_staff_row = row_idx
                existing_ids.add(eid)
                workbook_modified = True

                sal = float(emp.get("salary") or emp.get("monthlySalary") or emp.get("baseSalary") or 0.0)
                gross = round((sundays / days_in_month) * sal, 2) if days_in_month > 0 else 0.0
                net = gross

                row_vals = [
                    len(existing_ids),
                    eid,
                    emp.get("name", ""),
                    emp.get("designation", "Staff"),
                    emp.get("bankName", ""),
                    emp.get("bankAccountNo", ""),
                    emp.get("bankIfscCode", ""),
                    emp.get("panTaxNo", ""),
                    sal,
                    0.0,       # Present
                    0.0,       # Casual
                    0.0,       # Absent
                    sundays,   # Sundays
                    sundays,   # Paid Days
                    days_in_month, # Total Days
                    gross,     # Gross Salary
                    0.0,       # Advance Deducted
                    net,       # Net Salary
                    ""         # Remarks
                ]

                for c_idx, val in enumerate(row_vals, 1):
                    cell = ws.cell(row=row_idx, column=c_idx, value=val)
                    cell.font = FONT_REGULAR
                    cell.border = BORDER_THIN
                    if c_idx in [9, 16, 17, 18]:
                        cell.number_format = '₹#,##0.00'
                        cell.alignment = Alignment(horizontal="right")
                    elif c_idx in [1, 2, 6, 7, 8, 10, 11, 12, 13, 14, 15]:
                        cell.alignment = Alignment(horizontal="center")

            # 4. Renumber S.No in Column 1
            sno = 1
            for r_idx in range(6, last_staff_row + 1):
                c3 = clean_str(ws.cell(row=r_idx, column=3).value)
                if c3.startswith("GRAND TOTALS") or c3.startswith("TOTALS"):
                    break
                eid = clean_str(ws.cell(row=r_idx, column=2).value)
                if eid:
                    ws.cell(row=r_idx, column=1, value=sno)
                    sno += 1

            # 5. Clean up any trailing rows after the staff list (no grand totals row)
            if ws.max_row > last_staff_row:
                for r in range(last_staff_row + 1, ws.max_row + 1):
                    for c in range(1, len(headers) + 1):
                        cell = ws.cell(row=r, column=c)
                        cell.value = None
                        cell.fill = PatternFill(fill_type=None)
                        cell.border = Border()

            for c_idx in range(1, len(headers) + 1):
                ws.column_dimensions[get_column_letter(c_idx)].width = 16

        if "Sheet" in wb.sheetnames and len(wb.sheetnames) > 1:
            wb.remove(wb["Sheet"])

        if workbook_modified or not os.path.exists(central_file):
            safe_save_workbook(wb, central_file)
            print(f"[Sync] Verified/updated employee rows in {central_file}")

    # Clean up PAYROLL_JSON: remove any records for employees outside their working months
    if os.path.exists(PAYROLL_JSON):
        try:
            with open(PAYROLL_JSON, "r", encoding="utf-8") as f:
                p_recs = json.load(f)
            cleaned_p = []
            modified_p = False
            for r in p_recs:
                eid = r.get("employeeId")
                m_str = r.get("month", "")
                if eid in emp_by_id and m_str:
                    emp = emp_by_id[eid]
                    r_idx = parse_ym_index(m_str, 2026, 10)
                    join_idx = parse_ym_index(emp.get("joinDate", "2024-04-01"), 2024, 4)
                    leave_str = emp.get("leaveDate", "")
                    leave_idx = parse_ym_index(leave_str, 2099, 12) if leave_str else 999999
                    if r_idx < join_idx or r_idx > leave_idx:
                        modified_p = True
                        continue
                cleaned_p.append(r)
            if modified_p:
                with open(PAYROLL_JSON, "w", encoding="utf-8") as f:
                    json.dump(cleaned_p, f, indent=2)
        except Exception as e:
            print(f"[Sync WARN] Failed to clean PAYROLL_JSON: {e}", file=sys.stderr)

if __name__ == "__main__":
    action = sys.argv[1].lower() if len(sys.argv) > 1 else "--sync"

    if action in ["--slip-pdf", "--generate-slip-pdf"]:
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("action", nargs="?")
        parser.add_argument("--month", required=True)
        parser.add_argument("--emp", "--emp-id", dest="emp_id", required=True)
        parser.add_argument("--force", action="store_true", default=False)
        args, _ = parser.parse_known_args()
        generate_single_slip_pdf(args.month, args.emp_id, force=args.force)
        sys.exit(0)
    elif action in ["--ensure-employees", "--startup-check", "-sc"]:
        ensure_all_employees_in_sheets()
    elif action in ["--import-employees", "-ie"]:
        import_employee_info()
    elif action in ["--import-payroll", "-ip"]:
        import_payrolls()
    elif action in ["--import", "--import-all", "-i"]:
        import_employee_info()
        import_payrolls()
    elif action in ["--export-employees", "-ee"]:
        sync_employee_info()
        ensure_all_employees_in_sheets()
    elif action in ["--export-payroll", "-ep"]:
        sync_payrolls()
    elif action in ["--export", "--export-all", "-e"]:
        sync_employee_info()
        sync_payrolls()
        ensure_all_employees_in_sheets()
    else:
        # Default / --sync mode:
        import_employee_info()
        ensure_all_employees_in_sheets()
        import_payrolls()

    print("[Sync] Completed successfully.")
