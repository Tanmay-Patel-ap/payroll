/**
 * SalarySheetManager - Merged Central Salary Sheet & Tabular Bulk Entry.
 * Provides an interactive master payroll register with editable attendance, advance, and remarks,
 * uneditable computed figures, live metrics & grand totals recalculation, Excel synchronization,
 * financial year & month dropdown selectors, and column visibility toggle via ColumnVisibilityController.
 */
class SalarySheetManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.employees = [];
    this.savedRecords = [];
    this.userEdits = {}; // empId -> { presentDays, casualLeaveDays, absentDays, advanceDeducted, remarks }
    this.sortField = 'employeeId';
    this.sortDirection = 'asc';
    this.searchTerm = '';
    this.isMonthDraftActive = false;

    this.availableCols = [
      { key: 'index', label: 'Status / #' },
      { key: 'id', label: 'Emp ID' },
      { key: 'name', label: 'Employee Name' },
      { key: 'desig', label: 'Designation' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'bankAccount', label: 'Bank A/C No' },
      { key: 'bankIfsc', label: 'IFSC Code' },
      { key: 'pan', label: 'PAN Number' },
      { key: 'salary', label: 'Monthly Base (₹)' },
      { key: 'present', label: 'Present Days' },
      { key: 'casual', label: 'Casual Leave' },
      { key: 'absent', label: 'Absent Days' },
      { key: 'sundays', label: 'Sundays' },
      { key: 'paid', label: 'Paid Days' },
      { key: 'totalDays', label: 'Total Days' },
      { key: 'gross', label: 'Gross Salary (₹)' },
      { key: 'advance', label: 'Advance Recovery (₹)' },
      { key: 'net', label: 'Net Payable Salary (₹)' },
      { key: 'remarks', label: 'Remarks' },
      { key: 'action', label: 'Slip Actions' }
    ];

    this.initElements();
    this.initColumnController();
    this.bindEvents();
  }

  initElements() {
    this.fySelect = document.getElementById('sheet-fy-select');
    this.monthSelect = document.getElementById('sheet-month-select');
    this.searchInput = document.getElementById('sheet-search-input');
    this.saveBtn = document.getElementById('sheet-save-btn');

    // Column dropdown elements
    this.colDropdown = document.getElementById('sheet-col-dropdown');
    this.colBtn = document.getElementById('sheet-col-btn');
    this.colMenu = document.getElementById('sheet-col-menu');
    this.colList = document.getElementById('sheet-col-list');
    this.colAllBtn = document.getElementById('sheet-col-all');
    this.colResetBtn = document.getElementById('sheet-col-reset');

    // Table elements
    this.table = document.getElementById('sheet-table');
    this.tableBody = document.getElementById('sheet-tbody');
    this.tableFoot = document.getElementById('sheet-tfoot');
    this.sheetTitle = document.getElementById('sheet-display-title');
  }

  initColumnController() {
    this.colController = new ColumnVisibilityController({
      storageKey: 'payslip_sheet_hidden_cols',
      tableEl: this.table,
      dropdownEl: this.colDropdown,
      btnEl: this.colBtn,
      menuEl: this.colMenu,
      listEl: this.colList,
      allBtn: this.colAllBtn,
      resetBtn: this.colResetBtn,
      availableCols: this.availableCols,
      defaultHidden: [],
      btnPrefix: 'Columns'
    });
  }

  bindEvents() {
    window.addEventListener('employeesUpdated', (e) => {
      this.employees = e.detail || [];
      this.loadSheet(this.getSelectedMonth());
    });

    window.addEventListener('payrollUpdated', (e) => {
      if (e.detail && e.detail.month) {
        const { fy, month } = PayrollUtils.parseMonthStringToFyAndMonth(e.detail.month);
        if (this.fySelect) this.fySelect.value = fy;
        if (this.monthSelect) this.monthSelect.value = month;
        this.loadSheet(e.detail.month);
      }
    });

    if (this.fySelect) {
      this.fySelect.addEventListener('change', () => {
        this.captureCurrentTableInputs();
        this.loadSheet(this.getSelectedMonth());
      });
    }

    if (this.monthSelect) {
      this.monthSelect.addEventListener('change', () => {
        this.captureCurrentTableInputs();
        this.loadSheet(this.getSelectedMonth());
      });
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.captureCurrentTableInputs();
        this.searchTerm = e.target.value.trim();
        this.render();
      });
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.handleSaveAll());
    }

    // Standardized table sorting via PayrollUtils
    PayrollUtils.bindTableSorting(
      this.table,
      () => ({ field: this.sortField, direction: this.sortDirection }),
      (field, dir) => {
        this.captureCurrentTableInputs();
        this.sortField = field;
        this.sortDirection = dir;
        this.render();
      }
    );
  }

  getSelectedMonth() {
    const fy = this.fySelect ? this.fySelect.value : '2026-27';
    const m = this.monthSelect ? this.monthSelect.value : 'October';
    return PayrollUtils.getCombinedMonth(fy, m);
  }

  setMonth(monthStr) {
    const { fy, month } = PayrollUtils.parseMonthStringToFyAndMonth(monthStr);
    if (this.fySelect) this.fySelect.value = fy;
    if (this.monthSelect) this.monthSelect.value = month;
    this.loadSheet(monthStr);
  }

  updateHeaderClasses() {
    PayrollUtils.updateSortHeaders(this.table, this.sortField, this.sortDirection);
  }

  getDaysInMonth(monthStr) {
    return PayrollUtils.getDaysInMonth(monthStr);
  }

  getSundaysInMonth(monthStr) {
    return PayrollUtils.getSundaysInMonth(monthStr);
  }

  captureCurrentTableInputs() {
    if (!this.tableBody) return;
    const rows = this.tableBody.querySelectorAll('tr[data-emp-id]');
    rows.forEach((tr) => {
      const empId = tr.getAttribute('data-emp-id');
      const p = tr.querySelector('.in-present');
      const c = tr.querySelector('.in-casual');
      const a = tr.querySelector('.in-absent');
      const adv = tr.querySelector('.in-advance');
      const rem = tr.querySelector('.in-remarks');

      if (empId) {
        this.userEdits[empId] = {
          presentDays: p ? parseFloat(p.value) || 0 : 0,
          casualLeaveDays: c ? parseFloat(c.value) || 0 : 0,
          absentDays: a ? parseFloat(a.value) || 0 : 0,
          advanceDeducted: adv ? parseFloat(adv.value) || 0 : 0,
          remarks: rem ? rem.value.trim() : ''
        };
      }
    });
  }

  async loadSheet(month) {
    if (!month) month = this.getSelectedMonth();
    this.userEdits = {}; // Reset transient edits when switching month
    this.isMonthDraftActive = false;
    try {
      const data = await this.api.getPayrollByMonth(month);
      this.savedRecords = (data && data.records) ? data.records : [];
    } catch (err) {
      this.savedRecords = [];
    }

    if (window.employeeManager && Array.isArray(window.employeeManager.employees)) {
      this.employees = window.employeeManager.employees;
    } else {
      try {
        const fetched = await this.api.getEmployees();
        this.employees = Array.isArray(fetched) ? fetched : [];
      } catch (err) {
        this.employees = [];
      }
    }

    this.render();
  }

  getUnifiedRows() {
    const month = this.getSelectedMonth();
    const daysInMonth = PayrollUtils.getDaysInMonth(month);
    const calculatedSundays = PayrollUtils.getSundaysInMonth(month);
    const currentMonthIndex = PayrollUtils.getMonthYearIndex(month);

    // If there are no saved records from Excel and no local draft active, return empty
    if ((!this.savedRecords || this.savedRecords.length === 0) && !this.isMonthDraftActive) {
      return [];
    }

    // Build map of saved records
    const savedMap = {};
    this.savedRecords.forEach((r) => {
      savedMap[r.employeeId] = r;
    });

    // Active employees who are within their active working period for this month
    const activeEmps = this.employees.filter((e) => {
      if (e.isActive === false) return false;
      const joinStr = e.joinDate || e.doj;
      if (joinStr) {
        const joinIndex = PayrollUtils.getJoinMonthYearIndex(joinStr);
        if (joinIndex > 0 && currentMonthIndex < joinIndex) return false;
      }
      const leaveStr = e.leaveDate;
      if (leaveStr) {
        const leaveIndex = PayrollUtils.getJoinMonthYearIndex(leaveStr);
        if (leaveIndex > 0 && currentMonthIndex > leaveIndex) return false;
      }
      return true;
    });

    // If an employee in saved records is not in activeEmps, include them only if within working dates
    const allIds = new Set(activeEmps.map((e) => e.id));
    const allEmps = [...activeEmps];
    this.savedRecords.forEach((r) => {
      if (!allIds.has(r.employeeId)) {
        const empMatch = this.employees.find((e) => e.id === r.employeeId);
        if (empMatch) {
          const joinStr = empMatch.joinDate || empMatch.doj;
          if (joinStr) {
            const joinIndex = PayrollUtils.getJoinMonthYearIndex(joinStr);
            if (joinIndex > 0 && currentMonthIndex < joinIndex) return;
          }
          const leaveStr = empMatch.leaveDate;
          if (leaveStr) {
            const leaveIndex = PayrollUtils.getJoinMonthYearIndex(leaveStr);
            if (leaveIndex > 0 && currentMonthIndex > leaveIndex) return;
          }
        }
        allEmps.push({
          id: r.employeeId,
          name: r.employeeName,
          designation: r.designation || 'Staff',
          salary: r.monthlySalary || 20000,
          bankName: r.bankName || '',
          bankAccountNo: r.bankAccountNo || '',
          bankIfscCode: r.bankIfscCode || '',
          panTaxNo: r.panTaxNo || '',
          isActive: false
        });
        allIds.add(r.employeeId);
      }
    });

    return allEmps.map((emp) => {
      const saved = savedMap[emp.id];
      const edits = this.userEdits[emp.id];

      const monthlySalary = parseFloat(emp.salary) || parseFloat(emp.monthlySalary) || 0;

      // Sundays is uneditable and already calculated based on the month
      const sundays = calculatedSundays;
      let presentDays = 0;
      let casualLeaveDays = 0;
      let absentDays = 0;
      let advanceDeducted = 0;
      let remarks = '';

      if (saved) {
        presentDays = saved.presentDays !== undefined ? saved.presentDays : 0;
        casualLeaveDays = saved.casualLeaveDays !== undefined ? saved.casualLeaveDays : 0;
        absentDays = saved.absentDays !== undefined ? saved.absentDays : 0;
        advanceDeducted = saved.advanceDeducted || 0;
        remarks = saved.remarks || '';
      }

      if (edits) {
        presentDays = edits.presentDays !== undefined ? edits.presentDays : presentDays;
        casualLeaveDays = edits.casualLeaveDays !== undefined ? edits.casualLeaveDays : casualLeaveDays;
        absentDays = edits.absentDays !== undefined ? edits.absentDays : absentDays;
        advanceDeducted = edits.advanceDeducted !== undefined ? edits.advanceDeducted : advanceDeducted;
        remarks = edits.remarks !== undefined ? edits.remarks : remarks;
      }

      // Calculations: Paid Days = Present + Casual + Sundays
      const paidDays = presentDays + casualLeaveDays + sundays;
      const earnedSalary = daysInMonth > 0 ? Math.round(((paidDays / daysInMonth) * monthlySalary) * 100) / 100 : 0;

      const grossSalary = earnedSalary;
      const totalDeductions = Math.round(advanceDeducted * 100) / 100;
      const netSalary = Math.max(0, Math.round((grossSalary - advanceDeducted) * 100) / 100);

      const attendanceSum = presentDays + casualLeaveDays + sundays + absentDays;
      const isComplete = (attendanceSum === daysInMonth);
      const status = isComplete ? 1 : 0;

      return {
        month,
        employeeId: emp.id,
        employeeName: emp.name,
        designation: emp.designation || 'Staff',
        bankName: emp.bankName || '',
        bankAccountNo: emp.bankAccountNo || '',
        bankIfscCode: emp.bankIfscCode || '',
        panTaxNo: emp.panTaxNo || '',
        leaveDate: emp.leaveDate || (saved ? saved.leaveDate : '') || '',
        isActive: emp.isActive !== undefined ? emp.isActive : true,
        monthlySalary,
        totalDays: daysInMonth,
        presentDays,
        casualLeaveDays,
        sundays,
        absentDays,
        paidDays,
        earnedSalary,
        grossSalary,
        lossOfPay: 0,
        advanceDeducted,
        totalDeductions,
        netSalary,
        remarks,
        attendanceSum,
        isComplete,
        status,
        isSaved: !!saved
      };
    });
  }

  getSortedAndFilteredRows(rows) {
    let list = [...rows];

    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter((r) =>
        (r.employeeId && r.employeeId.toLowerCase().includes(q)) ||
        (r.employeeName && r.employeeName.toLowerCase().includes(q)) ||
        (r.designation && r.designation.toLowerCase().includes(q)) ||
        (r.bankName && r.bankName.toLowerCase().includes(q)) ||
        (r.panTaxNo && r.panTaxNo.toLowerCase().includes(q))
      );
    }

    if (this.sortField === 'status') {
      list.sort((a, b) => {
        if (a.status !== b.status) {
          // Incomplete (0) first on asc, Complete (1) first on desc
          return this.sortDirection === 'asc' ? a.status - b.status : b.status - a.status;
        }
        return PayrollUtils.naturalCompare(a.employeeId, b.employeeId);
      });
      return list;
    }

    list.sort((a, b) => {
      const numericFields = [
        'monthlySalary', 'totalDays', 'presentDays', 'casualLeaveDays', 'sundays', 'absentDays',
        'paidDays', 'earnedSalary', 'grossSalary', 'advanceDeducted', 'totalDeductions', 'netSalary'
      ];

      if (numericFields.includes(this.sortField)) {
        const valA = parseFloat(a[this.sortField]) || 0;
        const valB = parseFloat(b[this.sortField]) || 0;
        return this.sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const cmp = PayrollUtils.naturalCompare(a[this.sortField], b[this.sortField]);
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }

  render() {
    const month = this.getSelectedMonth();
    if (this.sheetTitle) {
      this.sheetTitle.textContent = `SALARY SHEET — ${month}`;
    }

    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';
    this.updateHeaderClasses();

    const allRows = this.getUnifiedRows();
    const displayRows = this.getSortedAndFilteredRows(allRows);

    if (allRows.length === 0) {
      if (!this.employees || this.employees.length === 0) {
        this.tableBody.innerHTML = `
          <tr>
            <td colspan="25" style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
              No staff records found in Employee Directory. Add employees in the "Manage Employees" tab first.
            </td>
          </tr>
        `;
      } else {
        this.tableBody.innerHTML = `
          <tr>
            <td colspan="25" style="text-align: center; color: var(--text-muted); padding: 3.5rem 1rem;">
              <div style="font-size: 2.2rem; color: #94a3b8; margin-bottom: 0.5rem;"><i class="fas fa-file-excel"></i></div>
              <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">
                No Salary Sheet Records for ${PayrollUtils.escapeHtml(month)}
              </h4>
              <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.25rem;">
                The central Excel salary sheet for this month does not exist on disk.
              </p>
              <button type="button" id="btn-init-sheet" class="btn btn-primary" style="padding: 0.5rem 1.25rem; font-weight: 600;">
                <i class="fas fa-plus"></i> Initialize Sheet for ${PayrollUtils.escapeHtml(month)}
              </button>
            </td>
          </tr>
        `;
        const initBtn = this.tableBody.querySelector('#btn-init-sheet');
        if (initBtn) {
          initBtn.addEventListener('click', () => {
            this.isMonthDraftActive = true;
            this.render();
          });
        }
      }
      this.updateMetricsAndFooter([], 0);
      this.colController.applyVisibility();
      return;
    }

    if (displayRows.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="25" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No staff records matching "<strong>${PayrollUtils.escapeHtml(this.searchTerm)}</strong>".
          </td>
        </tr>
      `;
      this.updateMetricsAndFooter(allRows, displayRows.length);
      this.colController.applyVisibility();
      return;
    }

    displayRows.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-emp-id', r.employeeId);

      const isOut = Boolean((r.leaveDate && r.leaveDate.trim().length > 0) || r.isActive === false);
      if (isOut) {
        tr.classList.add('row-employee-out');
      }

      const attendanceSum = (r.presentDays || 0) + (r.casualLeaveDays || 0) + (r.sundays || 0) + (r.absentDays || 0);
      const isComplete = (attendanceSum === r.totalDays);

      tr.innerHTML = `
        <td data-col="index" style="white-space: nowrap; width: 52px; text-align: center;">
          <span class="attendance-dot ${isComplete ? 'dot-complete' : 'dot-incomplete'}" 
                title="${isComplete ? `Attendance complete: ${attendanceSum}/${r.totalDays} days accounted for.` : `Attendance incomplete: ${attendanceSum}/${r.totalDays} days accounted for (Present: ${r.presentDays}, Casual: ${r.casualLeaveDays}, Sundays: ${r.sundays}, Absent: ${r.absentDays} — must equal ${r.totalDays} days in month).`}"></span>
          <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500;">${idx + 1}</span>
        </td>
        <td data-col="id">
          <strong style="color: var(--primary); font-size: 0.88rem;">${PayrollUtils.escapeHtml(r.employeeId)}</strong>
          ${r.isSaved ? '' : '<span title="Unsaved entry" style="font-size:0.65rem; color:#f59e0b; margin-left:3px;">●</span>'}
        </td>
        <td data-col="name" style="white-space: nowrap;">
          <strong style="color: var(--text-primary);">${PayrollUtils.escapeHtml(r.employeeName)}</strong>
        </td>
        <td data-col="desig">
          <span class="badge" style="background: #e0e7ff; color: var(--primary); font-size: 0.75rem;">
            ${PayrollUtils.escapeHtml(r.designation)}
          </span>
        </td>
        <td data-col="bankName" style="font-size: 0.82rem; white-space: nowrap;">
          ${PayrollUtils.escapeHtml(r.bankName || '—')}
        </td>
        <td data-col="bankAccount" style="font-size: 0.82rem; white-space: nowrap;">
          ${PayrollUtils.escapeHtml(r.bankAccountNo || '—')}
        </td>
        <td data-col="bankIfsc" style="font-size: 0.82rem; white-space: nowrap;">
          ${PayrollUtils.escapeHtml(r.bankIfscCode || '—')}
        </td>
        <td data-col="pan" style="font-size: 0.82rem; white-space: nowrap;">
          ${PayrollUtils.escapeHtml(r.panTaxNo || '—')}
        </td>
        <td data-col="salary" style="font-weight: 600; text-align: right; white-space: nowrap;">
          ${PayrollUtils.formatCurrency(r.monthlySalary, 0)}
        </td>
        <td data-col="present" style="text-align: center; background: #f8fafc;">
          <input type="number" step="0.5" min="0" max="31" class="grid-input-sm in-present" value="${r.presentDays}" />
        </td>
        <td data-col="casual" style="text-align: center; background: #f8fafc;">
          <input type="number" step="0.5" min="0" max="31" class="grid-input-sm in-casual" value="${r.casualLeaveDays}" />
        </td>
        <td data-col="absent" style="text-align: center; background: #f8fafc;">
          <input type="number" step="0.5" min="0" max="31" class="grid-input-sm in-absent" value="${r.absentDays}" />
        </td>
        <td data-col="sundays" class="cell-sundays" style="text-align: center; font-weight: 600; color: var(--text-secondary);">
          ${r.sundays}
        </td>
        <td data-col="paid" class="cell-paid" style="text-align: center; font-weight: 700; color: var(--primary);">
          ${r.paidDays}
        </td>
        <td data-col="totalDays" class="cell-total-days" style="text-align: center; font-weight: 600; color: var(--text-secondary);">
          ${r.totalDays}
        </td>
        <td data-col="gross" class="cell-gross" style="font-weight: 700; text-align: right; color: var(--primary); white-space: nowrap;">
          ${PayrollUtils.formatCurrency(r.grossSalary, 2)}
        </td>
        <td data-col="advance" style="text-align: right; background: #f8fafc;">
          <input type="number" step="10" min="0" class="grid-input-md in-advance" value="${r.advanceDeducted}" style="color: var(--danger);" />
        </td>
        <td data-col="net" class="cell-net" style="font-weight: 800; text-align: right; color: var(--success); font-size: 0.95rem; white-space: nowrap;">
          ${PayrollUtils.formatCurrency(r.netSalary, 2)}
        </td>
        <td data-col="remarks" style="background: #f8fafc;">
          <input type="text" class="grid-input-text in-remarks" value="${PayrollUtils.escapeHtml(r.remarks)}" placeholder="Note..." />
        </td>
        <td data-col="action" style="white-space: nowrap; text-align: center;" class="no-print">
          <button type="button" class="btn btn-secondary btn-sm row-slip-btn" title="View Payslip">🧾 View Slip</button>
          <button type="button" class="btn btn-primary btn-sm row-save-slip-btn" title="Save Payslip PDF to designated folder & download">💾 Save Slip</button>
        </td>
      `;

      // Live recalculation on user input
      const inputs = tr.querySelectorAll('input');
      inputs.forEach((input) => {
        input.addEventListener('input', () => {
          this.handleRowChange(tr, r);
          this.recalculateTotalsFromDom();
        });
      });

      // Actions
      const slipBtn = tr.querySelector('.row-slip-btn');
      if (slipBtn) {
        slipBtn.addEventListener('click', () => {
          if (window.payslipViewer) {
            window.payslipViewer.loadPayslip(month, r.employeeId);
          }
        });
      }

      const saveSlipBtn = tr.querySelector('.row-save-slip-btn');
      if (saveSlipBtn) {
        saveSlipBtn.addEventListener('click', () => {
          this.handleSaveSlip(r, tr);
        });
      }

      this.tableBody.appendChild(tr);
    });

    this.updateMetricsAndFooter(allRows, displayRows.length);
    this.colController.applyVisibility();
  }

  handleRowChange(tr, originalRecord) {
    const pVal = parseFloat(tr.querySelector('.in-present')?.value) || 0;
    const cVal = parseFloat(tr.querySelector('.in-casual')?.value) || 0;
    const aVal = parseFloat(tr.querySelector('.in-absent')?.value) || 0;
    const advVal = parseFloat(tr.querySelector('.in-advance')?.value) || 0;
    const remVal = tr.querySelector('.in-remarks')?.value || '';

    const empId = tr.getAttribute('data-emp-id');
    this.userEdits[empId] = {
      presentDays: pVal,
      casualLeaveDays: cVal,
      absentDays: aVal,
      advanceDeducted: advVal,
      remarks: remVal.trim()
    };

    const totalDays = originalRecord.totalDays;
    const sundays = originalRecord.sundays;
    const monthlySalary = originalRecord.monthlySalary;

    const paidDays = pVal + cVal + sundays;
    const earnedSalary = totalDays > 0 ? Math.round(((paidDays / totalDays) * monthlySalary) * 100) / 100 : 0;

    const grossSalary = earnedSalary;
    const totalDeductions = Math.round(advVal * 100) / 100;
    const netSalary = Math.max(0, Math.round((grossSalary - advVal) * 100) / 100);

    // Update DOM cells
    const paidCell = tr.querySelector('.cell-paid');
    if (paidCell) paidCell.textContent = paidDays;

    const earnedCell = tr.querySelector('.cell-earned');
    if (earnedCell) earnedCell.textContent = PayrollUtils.formatCurrency(earnedSalary, 2);

    const grossCell = tr.querySelector('.cell-gross');
    if (grossCell) grossCell.textContent = PayrollUtils.formatCurrency(grossSalary, 2);

    const netCell = tr.querySelector('.cell-net');
    if (netCell) netCell.textContent = PayrollUtils.formatCurrency(netSalary, 2);

    // Update completion dot
    const attendanceSum = pVal + cVal + sundays + aVal;
    const isComplete = (attendanceSum === totalDays);
    const dotEl = tr.querySelector('.attendance-dot');
    if (dotEl) {
      dotEl.className = `attendance-dot ${isComplete ? 'dot-complete' : 'dot-incomplete'}`;
      dotEl.title = isComplete
        ? `Attendance complete: ${attendanceSum}/${totalDays} days accounted for.`
        : `Attendance incomplete: ${attendanceSum}/${totalDays} days accounted for (Present: ${pVal}, Casual: ${cVal}, Sundays: ${sundays}, Absent: ${aVal} — must equal ${totalDays} days in month).`;
    }
  }

  recalculateTotalsFromDom() {
    let totSalary = 0, totPresent = 0, totCasual = 0, totSundays = 0, totAbsent = 0;
    let totPaid = 0, totGross = 0, totAdv = 0, totNet = 0;
    let count = 0;

    const rows = this.tableBody.querySelectorAll('tr[data-emp-id]');
    rows.forEach((tr) => {
      count++;
      const pVal = parseFloat(tr.querySelector('.in-present')?.value) || 0;
      const cVal = parseFloat(tr.querySelector('.in-casual')?.value) || 0;
      const aVal = parseFloat(tr.querySelector('.in-absent')?.value) || 0;
      const advVal = parseFloat(tr.querySelector('.in-advance')?.value) || 0;

      const salCell = tr.querySelector('[data-col="salary"]');
      const salaryVal = salCell ? parseFloat(salCell.textContent.replace(/[^0-9.]/g, '')) || 0 : 0;

      const sunCell = tr.querySelector('[data-col="sundays"]');
      const sundays = sunCell ? parseFloat(sunCell.textContent.replace(/[^0-9.]/g, '')) || 0 : 0;

      const totDaysCell = tr.querySelector('[data-col="totalDays"]');
      const totalDays = totDaysCell ? parseFloat(totDaysCell.textContent.replace(/[^0-9.]/g, '')) || 30 : 30;

      const paid = pVal + cVal + sundays;
      const gross = totalDays > 0 ? Math.round(((paid / totalDays) * salaryVal) * 100) / 100 : 0;
      const net = Math.max(0, Math.round((gross - advVal) * 100) / 100);

      totSalary += salaryVal;
      totPresent += pVal;
      totCasual += cVal;
      totAbsent += aVal;
      totSundays += sundays;
      totPaid += paid;
      totGross += gross;
      totAdv += advVal;
      totNet += net;
    });

    this.renderFooterHtml(totSalary, totPresent, totCasual, totAbsent, totSundays, totPaid, totGross, totAdv, totNet, count);
    this.colController.applyVisibility();
  }

  updateMetricsAndFooter(allRows, displayCount) {
    let totSalary = 0, totPresent = 0, totCasual = 0, totAbsent = 0, totSundays = 0;
    let totPaid = 0, totGross = 0, totAdv = 0, totNet = 0;

    allRows.forEach((r) => {
      totSalary += (r.monthlySalary || 0);
      totPresent += (r.presentDays || 0);
      totCasual += (r.casualLeaveDays || 0);
      totAbsent += (r.absentDays || 0);
      totSundays += (r.sundays || 0);
      totPaid += (r.paidDays || 0);
      totGross += (r.grossSalary || 0);
      totAdv += (r.advanceDeducted || 0);
      totNet += (r.netSalary || 0);
    });

    this.renderFooterHtml(totSalary, totPresent, totCasual, totAbsent, totSundays, totPaid, totGross, totAdv, totNet, displayCount || allRows.length);
    this.colController.applyVisibility();
  }

  renderFooterHtml(totSalary, totPresent, totCasual, totAbsent, totSundays, totPaid, totGross, totAdv, totNet, count) {
    if (!this.tableFoot) return;
    this.tableFoot.innerHTML = '';
  }

  async handleSaveAll() {
    const month = this.getSelectedMonth();
    this.captureCurrentTableInputs();

    const allRows = this.getUnifiedRows();
    if (allRows.length === 0) {
      window.app.showToast('No employee records to save', 'error');
      return;
    }

    const records = allRows.map((r) => ({
      employeeId: r.employeeId,
      presentDays: r.presentDays,
      casualLeaveDays: r.casualLeaveDays,
      sundays: r.sundays,
      absentDays: r.absentDays,
      advanceDeducted: r.advanceDeducted,
      remarks: r.remarks
    }));

    const saveBtn = this.saveBtn;
    const origText = saveBtn ? saveBtn.innerHTML : '💾 Save Sheet';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '⏳ Saving & Syncing...';
    }

    try {
      const resp = await this.api.bulkSavePayroll(month, records);
      this.userEdits = {}; // Clear pending edits
      if (resp && resp.warning) {
        if (window.app) {
          window.app.showToast(resp.warning, 'warning');
        }
      } else if (window.app) {
        window.app.showToast(`Successfully saved master payroll for ${month} and synchronized Excel!`, 'success');
      }
      await this.loadSheet(month);
      window.dispatchEvent(new CustomEvent('payrollUpdated', { detail: { month } }));
    } catch (err) {
      console.error('Failed to save central payroll sheet:', err);
      if (window.app) {
        window.app.showToast('Failed to save sheet: ' + err.message, 'error');
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origText;
      }
    }
  }

  async handleSaveSlip(r, tr) {
    const saveSlipBtn = tr.querySelector('.row-save-slip-btn');
    const origText = saveSlipBtn ? saveSlipBtn.innerHTML : '💾 Save Slip';
    if (saveSlipBtn) {
      saveSlipBtn.disabled = true;
      saveSlipBtn.innerHTML = '⏳ Saving...';
    }

    try {
      const empId = r.employeeId;
      const month = r.month || this.getSelectedMonth();

      // Read current inputs from the row DOM in case user typed without saving sheet
      const pVal = parseFloat(tr.querySelector('.in-present')?.value) || 0;
      const cVal = parseFloat(tr.querySelector('.in-casual')?.value) || 0;
      const aVal = parseFloat(tr.querySelector('.in-absent')?.value) || 0;
      const advVal = parseFloat(tr.querySelector('.in-advance')?.value) || 0;
      const remVal = tr.querySelector('.in-remarks')?.value || '';

      const edits = {
        presentDays: pVal,
        casualLeaveDays: cVal,
        absentDays: aVal,
        sundays: r.sundays,
        advanceDeducted: advVal,
        remarks: remVal.trim()
      };

      const blob = await this.api.downloadPayslipPdf(month, empId, edits);
      const safeName = (r.employeeName || 'Employee').replace(/\s+/g, '_');
      const filename = `${empId}_${safeName}_Payslip.pdf`;
      this.api.triggerBlobDownload(blob, filename);

      delete this.userEdits[empId];
      if (window.app) {
        window.app.showToast(`Payslip for ${r.employeeName} saved to designated folder & downloaded!`, 'success');
      }
    } catch (err) {
      console.error('Failed to save slip PDF:', err);
      if (window.app) {
        window.app.showToast('Failed to save slip PDF: ' + err.message, 'error');
      }
    } finally {
      if (saveSlipBtn) {
        saveSlipBtn.disabled = false;
        saveSlipBtn.innerHTML = origText;
      }
    }
  }

  async deleteRecord(month, employeeId, name) {
    if (!confirm(`Are you sure you want to delete the saved payroll entry for ${name} (${month})?`)) {
      return;
    }
    try {
      await this.api.deletePayrollRecord(month, employeeId);
      delete this.userEdits[employeeId];
      if (window.app) {
        window.app.showToast(`Deleted entry for ${name} and updated Excel sheets immediately`, 'info');
      }
      await this.loadSheet(month);
      window.dispatchEvent(new CustomEvent('payrollUpdated', { detail: { month } }));
    } catch (err) {
      if (window.app) {
        window.app.showToast('Failed to delete entry: ' + err.message, 'error');
      }
    }
  }
}
