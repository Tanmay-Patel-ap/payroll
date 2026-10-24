/**
 * PayslipViewer - Individual Employee Salary Slip Generator.
 * Uses shared PayrollUtils for calendar math, currency formatting, and numeric to words conversion.
 */
class PayslipViewer {
  constructor(apiClient) {
    this.api = apiClient;
    this.currentRecord = null;
    this.employees = [];
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.fySelect = document.getElementById('slip-fy-select');
    this.monthSelect = document.getElementById('slip-month-select');
    this.empSelect = document.getElementById('slip-emp-select');
    this.loadBtn = document.getElementById('slip-load-btn');
    this.saveBtn = document.getElementById('slip-save-btn');
    this.slipCard = document.getElementById('payslip-display-area');

    // Header & Meta Elements
    this.slipMonthText = document.getElementById('slip-out-month');
    this.slipEmpId = document.getElementById('slip-out-id');
    this.slipEmpName = document.getElementById('slip-out-name');
    this.slipEmpDesig = document.getElementById('slip-out-desig');
    this.slipSalary = document.getElementById('slip-out-salary');
    this.slipBankName = document.getElementById('slip-out-bank');
    this.slipAccountNo = document.getElementById('slip-out-account');
    this.slipIfsc = document.getElementById('slip-out-ifsc');
    this.slipPan = document.getElementById('slip-out-pan');
    this.slipDoj = document.getElementById('slip-out-doj');

    // Attendance
    this.slipTotalDays = document.getElementById('slip-out-total');
    this.slipPresentDays = document.getElementById('slip-out-present');
    this.slipCasualDays = document.getElementById('slip-out-casual');
    this.slipSundays = document.getElementById('slip-out-sundays');
    this.slipAbsentDays = document.getElementById('slip-out-absent');
    this.slipPaidDays = document.getElementById('slip-out-paid');

    // Earnings & Deductions
    this.slipGross = document.getElementById('slip-out-gross');
    this.slipAdvance = document.getElementById('slip-out-advance');

    // Net Amount & Words
    this.slipNetSalary = document.getElementById('slip-out-net');
    this.slipAmountWords = document.getElementById('slip-out-words');

    // Remarks
    this.slipRemarksBox = document.getElementById('slip-out-remarks-box');
    this.slipRemarks = document.getElementById('slip-out-remarks');
  }

  getSelectedMonth() {
    const fy = this.fySelect ? this.fySelect.value : '2026-27';
    const m = this.monthSelect ? this.monthSelect.value : 'October';
    return PayrollUtils.getCombinedMonth(fy, m);
  }

  bindEvents() {
    window.addEventListener('employeesUpdated', (e) => {
      this.employees = e.detail;
      this.populateEmployeeSelect(e.detail);
    });

    window.addEventListener('payrollUpdated', (e) => {
      if (e.detail && e.detail.month) {
        const { fy, month } = PayrollUtils.parseMonthStringToFyAndMonth(e.detail.month);
        if (this.fySelect) this.fySelect.value = fy;
        if (this.monthSelect) this.monthSelect.value = month;
      }
    });

    if (this.loadBtn) {
      this.loadBtn.addEventListener('click', () => {
        const m = this.getSelectedMonth();
        const empId = this.empSelect.value;
        if (m && empId) this.loadPayslip(m, empId);
        else window.app.showToast('Please select both salary month and employee', 'error');
      });
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.savePayslipPdf());
    }
  }

  populateEmployeeSelect(employees) {
    if (!this.empSelect) return;
    const current = this.empSelect.value;
    this.empSelect.innerHTML = '<option value="">-- Choose Employee --</option>';

    const sorted = [...(employees || [])].sort((a, b) =>
      PayrollUtils.naturalCompare(a.id, b.id)
    );

    sorted.forEach((emp) => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.id})`;
      this.empSelect.appendChild(opt);
    });
    if (current) this.empSelect.value = current;
  }

  async refreshMonthsList() {
    if (!this.monthSelect) return;
    try {
      const months = await this.api.getRecordedMonths();
      const current = this.monthSelect.value;
      this.monthSelect.innerHTML = '<option value="">-- Pick Month --</option>';
      months.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        this.monthSelect.appendChild(opt);
      });
      if (current) this.monthSelect.value = current;
    } catch (err) {
      console.error('Failed to load months for payslip:', err);
    }
  }

  async loadPayslip(month, employeeId) {
    try {
      if (month) {
        const { fy, month: m } = PayrollUtils.parseMonthStringToFyAndMonth(month);
        if (this.fySelect) this.fySelect.value = fy;
        if (this.monthSelect) this.monthSelect.value = m;
      }
      if (employeeId && this.empSelect) {
        this.empSelect.value = employeeId;
      }

      this.currentRecord = await this.api.getSingleRecord(month, employeeId);
      this.render();
      window.app.switchTab('payslip-tab');
    } catch (err) {
      window.app.showToast(`No salary slip found for ${employeeId} in ${month}.`, 'error');
      this.currentRecord = null;
    }
  }

  render() {
    if (!this.currentRecord) return;
    const r = this.currentRecord;

    // Header & Meta
    if (this.slipMonthText) this.slipMonthText.textContent = r.month;
    if (this.slipEmpId) this.slipEmpId.textContent = r.employeeId;
    if (this.slipEmpName) this.slipEmpName.textContent = r.employeeName;
    if (this.slipEmpDesig) this.slipEmpDesig.textContent = r.designation || 'Staff';

    const empMatch = this.employees.find((e) => e.id === r.employeeId);
    const monthlySal = r.monthlySalary || (empMatch ? (empMatch.salary || empMatch.monthlySalary) : 0) || 0;
    if (this.slipSalary) this.slipSalary.textContent = PayrollUtils.formatCurrency(monthlySal, 0);

    if (this.slipBankName) this.slipBankName.textContent = r.bankName || 'State Bank of India';
    if (this.slipAccountNo) this.slipAccountNo.textContent = r.bankAccountNo || '—';
    if (this.slipIfsc) this.slipIfsc.textContent = r.bankIfscCode || '—';
    if (this.slipPan) this.slipPan.textContent = r.panTaxNo || '—';

    if (this.slipDoj) this.slipDoj.textContent = empMatch ? (empMatch.joinDate || '2024-04-01') : '2024-04-01';

    // Attendance
    if (this.slipTotalDays) this.slipTotalDays.textContent = `${r.totalDays} days`;
    if (this.slipPresentDays) this.slipPresentDays.textContent = `${r.presentDays} days`;
    if (this.slipCasualDays) this.slipCasualDays.textContent = `${r.casualLeaveDays} days`;
    if (this.slipSundays) this.slipSundays.textContent = `${r.sundays !== undefined ? r.sundays : 4} days`;
    if (this.slipAbsentDays) this.slipAbsentDays.textContent = `${r.absentDays} days`;
    if (this.slipPaidDays) this.slipPaidDays.textContent = `${r.paidDays} days`;

    // Earnings (Gross Salary matching salary sheet)
    if (this.slipGross) this.slipGross.textContent = PayrollUtils.formatCurrency(r.grossSalary, 2);

    // Deductions (Advance Salary Recovery)
    const advance = Number(r.advanceDeducted || 0);
    const deductions = advance;
    if (this.slipAdvance) this.slipAdvance.textContent = `-${PayrollUtils.formatCurrency(advance, 2)}`;

    // Net Amount & In Words
    const gross = Number(r.grossSalary || 0);
    const net = gross - deductions;
    if (this.slipNetSalary) this.slipNetSalary.textContent = PayrollUtils.formatCurrency(net, 2);
    if (this.slipAmountWords) {
      this.slipAmountWords.textContent = PayrollUtils.numberToWords(Math.round(net));
    }

    // Remarks
    if (r.remarks && r.remarks.trim().length > 0) {
      if (this.slipRemarks) this.slipRemarks.textContent = r.remarks;
      if (this.slipRemarksBox) this.slipRemarksBox.style.display = 'block';
    } else {
      if (this.slipRemarksBox) this.slipRemarksBox.style.display = 'none';
    }

    if (this.slipCard) {
      this.slipCard.style.display = 'block';
    }
  }

  async savePayslipPdf() {
    const m = this.getSelectedMonth();
    const empId = this.empSelect ? this.empSelect.value : '';
    if (!m || !empId) {
      window.app.showToast('Please select both salary month and employee first', 'error');
      return;
    }

    const origText = this.saveBtn ? this.saveBtn.innerHTML : '💾 Save Slip';
    if (this.saveBtn) {
      this.saveBtn.disabled = true;
      this.saveBtn.innerHTML = '⏳ Saving...';
    }

    try {
      const blob = await this.api.downloadPayslipPdf(m, empId);
      const r = this.currentRecord || {};
      const safeName = (r.employeeName || 'Employee').replace(/\s+/g, '_');
      const filename = `${empId}_${safeName}_Payslip.pdf`;
      this.api.triggerBlobDownload(blob, filename);
      window.app.showToast(`Saved payslip for ${r.employeeName || empId} to designated folder & downloaded!`, 'success');
    } catch (err) {
      console.error('Failed to save slip PDF:', err);
      window.app.showToast('Failed to save slip PDF: ' + err.message, 'error');
    } finally {
      if (this.saveBtn) {
        this.saveBtn.disabled = false;
        this.saveBtn.innerHTML = origText;
      }
    }
  }
}
