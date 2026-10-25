import os
import sys
import json
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import datetime
import shutil
import io
import zipfile
import subprocess
import threading
import time
import base64

# Ensure server directory is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
CLIENT_DIR = os.path.join(ROOT_DIR, "client")
DATA_DIR = os.path.join(ROOT_DIR, "data")
CENTRAL_DIR = os.path.join(DATA_DIR, "central payroll")
INDIVIDUAL_DIR = os.path.join(DATA_DIR, "individual payrolls")
BACKUP_CONFIG_FILE = os.path.join(SCRIPT_DIR, "backup_config.json")

sys.path.insert(0, SCRIPT_DIR)
import excel_sync
from pdf_generator import generate_payslip_pdf, compute_record_hash

def load_backup_config():
    default_cfg = {
        "enabled": False,
        "intervalType": "hours",  # "hours" or "days"
        "intervalValue": 6,
        "destinationFolder": os.path.join(ROOT_DIR, "backups", "auto"),
        "keepCopies": 10,
        "lastBackupTime": None,
        "lastBackupStatus": None,
        "lastBackupPath": None
    }
    if os.path.exists(BACKUP_CONFIG_FILE):
        try:
            with open(BACKUP_CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                default_cfg.update(saved)
        except Exception:
            pass
    return default_cfg

def save_backup_config(cfg):
    try:
        with open(BACKUP_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        return True
    except Exception as e:
        print(f"[BackupConfig ERROR] Could not save config: {e}")
        return False

def open_native_folder_dialog(title="Select Folder"):
    """Opens native Windows folder selection dialog using PowerShell / Windows Forms."""
    try:
        ps_script = f"""
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.StartPosition = 'CenterScreen'
$form.Width = 0
$form.Height = 0
$form.ShowInTaskbar = $false

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.ShowNewFolderButton = $true
$dialog.Description = "{title}"

$res = $dialog.ShowDialog($form)
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {{
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Output $dialog.SelectedPath
}}
$form.Dispose()
$dialog.Dispose()
"""
        encoded_cmd = base64.b64encode(ps_script.encode("utf-16le")).decode("ascii")
        res = subprocess.run(
            ["powershell", "-NoProfile", "-STA", "-EncodedCommand", encoded_cmd],
            capture_output=True,
            text=True,
            timeout=180
        )
        out = res.stdout.strip()
        if out:
            lines = [l.strip() for l in out.splitlines() if l.strip()]
            if lines:
                return {"success": True, "path": lines[-1]}
        return {"success": False, "cancelled": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def run_auto_backup_job():
    """Executes an automated backup based on current configuration."""
    cfg = load_backup_config()
    if not cfg.get("enabled"):
        return False, "Automated backup is disabled"

    dest_base = cfg.get("destinationFolder", "").strip()
    if not dest_base:
        dest_base = os.path.join(ROOT_DIR, "backups", "auto")

    ts_dir = datetime.datetime.now().strftime("backup_%Y-%m-%d_%H%M%S")
    target_path = os.path.join(dest_base, ts_dir)

    res = do_folder_backup(target_path)
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if res.get("success"):
        cfg["lastBackupTime"] = now_str
        cfg["lastBackupStatus"] = "Success"
        cfg["lastBackupPath"] = target_path

        # Prune older backups if beyond keepCopies
        keep = int(cfg.get("keepCopies", 10))
        try:
            if os.path.exists(dest_base):
                entries = [
                    os.path.join(dest_base, d) for d in os.listdir(dest_base)
                    if d.startswith("backup_") and os.path.isdir(os.path.join(dest_base, d))
                ]
                entries.sort(key=os.path.getmtime)
                if len(entries) > keep:
                    for old_dir in entries[:-keep]:
                        try:
                            shutil.rmtree(old_dir)
                            print(f"[AutoBackup] Pruned old backup: {old_dir}")
                        except Exception:
                            pass
        except Exception as pe:
            print(f"[AutoBackup WARN] Pruning error: {pe}")

        save_backup_config(cfg)
        print(f"[{now_str}] [AutoBackup] Successfully created backup at: {target_path}")
        return True, target_path
    else:
        cfg["lastBackupStatus"] = f"Failed: {res.get('error')}"
        save_backup_config(cfg)
        print(f"[{now_str}] [AutoBackup ERROR] Backup failed: {res.get('error')}")
        return False, res.get("error")

def auto_backup_scheduler_loop():
    """Background thread that runs periodic automated backups."""
    time.sleep(15)  # Initial grace period on server startup
    while True:
        try:
            cfg = load_backup_config()
            if cfg.get("enabled"):
                val = int(cfg.get("intervalValue", 6))
                itype = cfg.get("intervalType", "hours")
                interval_secs = val * 3600 if itype == "hours" else val * 86400

                last_time_str = cfg.get("lastBackupTime")
                should_run = False
                if not last_time_str:
                    should_run = True
                else:
                    try:
                        last_time = datetime.datetime.strptime(last_time_str, "%Y-%m-%d %H:%M:%S")
                        elapsed = (datetime.datetime.now() - last_time).total_seconds()
                        if elapsed >= interval_secs:
                            should_run = True
                    except Exception:
                        should_run = True

                if should_run:
                    run_auto_backup_job()
        except Exception as e:
            print(f"[AutoBackup Daemon Exception] {e}")
        time.sleep(30)

def do_folder_backup(target_path):
    try:
        target_path = os.path.abspath(target_path.strip())
        os.makedirs(target_path, exist_ok=True)
        copied_count = 0
        total_bytes = 0
        for root, dirs, files in os.walk(DATA_DIR):
            rel = os.path.relpath(root, DATA_DIR)
            dest_dir = os.path.join(target_path, rel) if rel != "." else target_path
            os.makedirs(dest_dir, exist_ok=True)
            for f in files:
                if f.startswith("~$") or f.startswith("."):
                    continue
                src_file = os.path.join(root, f)
                dst_file = os.path.join(dest_dir, f)
                shutil.copy2(src_file, dst_file)
                copied_count += 1
                total_bytes += os.path.getsize(src_file)
        return {
            "success": True,
            "message": f"Successfully backed up {copied_count} files to {target_path}",
            "targetPath": target_path,
            "fileCount": copied_count,
            "totalSizeBytes": total_bytes,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        return {"success": False, "error": f"Backup failed: {str(e)}"}

def do_folder_restore(source_path):
    try:
        source_path = os.path.abspath(source_path.strip())
        if not os.path.exists(source_path) or not os.path.isdir(source_path):
            return {"success": False, "error": f"Source directory does not exist: {source_path}"}

        # Check if source_path has any valid payroll files
        has_payroll_data = False
        for root, dirs, files in os.walk(source_path):
            for f in files:
                if f.lower().endswith(".xlsx") or f.lower().endswith(".pdf"):
                    has_payroll_data = True
                    break
            if has_payroll_data:
                break

        if not has_payroll_data:
            return {"success": False, "error": f"No valid payroll data (.xlsx files) found in {source_path}"}

        # Safety snapshot of active data
        safety_ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safety_dir = os.path.join(ROOT_DIR, f"data_safety_backup_{safety_ts}")
        if os.path.exists(DATA_DIR):
            shutil.copytree(DATA_DIR, safety_dir, dirs_exist_ok=True)

        actual_source = source_path
        if os.path.exists(os.path.join(source_path, "data")) and os.path.isdir(os.path.join(source_path, "data")):
            actual_source = os.path.join(source_path, "data")

        excel_sync.force_close_excel()
        restored_count = 0
        for root, dirs, files in os.walk(actual_source):
            rel = os.path.relpath(root, actual_source)
            dest_dir = os.path.join(DATA_DIR, rel) if rel != "." else DATA_DIR
            os.makedirs(dest_dir, exist_ok=True)
            for f in files:
                if f.startswith("~$") or f.startswith("."):
                    continue
                src_file = os.path.join(root, f)
                dst_file = os.path.join(dest_dir, f)
                try:
                    shutil.copy2(src_file, dst_file)
                except PermissionError:
                    import time
                    time.sleep(0.5)
                    shutil.copy2(src_file, dst_file)
                restored_count += 1

        try:
            excel_sync.ensure_all_employees_in_sheets()
        except Exception as e:
            print(f"[Restore WARN] ensure_all_employees_in_sheets: {e}")

        return {
            "success": True,
            "message": f"Successfully restored {restored_count} files from {source_path}",
            "safetyBackup": safety_dir,
            "restoredCount": restored_count,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        return {"success": False, "error": f"Restore failed: {str(e)}"}

def do_zip_restore(zip_bytes):
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        safety_ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safety_dir = os.path.join(ROOT_DIR, f"data_safety_backup_{safety_ts}")
        if os.path.exists(DATA_DIR):
            shutil.copytree(DATA_DIR, safety_dir, dirs_exist_ok=True)

        excel_sync.force_close_excel()
        extracted_count = 0
        for member in zf.infolist():
            filename = member.filename
            if filename.startswith("/") or ".." in filename:
                continue
            clean_name = filename
            if clean_name.startswith("data/") or clean_name.startswith("data\\"):
                clean_name = clean_name[5:]
            if not clean_name:
                continue

            target_file = os.path.join(DATA_DIR, clean_name)
            if member.is_dir():
                os.makedirs(target_file, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(target_file), exist_ok=True)
                with zf.open(member) as source, open(target_file, "wb") as target:
                    shutil.copyfileobj(source, target)
                extracted_count += 1

        try:
            excel_sync.ensure_all_employees_in_sheets()
        except Exception as e:
            print(f"[Restore WARN] ensure_all_employees_in_sheets: {e}")

        return {
            "success": True,
            "message": f"Successfully restored {extracted_count} files from ZIP archive",
            "safetyBackup": safety_dir,
            "restoredCount": extracted_count,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        return {"success": False, "error": f"ZIP restore failed: {str(e)}"}

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

            pdf_path = excel_sync.generate_single_slip_pdf(month, emp_id, force=True)
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

        # 9. API: Download Full Backup ZIP /api/backup/download
        if path == "/api/backup/download":
            try:
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                    for root, dirs, files in os.walk(DATA_DIR):
                        for file in files:
                            if file.startswith("~$") or file.startswith("."):
                                continue
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, DATA_DIR)
                            zf.write(file_path, arcname)
                zip_buffer.seek(0)
                zip_bytes = zip_buffer.getvalue()
                ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
                fname = f"payroll_data_backup_{ts}.zip"
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
                self.send_header("Content-Length", str(len(zip_bytes)))
                self.end_headers()
                self.wfile.write(zip_bytes)
                return
            except Exception as e:
                return self.send_error_json(f"Could not generate backup ZIP: {e}", 500)

        # 10. API: Get Auto-Backup Config /api/backup/auto-config
        if path == "/api/backup/auto-config":
            return self.send_json(load_backup_config())

        # 11. Fallback: Serve static client files (HTML, JS, CSS, Assets)
        super().do_GET()

    # ─────────────────────────────────────────────────────────────────
    # POST REQUEST ROUTER
    # ─────────────────────────────────────────────────────────────────
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self.read_json_body()

        if body is None and path not in ["/api/payroll/slip-pdf", "/api/restore/upload"]:
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

        # 6. API: Backup Data to Custom Folder /api/backup
        if path == "/api/backup":
            target_path = body.get("targetPath", "").strip() if body else ""
            if not target_path:
                ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
                target_path = os.path.join(ROOT_DIR, "backups", f"backup_{ts}")
            res = do_folder_backup(target_path)
            if res.get("success"):
                return self.send_json(res)
            else:
                return self.send_error_json(res.get("error", "Backup failed"), 400)

        # 7. API: Restore Data from Folder /api/restore
        if path == "/api/restore":
            source_path = body.get("sourcePath", "").strip() if body else ""
            if not source_path:
                return self.send_error_json("Source directory path is required", 400)
            res = do_folder_restore(source_path)
            if res.get("success"):
                return self.send_json(res)
            else:
                return self.send_error_json(res.get("error", "Restore failed"), 400)

        # 8. API: Restore Data from ZIP Upload /api/restore/upload
        if path == "/api/restore/upload":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                return self.send_error_json("No file data received in upload", 400)
            zip_bytes = self.rfile.read(content_length)
            res = do_zip_restore(zip_bytes)
            if res.get("success"):
                return self.send_json(res)
            else:
                return self.send_error_json(res.get("error", "ZIP restore failed"), 400)

        # 9. API: Native Folder Browser Dialog /api/browse-folder
        if path == "/api/browse-folder":
            title = body.get("title", "Select Destination Folder") if body else "Select Destination Folder"
            res = open_native_folder_dialog(title=title)
            return self.send_json(res)

        # 10. API: Update Auto-Backup Config /api/backup/auto-config
        if path == "/api/backup/auto-config":
            cfg = load_backup_config()
            if body:
                if "enabled" in body:
                    cfg["enabled"] = bool(body["enabled"])
                if "intervalType" in body:
                    cfg["intervalType"] = "days" if body["intervalType"] == "days" else "hours"
                if "intervalValue" in body:
                    try:
                        cfg["intervalValue"] = max(1, int(body["intervalValue"]))
                    except (ValueError, TypeError):
                        pass
                if "destinationFolder" in body:
                    cfg["destinationFolder"] = str(body["destinationFolder"]).strip()
                if "keepCopies" in body:
                    try:
                        cfg["keepCopies"] = max(1, int(body["keepCopies"]))
                    except (ValueError, TypeError):
                        pass
            success = save_backup_config(cfg)
            if success:
                return self.send_json({"success": True, "config": cfg})
            else:
                return self.send_error_json("Failed to save backup config", 500)

        # 11. API: Trigger Immediate Auto-Backup /api/backup/auto-run
        if path == "/api/backup/auto-run":
            ok, msg = run_auto_backup_job()
            cfg = load_backup_config()
            if ok:
                return self.send_json({"success": True, "message": f"Backup created successfully at: {msg}", "config": cfg})
            else:
                return self.send_error_json(f"Auto-backup failed: {msg}", 400)

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

    # Start automated backup scheduler background daemon
    sched_thread = threading.Thread(target=auto_backup_scheduler_loop, daemon=True)
    sched_thread.start()

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
