/**
 * BulkPayrollEntry - Format 2: Tabular Spreadsheet Mode for fast bulk entry of all employees
 */
class BulkPayrollEntry {
  constructor(apiClient) {
    this.api = apiClient;
    this.employees = [];
    this.currentRecords = [];
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.monthInput = document.getElementById('bulk-month');
    this.loadMonthBtn = document.getElementById('bulk-load-btn');
    this.quickFillBtn = document.getElementById('bulk-quick-fill-btn');
    this.saveAllBtn = document.getElementById('bulk-save-all-btn');
    this.tableBody = document.getElementById('bulk-table-tbody');
  }

  bindEvents() {
    window.addEventListener('employeesUpdated', (e) => {
      this.employees = e.detail;
      this.renderTable();
    });

    if (this.loadMonthBtn) {
      this.loadMonthBtn.addEventListener('click', () => this.loadMonthData());
    }

    if (this.quickFillBtn) {
      this.quickFillBtn.addEventListener('click', () => this.handleQuickFill());
    }

    if (this.saveAllBtn) {
      this.saveAllBtn.addEventListener('click', () => this.handleSaveAll());
    }
  }

  async loadMonthData() {
    const month = this.monthInput.value.trim();
    if (!month) {
      window.app.showToast('Please specify a month name (e.g. October 2026)', 'error');
      return;
    }

    try {
      const data = await this.api.getPayrollByMonth(month);
      this.currentRecords = data.records || [];
      this.renderTable();
      window.app.showToast(`Loaded ${this.currentRecords.length} saved entries for ${month}`, 'success');
    } catch (err) {
      // It might be a new month without saved records yet
      this.currentRecords = [];
      this.renderTable();
    }
  }

  handleQuickFill() {
    const daysStr = prompt('Enter default present days for all employees (e.g., 26 or 30):', '26');
    if (daysStr === null) return;
    const days = parseFloat(daysStr);
    if (isNaN(days) || days < 0) return;

    const rows = this.tableBody.querySelectorAll('tr[data-emp-id]');
    rows.forEach((tr) => {
      const pInput = tr.querySelector('.in-present');
      const cInput = tr.querySelector('.in-casual');
      const aInput = tr.querySelector('.in-absent');
      if (pInput) pInput.value = days;
      if (cInput) cInput.value = 0;
      if (aInput) aInput.value = 0;
      this.recalculateRow(tr);
    });
    window.app.showToast(`Filled all employees with ${days} present days!`, 'success');
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    if (this.employees.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No employees found. Please add employees in the Employee Management tab first.
          </td>
        </tr>
      `;
      return;
    }

    this.employees.forEach((emp) => {
      // Find existing saved record for this employee
      const existing = this.currentRecords.find((r) => r.employeeId === emp.id);

      const presentVal = existing ? existing.presentDays : 26;
      const casualVal = existing ? existing.casualLeaveDays : 0;
      const absentVal = existing ? existing.absentDays : 0;

      const tr = document.createElement('tr');
      tr.setAttribute('data-emp-id', emp.id);
      tr.setAttribute('data-base-salary', emp.baseSalary);

      tr.innerHTML = `
        <td><strong style="color: var(--primary);">${emp.id}</strong></td>
        <td>
          <strong>${emp.name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${emp.designation || 'Staff'}</div>
        </td>
        <td style="font-weight: 600;">₹${Number(emp.baseSalary).toLocaleString('en-IN')}</td>
        <td>
          <input type="number" step="0.5" min="0" max="31" class="grid-input in-present form-control" value="${presentVal}" />
        </td>
        <td>
          <input type="number" step="0.5" min="0" max="31" class="grid-input in-casual form-control" value="${casualVal}" />
        </td>
        <td>
          <input type="number" step="0.5" min="0" max="31" class="grid-input in-absent form-control" value="${absentVal}" />
        </td>
        <td class="out-paid-days" style="font-weight: 600;">-</td>
        <td class="out-loss-pay" style="color: var(--danger); font-weight: 600;">-</td>
        <td class="out-net-salary" style="color: var(--success); font-weight: 700; font-size: 1rem;">-</td>
      `;

      // Live recalculation on typing
      const inputs = tr.querySelectorAll('input.grid-input');
      inputs.forEach((input) => {
        input.addEventListener('input', () => this.recalculateRow(tr));
      });

      this.tableBody.appendChild(tr);
      this.recalculateRow(tr);
    });
  }

  recalculateRow(tr) {
    const baseSalary = parseFloat(tr.getAttribute('data-base-salary')) || 0;
    const present = parseFloat(tr.querySelector('.in-present').value) || 0;
    const casual = parseFloat(tr.querySelector('.in-casual').value) || 0;
    const absent = parseFloat(tr.querySelector('.in-absent').value) || 0;

    let totalDays = present + casual + absent;
    if (totalDays <= 0) totalDays = 30;

    const paidDays = present + casual;
    const dailyRate = baseSalary / totalDays;
    const lossOfPay = absent * dailyRate;
    const netSalary = paidDays * dailyRate;

    tr.querySelector('.out-paid-days').textContent = `${paidDays} d`;
    tr.querySelector('.out-loss-pay').textContent = `-₹${lossOfPay.toFixed(2)}`;
    tr.querySelector('.out-net-salary').textContent = `₹${netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async handleSaveAll() {
    const month = this.monthInput.value.trim();
    if (!month) {
      window.app.showToast('Please enter the month name (e.g. October 2026)', 'error');
      return;
    }

    const rows = this.tableBody.querySelectorAll('tr[data-emp-id]');
    if (rows.length === 0) {
      window.app.showToast('No employee rows to save', 'error');
      return;
    }

    const records = [];
    rows.forEach((tr) => {
      const employeeId = tr.getAttribute('data-emp-id');
      const presentDays = parseFloat(tr.querySelector('.in-present').value) || 0;
      const casualLeaveDays = parseFloat(tr.querySelector('.in-casual').value) || 0;
      const absentDays = parseFloat(tr.querySelector('.in-absent').value) || 0;

      records.push({
        employeeId,
        presentDays,
        casualLeaveDays,
        absentDays
      });
    });

    try {
      this.saveAllBtn.disabled = true;
      this.saveAllBtn.textContent = 'Saving...';

      await this.api.saveBatchPayroll({
        month,
        records
      });

      window.app.showToast(`Saved all ${records.length} employee salary records for ${month}!`, 'success');
      window.dispatchEvent(new CustomEvent('payrollUpdated', { detail: { month } }));
    } catch (err) {
      window.app.showToast('Failed to save batch payroll: ' + err.message, 'error');
    } finally {
      this.saveAllBtn.disabled = false;
      this.saveAllBtn.textContent = 'Save All Entries';
    }
  }
}

