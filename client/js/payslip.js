/**
 * PayslipViewer - Individual Employee Salary Slip Generator with Amount in Words & Print
 */
class PayslipViewer {
  constructor(apiClient) {
    this.api = apiClient;
    this.currentRecord = null;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.monthInput = document.getElementById('slip-month-input');
    this.monthSelect = document.getElementById('slip-month-select');
    this.empSelect = document.getElementById('slip-emp-select');
    this.loadBtn = document.getElementById('slip-load-btn');
    this.printBtn = document.getElementById('slip-print-btn');
    this.slipCard = document.getElementById('payslip-display-area');

    // Slip Content Elements
    this.slipMonthText = document.getElementById('slip-out-month');
    this.slipEmpName = document.getElementById('slip-out-name');
    this.slipEmpId = document.getElementById('slip-out-id');
    this.slipEmpDesig = document.getElementById('slip-out-desig');
    this.slipPresentDays = document.getElementById('slip-out-present');
    this.slipCasualDays = document.getElementById('slip-out-casual');
    this.slipAbsentDays = document.getElementById('slip-out-absent');
    this.slipTotalDays = document.getElementById('slip-out-total');
    this.slipPaidDays = document.getElementById('slip-out-paid');

    this.slipBaseSalary = document.getElementById('slip-out-base');
    this.slipLossOfPay = document.getElementById('slip-out-lop');
    this.slipNetSalary = document.getElementById('slip-out-net');
    this.slipAmountWords = document.getElementById('slip-out-words');
  }

  bindEvents() {
    window.addEventListener('employeesUpdated', (e) => {
      this.populateEmployeeSelect(e.detail);
    });

    window.addEventListener('payrollUpdated', (e) => {
      this.refreshMonthsList();
      if (e.detail && e.detail.month && this.monthInput) {
        this.monthInput.value = e.detail.month;
      }
    });

    if (this.loadBtn) {
      this.loadBtn.addEventListener('click', () => {
        const m = this.monthInput.value.trim();
        const empId = this.empSelect.value;
        if (m && empId) this.loadPayslip(m, empId);
        else window.app.showToast('Please select both month and employee', 'error');
      });
    }

    if (this.monthSelect) {
      this.monthSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.monthInput.value = e.target.value;
        }
      });
    }

    if (this.printBtn) {
      this.printBtn.addEventListener('click', () => this.printPayslip());
    }
  }

  populateEmployeeSelect(employees) {
    if (!this.empSelect) return;
    const current = this.empSelect.value;
    this.empSelect.innerHTML = '<option value="">-- Choose Employee --</option>';
    employees.forEach((emp) => {
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

    if (this.slipMonthText) this.slipMonthText.textContent = r.month;
    if (this.slipEmpName) this.slipEmpName.textContent = r.employeeName;
    if (this.slipEmpId) this.slipEmpId.textContent = r.employeeId;
    if (this.slipEmpDesig) this.slipEmpDesig.textContent = r.designation || 'Staff';

    if (this.slipPresentDays) this.slipPresentDays.textContent = `${r.presentDays} days`;
    if (this.slipCasualDays) this.slipCasualDays.textContent = `${r.casualLeaveDays} days (Paid)`;
    if (this.slipAbsentDays) this.slipAbsentDays.textContent = `${r.absentDays} days (Unpaid)`;
    if (this.slipTotalDays) this.slipTotalDays.textContent = `${r.totalDays} days`;
    if (this.slipPaidDays) this.slipPaidDays.textContent = `${r.paidDays} days`;

    if (this.slipBaseSalary) this.slipBaseSalary.textContent = `₹${Number(r.baseSalary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (this.slipLossOfPay) this.slipLossOfPay.textContent = `-₹${Number(r.lossOfPay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (this.slipNetSalary) this.slipNetSalary.textContent = `₹${Number(r.netSalary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    if (this.slipAmountWords) {
      this.slipAmountWords.textContent = this.numberToWords(Math.round(r.netSalary)) + ' Rupees Only';
    }

    if (this.slipCard) {
      this.slipCard.style.display = 'block';
    }
  }

  printPayslip() {
    if (!this.currentRecord) {
      window.app.showToast('Please load a salary slip first', 'error');
      return;
    }
    window.app.prepareAndPrint('payslip-tab');
  }

  numberToWords(num) {
    if (num === 0) return 'Zero';
    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    return inWords(num);
  }
}

