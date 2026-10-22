import os
import sys
import json
import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

COMPANY_NAME = "STIFLINK MANAGEMENT (OPC) PVT. LTD"
COMPANY_ADDRESS = "OFFICE NO. 301 FIFTH FLOOR, ADHARHSILA COMPLEX, GANDHI MAIDAN, PATNA, BIHAR 800001."

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Check root data/ or server/data/
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
CENTRAL_DIR = os.path.join(DATA_DIR, "central payroll")
INDIVIDUAL_DIR = os.path.join(DATA_DIR, "individual payrolls")

SERVER_DATA_DIR = os.path.join(SCRIPT_DIR, "data")
EMPLOYEES_JSON = os.path.join(SERVER_DATA_DIR, "employees.json")
PAYROLL_JSON = os.path.join(SERVER_DATA_DIR, "payroll.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(CENTRAL_DIR, exist_ok=True)
os.makedirs(INDIVIDUAL_DIR, exist_ok=True)

FONT_TITLE = Font(name="Calibri", size=15, bold=True, color="1E3A8A")
FONT_SUBTITLE = Font(name="Calibri", size=9, bold=False, color="475569")
FONT_HEADER = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
FONT_BOLD = Font(name="Calibri", size=10, bold=True, color="0F172A")
FONT_REGULAR = Font(name="Calibri", size=10, color="0F172A")

FILL_HEADER = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
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
    # If month >= 4: FY is yy-(yy+1)
    # If month < 4: FY is (yy-1)-yy
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

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Employee Master"

    ws.merge_cells("A1:G1")
    ws["A1"] = COMPANY_NAME
    ws["A1"].font = FONT_TITLE
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A2:G2")
    ws["A2"] = COMPANY_ADDRESS
    ws["A2"].font = FONT_SUBTITLE
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A3:G3")
    ws["A3"] = "EMPLOYEE MASTER DIRECTORY"
    ws["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
    ws["A3"].alignment = Alignment(horizontal="center", vertical="center")

    headers = ["Emp ID", "Full Name", "Designation", "Department", "Monthly Base Salary (INR)", "Date of Joining", "Status"]
    ws.append([])
    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=5, column=col_idx)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for emp in employees:
        ws.append([
            emp.get("id", ""),
            emp.get("name", ""),
            emp.get("designation", "Staff"),
            emp.get("department", "Accounts & Operations"),
            emp.get("baseSalary", 0.0),
            emp.get("doj", "2024-04-01"),
            "Active"
        ])

    for row in ws.iter_rows(min_row=6, max_row=5 + len(employees), min_col=1, max_col=len(headers)):
        for cell in row:
            cell.font = FONT_REGULAR
            cell.border = BORDER_THIN
            if cell.column == 5:
                cell.number_format = '₹#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            elif cell.column in [1, 6, 7]:
                cell.alignment = Alignment(horizontal="center")

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    target_path = os.path.join(DATA_DIR, "employee_info.xlsx")
    wb.save(target_path)
    print(f"[Sync] Updated {target_path}")

def sync_payrolls():
    if not os.path.exists(PAYROLL_JSON):
        return
    with open(PAYROLL_JSON, "r", encoding="utf-8") as f:
        records = json.load(f)

    # Group by FY and Month
    # Month string format e.g. "October 2026" or "OCTOBER 2026"
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

        # Parse month number
        try:
            m_num = datetime.datetime.strptime(m_name_part[:3], "%b").month
        except:
            m_num = 10 # default October

        fy = get_financial_year(year_part, m_num)
        sheet_name = f"{m_name_part} {year_part}"

        if fy not in records_by_fy:
            records_by_fy[fy] = {}
        if sheet_name not in records_by_fy[fy]:
            records_by_fy[fy][sheet_name] = []
        records_by_fy[fy][sheet_name].append(r)

    # Update or Create Central Payroll for each FY
    headers = [
        "S.No", "Emp ID", "Employee Name", "Designation", "Base Salary",
        "Present Days", "Casual Leave (Paid)", "Absent (LOP)", "Total Days",
        "Paid Days", "Daily Rate", "Loss of Pay", "Net Salary Payable"
    ]

    for fy, months_dict in records_by_fy.items():
        central_file = os.path.join(CENTRAL_DIR, f"SALARY SHEET {fy}.xlsx")
        if os.path.exists(central_file):
            wb = openpyxl.load_workbook(central_file)
        else:
            wb = openpyxl.Workbook()
            wb.remove(wb.active)

        for sheet_title, recs in months_dict.items():
            if sheet_title in wb.sheetnames:
                ws = wb[sheet_title]
                ws.delete_rows(1, ws.max_row)
            else:
                ws = wb.create_sheet(title=sheet_title)

            ws.merge_cells("A1:M1")
            ws["A1"] = COMPANY_NAME
            ws["A1"].font = FONT_TITLE
            ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

            ws.merge_cells("A2:M2")
            ws["A2"] = COMPANY_ADDRESS
            ws["A2"].font = FONT_SUBTITLE
            ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

            ws.merge_cells("A3:M3")
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
                ws.append([
                    idx + 1,
                    r.get("employeeId", ""),
                    r.get("employeeName", ""),
                    r.get("designation", "Staff"),
                    r.get("baseSalary", 0.0),
                    r.get("presentDays", 0.0),
                    r.get("casualLeaveDays", 0.0),
                    r.get("absentDays", 0.0),
                    r.get("totalDays", 0.0),
                    r.get("paidDays", 0.0),
                    r.get("dailyRate", 0.0),
                    r.get("lossOfPay", 0.0),
                    r.get("netSalary", 0.0),
                ])

            row_end = row_start + len(recs) - 1

            for row in ws.iter_rows(min_row=row_start, max_row=row_end, min_col=1, max_col=len(headers)):
                for cell in row:
                    cell.font = FONT_REGULAR
                    cell.border = BORDER_THIN
                    if cell.column in [5, 11, 12, 13]:
                        cell.number_format = '₹#,##0.00'
                        cell.alignment = Alignment(horizontal="right")
                    elif cell.column in [1, 2, 6, 7, 8, 9, 10]:
                        cell.alignment = Alignment(horizontal="center")

            # Totals
            total_row = row_end + 1
            ws.cell(row=total_row, column=3, value=f"GRAND TOTALS ({len(recs)} Staff)").font = FONT_BOLD
            ws.cell(row=total_row, column=5, value=f"=SUM(E{row_start}:E{row_end})")
            ws.cell(row=total_row, column=6, value=f"=SUM(F{row_start}:F{row_end})")
            ws.cell(row=total_row, column=7, value=f"=SUM(G{row_start}:G{row_end})")
            ws.cell(row=total_row, column=8, value=f"=SUM(H{row_start}:H{row_end})")
            ws.cell(row=total_row, column=12, value=f"=SUM(L{row_start}:L{row_end})")
            ws.cell(row=total_row, column=13, value=f"=SUM(M{row_start}:M{row_end})")

            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=total_row, column=col_idx)
                cell.font = FONT_BOLD
                cell.fill = FILL_TOTAL
                cell.border = BORDER_TOTAL
                if col_idx in [5, 12, 13]:
                    cell.number_format = '₹#,##0.00'
                    cell.alignment = Alignment(horizontal="right")
                elif col_idx in [6, 7, 8]:
                    cell.alignment = Alignment(horizontal="center")

            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        wb.save(central_file)
        print(f"[Sync] Updated {central_file}")

        # Update Individual Payslips in individual payrolls/
        fy_folder = os.path.join(INDIVIDUAL_DIR, fy)
        for sheet_title, recs in months_dict.items():
            month_folder = os.path.join(fy_folder, sheet_title)
            os.makedirs(month_folder, exist_ok=True)

            for r in recs:
                wb_slip = openpyxl.Workbook()
                ws_s = wb_slip.active
                ws_s.title = "Salary Slip"

                ws_s.merge_cells("A1:F1")
                ws_s["A1"] = COMPANY_NAME
                ws_s["A1"].font = FONT_TITLE
                ws_s["A1"].alignment = Alignment(horizontal="center", vertical="center")

                ws_s.merge_cells("A2:F2")
                ws_s["A2"] = COMPANY_ADDRESS
                ws_s["A2"].font = FONT_SUBTITLE
                ws_s["A2"].alignment = Alignment(horizontal="center", vertical="center")

                ws_s.merge_cells("A3:F3")
                ws_s["A3"] = f"PAYSLIP FOR THE MONTH OF {sheet_title}"
                ws_s["A3"].font = Font(name="Calibri", size=11, bold=True, color="1E3A8A")
                ws_s["A3"].alignment = Alignment(horizontal="center", vertical="center")

                ws_s.append([])
                ws_s["A5"] = "Employee ID:"
                ws_s["B5"] = r.get("employeeId", "")
                ws_s["D5"] = "Designation:"
                ws_s["E5"] = r.get("designation", "Staff")

                ws_s["A6"] = "Employee Name:"
                ws_s["B6"] = r.get("employeeName", "")
                ws_s["D6"] = "Payment Mode:"
                ws_s["E6"] = "Bank Transfer"

                for rw in [5, 6]:
                    ws_s.cell(row=rw, column=1).font = FONT_BOLD
                    ws_s.cell(row=rw, column=4).font = FONT_BOLD

                ws_s.append([])
                ws_s.merge_cells("A8:F8")
                ws_s["A8"] = "MONTHLY ATTENDANCE SUMMARY"
                ws_s["A8"].font = FONT_BOLD
                ws_s["A8"].fill = FILL_TOTAL
                ws_s["A8"].alignment = Alignment(horizontal="center")

                ws_s.merge_cells("A9:B9")
                ws_s["A9"] = "Total Days"
                ws_s["C9"] = "Present Days"
                ws_s["D9"] = "Casual Leave"
                ws_s["E9"] = "Absent (LOP)"
                ws_s["F9"] = "Payable Days"

                ws_s.merge_cells("A10:B10")
                ws_s["A10"] = f"{r.get('totalDays', 0.0)} days"
                ws_s["C10"] = f"{r.get('presentDays', 0.0)} days"
                ws_s["D10"] = f"{r.get('casualLeaveDays', 0.0)} days"
                ws_s["E10"] = f"{r.get('absentDays', 0.0)} days"
                ws_s["F10"] = f"{r.get('paidDays', 0.0)} days"

                for c in ["A9", "C9", "D9", "E9", "F9"]:
                    ws_s[c].font = Font(name="Calibri", size=9, bold=True, color="475569")
                    ws_s[c].alignment = Alignment(horizontal="center")
                for c in ["A10", "C10", "D10", "E10", "F10"]:
                    ws_s[c].font = FONT_BOLD
                    ws_s[c].alignment = Alignment(horizontal="center")

                ws_s.append([])
                ws_s.merge_cells("A12:C12")
                ws_s["A12"] = "EARNINGS"
                ws_s["A12"].font = FONT_HEADER
                ws_s["A12"].fill = FILL_HEADER
                ws_s["A12"].alignment = Alignment(horizontal="center")

                ws_s.merge_cells("D12:F12")
                ws_s["D12"] = "DEDUCTIONS"
                ws_s["D12"].font = FONT_HEADER
                ws_s["D12"].fill = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
                ws_s["D12"].alignment = Alignment(horizontal="center")

                ws_s["A13"] = "Monthly Basic & Allowances"
                ws_s["C13"] = r.get("baseSalary", 0.0)
                ws_s["C13"].number_format = '₹#,##0.00'

                ws_s["D13"] = f"Loss of Pay ({r.get('absentDays', 0.0)} days)"
                ws_s["F13"] = r.get("lossOfPay", 0.0)
                ws_s["F13"].number_format = '₹#,##0.00'

                for rw in range(13, 15):
                    for col_idx in range(1, 7):
                        ws_s.cell(row=rw, column=col_idx).border = BORDER_THIN

                ws_s["A14"] = "Total Gross Pay:"
                ws_s["A14"].font = FONT_BOLD
                ws_s["C14"] = r.get("baseSalary", 0.0)
                ws_s["C14"].font = FONT_BOLD
                ws_s["C14"].number_format = '₹#,##0.00'

                ws_s["D14"] = "Total Deductions:"
                ws_s["D14"].font = FONT_BOLD
                ws_s["F14"] = r.get("lossOfPay", 0.0)
                ws_s["F14"].font = FONT_BOLD
                ws_s["F14"].number_format = '₹#,##0.00'

                ws_s.append([])
                ws_s.merge_cells("A16:D16")
                net_val = r.get("netSalary", 0.0)
                ws_s["A16"] = f"NET SALARY PAYABLE:\n{number_to_words(net_val)}"
                ws_s["A16"].font = Font(name="Calibri", size=10, bold=True, color="1E3A8A")
                ws_s["A16"].fill = FILL_HIGHLIGHT
                ws_s["A16"].alignment = Alignment(vertical="center", wrap_text=True)

                ws_s.merge_cells("E16:F16")
                ws_s["E16"] = net_val
                ws_s["E16"].font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
                ws_s["E16"].fill = FILL_HIGHLIGHT
                ws_s["E16"].number_format = '₹#,##0.00'
                ws_s["E16"].alignment = Alignment(horizontal="center", vertical="center")

                ws_s.append([])
                ws_s.append([])
                ws_s["A19"] = f"For {COMPANY_NAME}\n\n\nAuthorized Signatory / Accountant"
                ws_s["A19"].font = FONT_BOLD
                ws_s["E19"] = "Employee Signature\n\n\n________________________"
                ws_s["E19"].font = FONT_BOLD

                ws_s.column_dimensions['A'].width = 18
                ws_s.column_dimensions['B'].width = 18
                ws_s.column_dimensions['C'].width = 15
                ws_s.column_dimensions['D'].width = 18
                ws_s.column_dimensions['E'].width = 18
                ws_s.column_dimensions['F'].width = 15

                emp_name = r.get("employeeName", "Employee").replace(" ", "_")
                filename = f"{r.get('employeeId', 'EMP')}_{emp_name}_Payslip.xlsx"
                wb_slip.save(os.path.join(month_folder, filename))

        print(f"[Sync] Updated individual payslips inside {fy_folder}")

if __name__ == "__main__":
    sync_employee_info()
    sync_payrolls()
    print("[Sync] Completed successfully.")
