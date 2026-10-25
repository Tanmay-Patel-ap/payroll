import os
import sys
import json
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import datetime

# Ensure server directory is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
CLIENT_DIR = os.path.join(ROOT_DIR, "client")
DATA_DIR = os.path.join(ROOT_DIR, "data")
CENTRAL_DIR = os.path.join(DATA_DIR, "central payroll")
INDIVIDUAL_DIR = os.path.join(DATA_DIR, "individual payrolls")

sys.path.insert(0, SCRIPT_DIR)
import excel_sync
from pdf_generator import generate_payslip_pdf, compute_record_hash

class DirectExcelPayrollHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=CLIENT_DIR, **kwargs)

    def log_message(self, format, *args):
        # Clean logging
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {args[0]} - {args[1]}")

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"error": message}, status=status)

    def read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                return {}
            raw_data = self.rfile.read(content_length).decode("utf-8")
            return json.loads(raw_data) if raw_data else {}
        except Exception as e:
            return None

    # ─────────────────────────────────────────────────────────────────
    # GET REQUEST ROUTER
    # ─────────────────────────────────────────────────────────────────
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: Employees List /api/employees
        if path == "/api/employees":
            emps, _ = excel_sync.import_employee_info(write_json=False)
            return self.send_json(emps)

        # 2. API: Single Employee /api/employees/<id>
        if path.startswith("/api/employees/"):
            emp_id = urllib.parse.unquote(path[len("/api/employees/"):])
            emps, _ = excel_sync.import_employee_info(write_json=False)
            for emp in emps:
                if emp.get("id") == emp_id:
                    return self.send_json(emp)
            return self.send_error_json("Employee not found", 404)

        # 3. API: Roles List /api/roles
        if path == "/api/roles":
            _, roles = excel_sync.import_employee_info(write_json=False)
            return self.send_json(roles)

        # 4. API: Single Role /api/roles/<id>
        if path.startswith("/api/roles/"):
            role_id = urllib.parse.unquote(path[len("/api/roles/"):])
            _, roles = excel_sync.import_employee_info(write_json=False)
            for role in roles:
                if role.get("id") == role_id:
                    return self.send_json(role)
            return self.send_error_json("Role not found", 404)

        # 5. API: Payroll Months /api/payroll/months
        if path == "/api/payroll/months":
            all_records = excel_sync.import_payrolls(write_json=False)
            months = sorted(list({r.get("month") for r in all_records if r.get("month")}))
            return self.send_json(months)

        # 6. API: Payroll Single Record /api/payroll/record
        if path == "/api/payroll/record":
            month = query.get("month", [""])[0].strip().lower()
            emp_id = query.get("employeeId", [""])[0].strip()
            all_records = excel_sync.import_payrolls(write_json=False)
            for r in all_records:
                if r.get("month", "").strip().lower() == month and r.get("employeeId", "").strip() == emp_id:
                    return self.send_json(r)
            return self.send_error_json("Payroll record not found", 404)

        # 7. API: Payroll Records for Month /api/payroll?month=...
        if path == "/api/payroll":
            month = query.get("month", [""])[0].strip().lower()
            all_records = excel_sync.import_payrolls(write_json=False)
            if month:
                filtered = [r for r in all_records if r.get("month", "").strip().lower() == month]
            else:
                filtered = all_records
            return self.send_json(filtered)

        # 8. API: Payslip PDF Download /api/payroll/slip-pdf
        if path == "/api/payroll/slip-pdf":
            month = query.get("month", [""])[0]
            emp_id = query.get("employeeId", [""])[0] or query.get("empId", [""])[0]
            if not month or not emp_id:
                return self.send_error_json("Missing month or employeeId parameter", 400)

            pdf_path = excel_sync.generate_single_slip_pdf(month, emp_id, force=True, record_override=body)
            if pdf_path and os.path.exists(pdf_path):
                try:
                    with open(pdf_path, "rb") as f:
                        pdf_data = f.read()
                    fname = os.path.basename(pdf_path)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/pdf")
                    self.send_header("Content-Disposition", f'inline; filename="{fname}"')
                    self.send_header("Content-Length", str(len(pdf_data)))
                    self.end_headers()
                    self.wfile.write(pdf_data)
                    return
                except Exception as e:
                    return self.send_error_json(f"Could not read PDF: {e}", 500)
            return self.send_error_json("Could not generate payslip PDF", 404)

        # 9. Fallback: Serve static client files (HTML, JS, CSS, Assets)
        super().do_GET()

    # ─────────────────────────────────────────────────────────────────
    # POST REQUEST ROUTER
    # ─────────────────────────────────────────────────────────────────
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if body is None and path != "/api/payroll/slip-pdf":
            return self.send_error_json("Invalid JSON body", 400)

        # 1. API: Create Employee /api/employees
        if path == "/api/employees":
            emp_id = str(body.get("id", "")).strip()
            name = str(body.get("name", "")).strip()
            if not name:
                return self.send_error_json("Employee name is required", 400)

            emps, roles = excel_sync.import_employee_info(write_json=False)

            if not emp_id:
                max_n = 0
                for e in emps:
                    eid = e.get("id", "")
                    if eid.startswith("EMP"):
                        try:
                            max_n = max(max_n, int(eid[3:]))
                        except ValueError:
                            pass
                emp_id = f"EMP{max_n + 1:03d}"

            # Check duplicate ID
            for e in emps:
                if e.get("id") == emp_id:
                    return self.send_error_json(f"Employee ID {emp_id} already exists", 400)

            salary = float(body.get("salary") or body.get("monthlySalary") or body.get("baseSalary") or 0.0)
            desig = str(body.get("designation") or "Staff").strip()

            new_emp = {
                "id": emp_id,
                "name": name,
                "designation": desig,
                "salary": salary,
                "monthlySalary": salary,
                "baseSalary": salary,
                "email": str(body.get("email") or "").strip(),
                "phone": str(body.get("phone") or "").strip(),
                "joinDate": str(body.get("joinDate") or "2024-04-01").strip(),
                "leaveDate": str(body.get("leaveDate") or "").strip(),
                "bankName": str(body.get("bankName") or "").strip(),
                "bankAccountNo": str(body.get("bankAccountNo") or "").strip(),
                "bankIfscCode": str(body.get("bankIfscCode") or "").strip(),
                "panTaxNo": str(body.get("panTaxNo") or "").strip(),
                "isActive": bool(body.get("isActive", True))
            }

            emps.append(new_emp)
            excel_sync.sync_employee_info(employees=emps, roles=roles)
            excel_sync.ensure_all_employees_in_sheets(employees=emps)
            return self.send_json(new_emp, status=201)

        # 2. API: Create Role /api/roles
        if path == "/api/roles":
            role_id = str(body.get("id", "")).strip()
            name = str(body.get("name", "")).strip().upper()
            salary = float(body.get("salary") or 0.0)
            if not name:
                return self.send_error_json("Role name is required", 400)

            emps, roles = excel_sync.import_employee_info(write_json=False)

            if not role_id:
                max_r = 0
                for r in roles:
                    rid = r.get("id", "")
                    if rid.startswith("ROLE"):
                        try:
                            max_r = max(max_r, int(rid[4:]))
                        except ValueError:
                            pass
                role_id = f"ROLE{max_r + 1:03d}"

            for r in roles:
                if r.get("id") == role_id:
                    return self.send_error_json(f"Role ID {role_id} already exists", 400)

            new_role = {"id": role_id, "name": name, "salary": salary}
            roles.append(new_role)
            excel_sync.sync_employee_info(employees=emps, roles=roles)
            return self.send_json(new_role, status=201)

        # 3. API: Batch Save Payroll /api/payroll/batch
        if path == "/api/payroll/batch":
            month = body.get("month", "")
            records = body.get("records", [])
            if not records and isinstance(body, list):
                records = body
                if records:
                    month = records[0].get("month", "")

            all_records = excel_sync.import_payrolls(write_json=False)

            # Update or append incoming records
            updated_map = {f"{r.get('month')}_{r.get('employeeId')}": r for r in all_records}
            for rec in records:
                m = rec.get("month") or month
                eid = rec.get("employeeId")
                if m and eid:
                    rec["month"] = m
                    rec["employeeId"] = eid
                    updated_map[f"{m}_{eid}"] = rec

            merged_records = list(updated_map.values())
            excel_sync.sync_payrolls(records=merged_records)
            return self.send_json({"success": True, "count": len(records)})

        # 4. API: Single Save Payroll /api/payroll/single
        if path == "/api/payroll/single":
            month = body.get("month", "")
            emp_id = body.get("employeeId", "")
            if not month or not emp_id:
                return self.send_error_json("Missing month or employeeId", 400)

            all_records = excel_sync.import_payrolls(write_json=False)
            found = False
            for i, r in enumerate(all_records):
                if r.get("month") == month and r.get("employeeId") == emp_id:
                    all_records[i].update(body)
                    found = True
                    break
            if not found:
                all_records.append(body)

            excel_sync.sync_payrolls(records=all_records)
            return self.send_json({"success": True, "record": body})

        # 5. API: Payslip PDF POST /api/payroll/slip-pdf
        if path == "/api/payroll/slip-pdf":
            month = body.get("month", "")
            emp_id = body.get("employeeId", "") or body.get("empId", "")
            if not month or not emp_id:
                return self.send_error_json("Missing month or employeeId parameter", 400)

            pdf_path = excel_sync.generate_single_slip_pdf(month, emp_id, force=True, record_override=body)
            if pdf_path and os.path.exists(pdf_path):
                try:
                    with open(pdf_path, "rb") as f:
                        pdf_data = f.read()
                    fname = os.path.basename(pdf_path)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/pdf")
                    self.send_header("Content-Disposition", f'inline; filename="{fname}"')
                    self.send_header("Content-Length", str(len(pdf_data)))
                    self.end_headers()
                    self.wfile.write(pdf_data)
                    return
                except Exception as e:
                    return self.send_error_json(f"Could not read PDF: {e}", 500)
            return self.send_error_json("Could not generate payslip PDF", 404)

        return self.send_error_json("Endpoint not found", 404)

    # ─────────────────────────────────────────────────────────────────
    # PUT REQUEST ROUTER
    # ─────────────────────────────────────────────────────────────────
    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if body is None:
            return self.send_error_json("Invalid JSON body", 400)

        # 1. API: Update Employee /api/employees/<id>
        if path.startswith("/api/employees/"):
            emp_id = urllib.parse.unquote(path[len("/api/employees/"):])
            emps, roles = excel_sync.import_employee_info(write_json=False)

            found = False
            for i, emp in enumerate(emps):
                if emp.get("id") == emp_id:
                    # Update fields
                    if "name" in body: emp["name"] = str(body["name"]).strip()
                    if "designation" in body: emp["designation"] = str(body["designation"]).strip()
                    if "email" in body: emp["email"] = str(body["email"]).strip()
                    if "phone" in body: emp["phone"] = str(body["phone"]).strip()
                    if "joinDate" in body: emp["joinDate"] = str(body["joinDate"]).strip()
                    if "leaveDate" in body: emp["leaveDate"] = str(body["leaveDate"]).strip()
                    if "bankName" in body: emp["bankName"] = str(body["bankName"]).strip()
                    if "bankAccountNo" in body: emp["bankAccountNo"] = str(body["bankAccountNo"]).strip()
                    if "bankIfscCode" in body: emp["bankIfscCode"] = str(body["bankIfscCode"]).strip()
                    if "panTaxNo" in body: emp["panTaxNo"] = str(body["panTaxNo"]).strip()
                    if "isActive" in body: emp["isActive"] = bool(body["isActive"])

                    # Salary
                    sal = body.get("salary") or body.get("monthlySalary") or body.get("baseSalary")
                    if sal is not None:
                        sal_val = float(sal)
                        emp["salary"] = sal_val
                        emp["monthlySalary"] = sal_val
                        emp["baseSalary"] = sal_val

                    emps[i] = emp
                    found = True
                    break

            if not found:
                return self.send_error_json("Employee not found", 404)

            excel_sync.sync_employee_info(employees=emps, roles=roles)
            excel_sync.ensure_all_employees_in_sheets(employees=emps)
            return self.send_json(emps[i])

        # 2. API: Update Role /api/roles/<id>
        if path.startswith("/api/roles/"):
            role_id = urllib.parse.unquote(path[len("/api/roles/"):])
            emps, roles = excel_sync.import_employee_info(write_json=False)

            found = False
            for i, role in enumerate(roles):
                if role.get("id") == role_id:
                    if "name" in body: role["name"] = str(body["name"]).strip().upper()
                    if "salary" in body: role["salary"] = float(body["salary"])
                    roles[i] = role
                    found = True
                    break

            if not found:
                return self.send_error_json("Role not found", 404)

            excel_sync.sync_employee_info(employees=emps, roles=roles)
            return self.send_json(roles[i])

        return self.send_error_json("Endpoint not found", 404)

    # ─────────────────────────────────────────────────────────────────
    # DELETE REQUEST ROUTER
    # ─────────────────────────────────────────────────────────────────
    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: Delete Employee /api/employees/<id>
        if path.startswith("/api/employees/"):
            emp_id = urllib.parse.unquote(path[len("/api/employees/"):])
            emps, roles = excel_sync.import_employee_info(write_json=False)

            initial_len = len(emps)
            emps = [e for e in emps if e.get("id") != emp_id]

            if len(emps) == initial_len:
                return self.send_error_json("Employee not found", 404)

            excel_sync.sync_employee_info(employees=emps, roles=roles)
            excel_sync.ensure_all_employees_in_sheets(employees=emps)
            return self.send_json({"success": True, "message": "Employee deleted"})

        # 2. API: Delete Role /api/roles/<id>
        if path.startswith("/api/roles/"):
            role_id = urllib.parse.unquote(path[len("/api/roles/"):])
            emps, roles = excel_sync.import_employee_info(write_json=False)

            initial_len = len(roles)
            roles = [r for r in roles if r.get("id") != role_id]

            if len(roles) == initial_len:
                return self.send_error_json("Role not found", 404)

            excel_sync.sync_employee_info(employees=emps, roles=roles)
            return self.send_json({"success": True, "message": "Role deleted"})

        # 3. API: Delete Payroll Record /api/payroll?month=...&employeeId=...
        if path == "/api/payroll":
            month = query.get("month", [""])[0]
            emp_id = query.get("employeeId", [""])[0]
            if not month or not emp_id:
                return self.send_error_json("Missing month or employeeId parameter", 400)

            all_records = excel_sync.import_payrolls(write_json=False)
            filtered = [r for r in all_records if not (r.get("month") == month and r.get("employeeId") == emp_id)]
            excel_sync.sync_payrolls(records=filtered)
            return self.send_json({"success": True, "message": "Payroll record deleted"})

        return self.send_error_json("Endpoint not found", 404)

def run_server(port=8080):
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, DirectExcelPayrollHandler)
    print("=" * 60)
    print("  Direct Excel Payroll Server Active!")
    print(f"  URL:       http://localhost:{port}")
    print(f"  Database:  Direct .xlsx synchronization (NO JSON middleman)")
    print(f"  Client:    {CLIENT_DIR}")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
