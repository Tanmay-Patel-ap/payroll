/**
 * SalarySheetManager - Central Monthly Salary Sheet (Payroll Register) with summary cards & Excel/CSV export
 */
class SalarySheetManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.currentData = null;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.monthInput = document.getElementById('sheet-month-input');
    this.monthSelect = document.getElementById('sheet-month-select');
    this.loadBtn = document.getElementById('sheet-load-btn');
    this.exportCsvBtn = document.getElementById('sheet-export-csv-btn');
    this.printBtn = document.getElementById('sheet-print-btn');

    // Metrics
    this.metricTotalNet = document.getElementById('sheet-total-net');
    this.metricTotalBase = document.getElementById('sheet-total-base');
    this.metricTotalLOP = document.getElementById('sheet-total-lop');
    this.metricTotalEmps = document.getElementById('sheet-total-emps');

    // Table
    this.tableBody = document.getElementById('sheet-tbody');
    this.tableFoot = document.getElementById('sheet-tfoot');
    this.sheetTitle = document.getElementById('sheet-display-title');
  }

  bindEvents() {
    window.addEventListener('payrollUpdated', (e) => {
      this.refreshMonthsList();
      if (e.detail && e.detail.month) {
        if (this.monthInput) this.monthInput.value = e.detail.month;
        this.loadSheet(e.detail.month);
      }
    });

    if (this.loadBtn) {
      this.loadBtn.addEventListener('click', () => {
        const m = this.monthInput.value.trim();
        if (m) this.loadSheet(m);
      });
    }

    if (this.monthSelect) {
      this.monthSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.monthInput.value = e.target.value;
          this.loadSheet(e.target.value);
        }
      });
    }

    if (this.exportCsvBtn) {
      this.exportCsvBtn.addEventListener('click', () => this.exportCsv());
    }

    if (this.printBtn) {
      this.printBtn.addEventListener('click', () => this.printSheet());
    }
  }

  async refreshMonthsList() {
    if (!this.monthSelect) return;
    try {
      const months = await this.api.getRecordedMonths();
      const current = this.monthSelect.value;
      this.monthSelect.innerHTML = '<option value="">-- Or Pick Saved Month --</option>';
      months.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        this.monthSelect.appendChild(opt);
      });
      if (current) this.monthSelect.value = current;
    } catch (err) {
      console.error('Failed to load recorded months:', err);
    }
  }

  async loadSheet(month) {
    if (!month) return;
    try {
      this.currentData = await this.api.getPayrollByMonth(month);
      this.render();
    } catch (err) {
      this.currentData = null;
      this.renderEmpty(`No payroll records found for "${month}". Please enter data in Single or Tabular Entry mode first.`);
    }
  }

  render() {
    if (!this.currentData || !this.currentData.records) {
      this.renderEmpty('Select a month to view the Central Salary Sheet.');
      return;
    }

    const { month, records, summary } = this.currentData;

    if (this.sheetTitle) {
      this.sheetTitle.textContent = `Central Salary Sheet — ${month}`;
    }

    // Update Summary Cards
    if (this.metricTotalNet) this.metricTotalNet.textContent = `₹${summary.totalNetSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (this.metricTotalBase) this.metricTotalBase.textContent = `₹${summary.totalBaseSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (this.metricTotalLOP) this.metricTotalLOP.textContent = `-₹${summary.totalLossOfPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (this.metricTotalEmps) this.metricTotalEmps.textContent = `${summary.employeeCount} Staff`;

    // Render Table Rows
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    if (records.length === 0) {
      this.renderEmpty(`No records found for ${month}.`);
      return;
    }

    records.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong style="color: var(--primary);">${r.employeeId}</strong></td>
        <td>
          <strong>${r.employeeName}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${r.designation || 'Staff'}</div>
        </td>
        <td>₹${Number(r.baseSalary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align: center;">${r.presentDays}</td>
        <td style="text-align: center; color: var(--accent);">${r.casualLeaveDays}</td>
        <td style="text-align: center; color: var(--danger); font-weight: 600;">${r.absentDays}</td>
        <td style="text-align: center; font-weight: 700;">${r.paidDays}</td>
        <td>₹${Number(r.dailyRate).toFixed(2)}</td>
        <td style="color: var(--danger); font-weight: 600;">-₹${Number(r.lossOfPay).toFixed(2)}</td>
        <td style="color: var(--success); font-weight: 700; font-size: 0.95rem;">
          ₹${Number(r.netSalary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
        <td class="no-print" style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="window.payslipViewer.loadPayslip('${r.month}', '${r.employeeId}')">
            View Slip
          </button>
        </td>
      `;
      this.tableBody.appendChild(tr);
    });

    // Render Footer Totals
    if (this.tableFoot) {
      this.tableFoot.innerHTML = `
        <tr>
          <td colspan="3" style="font-weight: 800; font-size: 0.95rem;">GRAND TOTALS (${summary.employeeCount} Employees)</td>
          <td>₹${summary.totalBaseSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: center;">${summary.totalPresentDays}</td>
          <td style="text-align: center;">${summary.totalCasualLeaveDays}</td>
          <td style="text-align: center; color: var(--danger);">${summary.totalAbsentDays}</td>
          <td style="text-align: center;">-</td>
          <td>-</td>
          <td style="color: var(--danger); font-weight: 700;">-₹${summary.totalLossOfPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="color: var(--success); font-weight: 800; font-size: 1.05rem;">
            ₹${summary.totalNetSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td class="no-print"></td>
        </tr>
      `;
    }
  }

  renderEmpty(msg) {
    if (this.tableBody) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
            ${msg}
          </td>
        </tr>
      `;
    }
    if (this.tableFoot) this.tableFoot.innerHTML = '';
    if (this.metricTotalNet) this.metricTotalNet.textContent = '₹0.00';
    if (this.metricTotalBase) this.metricTotalBase.textContent = '₹0.00';
    if (this.metricTotalLOP) this.metricTotalLOP.textContent = '-₹0.00';
    if (this.metricTotalEmps) this.metricTotalEmps.textContent = '0 Staff';
  }

  exportCsv() {
    if (!this.currentData || !this.currentData.records || this.currentData.records.length === 0) {
      window.app.showToast('No salary sheet data to export', 'error');
      return;
    }

    const { month, records, summary } = this.currentData;
    const headers = [
      'S.No', 'Emp ID', 'Employee Name', 'Designation', 'Base Salary',
      'Present Days', 'Casual Leave Days', 'Absent Days', 'Total Days',
      'Paid Days', 'Daily Rate', 'Loss of Pay (Deduction)', 'Net Salary Payable'
    ];

    const rows = records.map((r, i) => [
      i + 1,
      `"${r.employeeId}"`,
      `"${r.employeeName}"`,
      `"${r.designation}"`,
      r.baseSalary,
      r.presentDays,
      r.casualLeaveDays,
      r.absentDays,
      r.totalDays,
      r.paidDays,
      r.dailyRate,
      r.lossOfPay,
      r.netSalary
    ]);

    // Add totals row
    rows.push([
      'TOTAL', '', '', '', summary.totalBaseSalary,
      summary.totalPresentDays, summary.totalCasualLeaveDays, summary.totalAbsentDays, '',
      '', '', summary.totalLossOfPay, summary.totalNetSalary
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      `"STIFLINK MANAGEMENT (OPC) PVT. LTD"`,
      `"OFFICE NO. 301 FIFTH FLOOR, ADHARHSILA COMPLEX, GANDHI MAIDAN, PATNA, BIHAR 800001."`,
      `"Central Salary Sheet - ${month}"`,
      '',
      headers.join(','),
      ...rows.map((e) => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Salary_Sheet_${month.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.app.showToast(`Exported Salary Sheet for ${month} as CSV!`, 'success');
  }

  printSheet() {
    if (!this.currentData || !this.currentData.records || this.currentData.records.length === 0) {
      window.app.showToast('No salary sheet data to print', 'error');
      return;
    }
    window.app.prepareAndPrint('salary-sheet-tab');
  }
}

