/**
 * SinglePayrollEntry - Format 1: Form-based single employee entry with live calculation preview
 */
class SinglePayrollEntry {
  constructor(apiClient) {
    this.api = apiClient;
    this.employees = [];
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.form = document.getElementById('single-entry-form');
    this.monthInput = document.getElementById('single-month');
    this.empSelect = document.getElementById('single-emp-select');
    this.presentInput = document.getElementById('single-present-days');
    this.casualInput = document.getElementById('single-casual-days');
    this.absentInput = document.getElementById('single-absent-days');

    // Live preview elements
    this.previewBase = document.getElementById('preview-base-salary');
    this.previewTotalDays = document.getElementById('preview-total-days');
    this.previewPaidDays = document.getElementById('preview-paid-days');
    this.previewDailyRate = document.getElementById('preview-daily-rate');
    this.previewLossOfPay = document.getElementById('preview-loss-of-pay');
    this.previewNetSalary = document.getElementById('preview-net-salary');
  }

  bindEvents() {
    window.addEventListener('employeesUpdated', (e) => {
      this.employees = e.detail;
      this.populateEmployeeSelect();
    });

    if (this.form) {
      this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    const triggerRecalc = () => this.recalculatePreview();
    if (this.empSelect) this.empSelect.addEventListener('change', triggerRecalc);
    if (this.presentInput) this.presentInput.addEventListener('input', triggerRecalc);
    if (this.casualInput) this.casualInput.addEventListener('input', triggerRecalc);
    if (this.absentInput) this.absentInput.addEventListener('input', triggerRecalc);
  }

  populateEmployeeSelect() {
    if (!this.empSelect) return;
    const currentVal = this.empSelect.value;
    this.empSelect.innerHTML = '<option value="">-- Choose Employee --</option>';

    this.employees.forEach((emp) => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.id}) — ₹${Number(emp.baseSalary).toLocaleString('en-IN')}`;
      this.empSelect.appendChild(opt);
    });

    if (currentVal) {
      this.empSelect.value = currentVal;
    }
    this.recalculatePreview();
  }

  getSelectedEmployee() {
    const empId = this.empSelect.value;
    return this.employees.find((e) => e.id === empId) || null;
  }

  recalculatePreview() {
    const emp = this.getSelectedEmployee();
    const present = parseFloat(this.presentInput.value) || 0;
    const casual = parseFloat(this.casualInput.value) || 0;
    const absent = parseFloat(this.absentInput.value) || 0;

    if (!emp) {
      this.resetPreview();
      return;
    }

    const baseSalary = emp.baseSalary;
    let totalDays = present + casual + absent;
    if (totalDays <= 0) totalDays = 30;

    const paidDays = present + casual;
    const dailyRate = baseSalary / totalDays;
    const lossOfPay = absent * dailyRate;
    const netSalary = paidDays * dailyRate;

    if (this.previewBase) this.previewBase.textContent = `₹${baseSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (this.previewTotalDays) this.previewTotalDays.textContent = `${totalDays} days`;
    if (this.previewPaidDays) this.previewPaidDays.textContent = `${paidDays} days (Present: ${present} + Casual: ${casual})`;
    if (this.previewDailyRate) this.previewDailyRate.textContent = `₹${dailyRate.toFixed(2)}`;
    if (this.previewLossOfPay) this.previewLossOfPay.textContent = `-₹${lossOfPay.toFixed(2)}`;
    if (this.previewNetSalary) this.previewNetSalary.textContent = `₹${netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  resetPreview() {
    if (this.previewBase) this.previewBase.textContent = '₹0.00';
    if (this.previewTotalDays) this.previewTotalDays.textContent = '0 days';
    if (this.previewPaidDays) this.previewPaidDays.textContent = '0 days';
    if (this.previewDailyRate) this.previewDailyRate.textContent = '₹0.00';
    if (this.previewLossOfPay) this.previewLossOfPay.textContent = '-₹0.00';
    if (this.previewNetSalary) this.previewNetSalary.textContent = '₹0.00';
  }

  async handleSubmit(e) {
    e.preventDefault();
    const month = this.monthInput.value.trim();
    const employeeId = this.empSelect.value;
    const presentDays = parseFloat(this.presentInput.value) || 0;
    const casualLeaveDays = parseFloat(this.casualInput.value) || 0;
    const absentDays = parseFloat(this.absentInput.value) || 0;

    if (!month) {
      window.app.showToast('Please enter the month name (e.g. October 2026)', 'error');
      return;
    }
    if (!employeeId) {
      window.app.showToast('Please select an employee', 'error');
      return;
    }

    try {
      await this.api.saveSinglePayroll({
        month,
        employeeId,
        presentDays,
        casualLeaveDays,
        absentDays
      });

      const emp = this.getSelectedEmployee();
      window.app.showToast(`Saved salary record for ${emp ? emp.name : employeeId} (${month})!`, 'success');
      
      // Dispatch payroll updated event
      window.dispatchEvent(new CustomEvent('payrollUpdated', { detail: { month } }));
    } catch (err) {
      window.app.showToast('Failed to save payroll record: ' + err.message, 'error');
    }
  }
}

