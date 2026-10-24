/**
 * EmployeeManager - Handles employee master directory, modal popup card for Adding,
 * Viewing complete information, Editing, and Removing employees.
 */
const DESIGNATION_SALARIES = {
  'HR MANAGER': 20000,
  'ACCOUNTANT': 32000,
  'EXECUTIVE MANAGER': 20000,
  'REPORT WRITER': 20000,
  'DATA ENTRY': 17000
};

const FALLBACK_EMPLOYEES = [];

class EmployeeManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.employees = [];
    this.roles = [];
    this.sortField = 'id';
    this.sortDirection = 'asc';
    this.searchTerm = '';
    this.selectedEmp = null;
    this.cardMode = 'view'; // 'view' | 'edit' | 'add'
    this.hiddenColumns = new Set(['doj', 'bank', 'account', 'ifsc', 'pan']);

    this.availableCols = [
      { key: 'id', label: 'Emp ID' },
      { key: 'name', label: 'Full Name' },
      { key: 'desig', label: 'Designation' },
      { key: 'salary', label: 'Monthly Salary (₹)' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'email', label: 'Email Address' },
      { key: 'doj', label: 'Date of Joining' },
      { key: 'leaveDate', label: 'Date of Leaving' },
      { key: 'bank', label: 'Bank Name' },
      { key: 'account', label: 'Bank A/C No' },
      { key: 'ifsc', label: 'IFSC Code' },
      { key: 'pan', label: 'PAN Number' }
    ];

    this.initElements();
    this.initColumnController();
    this.bindEvents();
    this.loadInitialRoles();
  }

  initColumnController() {
    this.colController = new ColumnVisibilityController({
      storageKey: 'payslip_emp_hidden_cols',
      tableEl: this.table,
      dropdownEl: this.colDropdown,
      btnEl: this.colBtn,
      menuEl: this.colMenu,
      listEl: this.colList,
      allBtn: this.colAllBtn,
      resetBtn: this.colResetBtn,
      availableCols: this.availableCols,
      defaultHidden: ['doj', 'bank', 'account', 'ifsc', 'pan'],
      btnPrefix: 'Columns'
    });
  }

  async loadInitialRoles() {
    try {
      if (typeof this.api.getRoles === 'function') {
        this.roles = await this.api.getRoles();
      }
    } catch (e) {
      this.roles = [];
    }
  }

  initElements() {
    this.table = document.getElementById('employees-table');
    this.tableBody = document.getElementById('employees-tbody');
    this.empCountEl = document.getElementById('emp-total-count');
    this.searchInput = document.getElementById('emp-search-input');
    this.openAddBtn = document.getElementById('open-add-emp-btn');

    // Column dropdown
    this.colDropdown = document.getElementById('emp-col-dropdown');
    this.colBtn = document.getElementById('emp-col-btn');
    this.colMenu = document.getElementById('emp-col-menu');
    this.colList = document.getElementById('emp-col-list');
    this.colAllBtn = document.getElementById('emp-col-all');
    this.colResetBtn = document.getElementById('emp-col-reset');

    // Modal Card elements & ModalController
    this.modalEl = document.getElementById('emp-card-modal');
    this.modal = new ModalController(this.modalEl, {
      onClose: () => {
        this.cardMode = 'view';
        this.selectedEmp = null;
      }
    });

    this.cardTitle = document.getElementById('emp-card-title');
    this.cardIdPill = document.getElementById('emp-card-id-pill');
    this.cardAvatar = document.getElementById('emp-card-avatar');
    this.cardViewMode = document.getElementById('emp-card-view-mode');
    this.cardFormMode = document.getElementById('emp-card-form-mode');
    this.cardActionsLeft = document.getElementById('emp-card-actions-left');
    this.cardCloseBtn = document.getElementById('emp-card-close-btn');
    this.cardDismissBtn = document.getElementById('emp-card-dismiss-btn');
  }

  bindEvents() {
    window.addEventListener('rolesUpdated', (e) => {
      this.roles = e.detail || [];
      this.loadEmployees();
    });

    if (this.openAddBtn) {
      this.openAddBtn.addEventListener('click', () => this.openAddCard());
    }

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.trim();
        this.render();
      });
    }

    // Standardized table sorting via PayrollUtils
    PayrollUtils.bindTableSorting(
      this.table,
      () => ({ field: this.sortField, direction: this.sortDirection }),
      (field, dir) => {
        this.sortField = field;
        this.sortDirection = dir;
        this.render();
      }
    );

    // Modal dismiss events
    if (this.cardCloseBtn) {
      this.cardCloseBtn.addEventListener('click', () => this.closeCard());
    }
    if (this.cardDismissBtn) {
      this.cardDismissBtn.addEventListener('click', () => {
        if (this.cardMode === 'edit') {
          this.openViewCard(this.selectedEmp ? this.selectedEmp.id : null);
        } else {
          this.closeCard();
        }
      });
    }
  }

  updateHeaderClasses() {
    PayrollUtils.updateSortHeaders(this.table, this.sortField, this.sortDirection);
  }

  computeNextEmpId() {
    let maxNum = 0;
    this.employees.forEach((emp) => {
      if (emp.id && emp.id.startsWith('EMP')) {
        const num = parseInt(emp.id.replace('EMP', ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    return `EMP${String(maxNum + 1).padStart(3, '0')}`;
  }

  async loadEmployees() {
    try {
      try { localStorage.removeItem('payslip_cached_employees'); } catch (e) {}
      const data = await this.api.getEmployees();
      if (Array.isArray(data)) {
        this.employees = data;
      } else {
        this.employees = [];
      }
    } catch (err) {
      console.warn('[EmployeeManager] Error loading employees from server:', err.message);
      this.employees = [];
    }

    this.updateHeaderClasses();
    this.render();

    // If viewing an employee, refresh its data in the card
    if (this.selectedEmp && this.modalEl && this.modalEl.classList.contains('active') && this.cardMode === 'view') {
      const updated = this.employees.find((e) => e.id === this.selectedEmp.id);
      if (updated) {
        this.selectedEmp = updated;
        this.renderCardView();
      }
    }

    window.dispatchEvent(new CustomEvent('employeesUpdated', { detail: this.employees }));
  }

  getSortedAndFilteredEmployees() {
    let list = [...this.employees];

    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter((emp) => {
        return (
          (emp.id && emp.id.toLowerCase().includes(q)) ||
          (emp.name && emp.name.toLowerCase().includes(q)) ||
          (emp.designation && emp.designation.toLowerCase().includes(q)) ||
          (emp.email && emp.email.toLowerCase().includes(q)) ||
          (emp.phone && emp.phone.toLowerCase().includes(q)) ||
          (emp.bankName && emp.bankName.toLowerCase().includes(q)) ||
          (emp.panTaxNo && emp.panTaxNo.toLowerCase().includes(q))
        );
      });
    }

    list.sort((a, b) => {
      let valA = a[this.sortField];
      let valB = b[this.sortField];

      // Natural alphanumeric string comparison (handles EMP001, EMP002, EMP010)
      const strA = (valA || '').toString();
      const strB = (valB || '').toString();
      const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }

  render() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    const displayList = this.getSortedAndFilteredEmployees();

    if (this.empCountEl) {
      this.empCountEl.textContent = this.employees.length;
    }

    if (this.employees.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="13" style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
            <div>No staff records found in the directory.</div>
            <button type="button" class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" onclick="window.employeeManager.openAddCard()">+ Register First Employee</button>
          </td>
        </tr>
      `;
      return;
    }

    if (displayList.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="13" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No staff records found matching "<strong>${this.escapeHtml(this.searchTerm)}</strong>".
          </td>
        </tr>
      `;
      return;
    }

    displayList.forEach((emp) => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';

      const isOut = Boolean((emp.leaveDate && emp.leaveDate.trim().length > 0) || emp.isActive === false);
      if (isOut) {
        tr.classList.add('row-employee-out');
      }

      const salary = parseFloat(emp.salary) || parseFloat(emp.monthlySalary) || 0;

      tr.innerHTML = `
        <td data-col="id">
          <button type="button" class="emp-id-btn" data-id="${emp.id}" title="Click to view full employee card">
            <strong>${this.escapeHtml(emp.id)}</strong> 🔍
          </button>
        </td>
        <td data-col="name">
          <strong style="color: var(--text-primary); font-size: 0.95rem;">${this.escapeHtml(emp.name)}</strong>
        </td>
        <td data-col="desig">
          <span class="badge badge-info">${this.escapeHtml(emp.designation || 'Staff')}</span>
        </td>
        <td data-col="salary" style="font-weight: 600; text-align: right; white-space: nowrap;">
          ₹${salary.toLocaleString('en-IN')}
        </td>
        <td data-col="phone" style="color: var(--text-secondary); font-size: 0.88rem;">
          ${this.escapeHtml(emp.phone || '—')}
        </td>
        <td data-col="email" style="color: var(--text-secondary); font-size: 0.88rem;">
          ${this.escapeHtml(emp.email || '—')}
        </td>
        <td data-col="doj" style="color: var(--text-secondary); font-size: 0.85rem;">
          ${this.escapeHtml(emp.joinDate || '—')}
        </td>
        <td data-col="leaveDate" style="color: var(--text-secondary); font-size: 0.85rem;">
          ${this.escapeHtml(emp.leaveDate || '—')}
        </td>
        <td data-col="bank" style="color: var(--text-secondary); font-size: 0.85rem;">
          ${this.escapeHtml(emp.bankName || '—')}
        </td>
        <td data-col="account" style="color: var(--text-secondary); font-size: 0.85rem;">
          ${this.escapeHtml(emp.bankAccountNo || '—')}
        </td>
        <td data-col="ifsc" style="color: var(--text-secondary); font-size: 0.85rem;">
          ${this.escapeHtml(emp.bankIfscCode || '—')}
        </td>
        <td data-col="pan" style="color: var(--text-secondary); font-size: 0.85rem;">
          ${this.escapeHtml(emp.panTaxNo || '—')}
        </td>
      `;

      // Clicking row or Emp ID button opens the complete Employee Card
      tr.addEventListener('click', () => this.openViewCard(emp.id));

      const idBtn = tr.querySelector('.emp-id-btn');
      if (idBtn) {
        idBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openViewCard(emp.id);
        });
      }

      this.tableBody.appendChild(tr);
    });

    if (this.colController) {
      this.colController.applyVisibility();
    }
  }

  // ========================================================
  // CARD MODAL MANAGEMENT (VIEW, ADD, EDIT)
  // ========================================================
  closeCard() {
    if (this.modal) this.modal.close();
    this.cardMode = 'view';
    this.selectedEmp = null;
  }

  showModal() {
    if (this.modal) this.modal.open();
  }

  // 1. VIEW MODE
  openViewCard(empId) {
    if (!empId) {
      this.closeCard();
      return;
    }
    const emp = this.employees.find((e) => e.id === empId);
    if (!emp) return;

    this.selectedEmp = emp;
    this.cardMode = 'view';

    if (this.cardTitle) this.cardTitle.textContent = emp.name;
    if (this.cardIdPill) this.cardIdPill.textContent = emp.id;
    if (this.cardAvatar) {
      const initial = (emp.name || 'E').trim().charAt(0).toUpperCase();
      this.cardAvatar.textContent = initial;
    }

    this.renderCardView();
    this.showModal();
  }

  renderCardView() {
    if (!this.selectedEmp || !this.cardViewMode) return;
    const emp = this.selectedEmp;

    if (this.cardViewMode) this.cardViewMode.style.display = 'block';
    if (this.cardFormMode) this.cardFormMode.style.display = 'none';

    const salaryVal = Number(emp.salary || emp.baseSalary || 0);

    this.cardViewMode.innerHTML = `
      <div class="emp-card-section-title">
        <span>👤</span> Personal Information
      </div>
      <div class="emp-details-grid">
        <div class="emp-detail-item">
          <span class="emp-detail-label">Employee ID</span>
          <span class="emp-detail-value" style="color: var(--primary); font-size: 1.05rem;">${this.escapeHtml(emp.id)}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">Full Legal Name</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.name)}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">Designation / Role</span>
          <span class="emp-detail-value"><span class="badge badge-info">${this.escapeHtml(emp.designation || 'Staff')}</span></span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">Date of Joining</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.joinDate || '2024-04-01')}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">Date of Leaving</span>
          <span class="emp-detail-value" style="${emp.leaveDate ? 'color: var(--danger); font-weight: 600;' : ''}">${this.escapeHtml(emp.leaveDate || '—')}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">Phone Number</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.phone || '—')}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">Email Address</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.email || '—')}</span>
        </div>
      </div>

      <div class="emp-card-section-title" style="margin-top: 1.25rem;">
        <span>💰</span> Compensation &amp; Wage Structure
      </div>
      <div class="emp-details-grid">
        <div class="emp-detail-item">
          <span class="emp-detail-label">Monthly Base Salary</span>
          <span class="emp-detail-value highlight-rate">₹${salaryVal.toLocaleString('en-IN')} / month</span>
        </div>
      </div>

      <div class="emp-card-section-title" style="margin-top: 1.25rem;">
        <span>🏦</span> Bank Account &amp; Tax Identifiers
      </div>
      <div class="emp-details-grid">
        <div class="emp-detail-item">
          <span class="emp-detail-label">Bank Name</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.bankName || '—')}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">Bank Account Number</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.bankAccountNo || '—')}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">IFSC Code</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.bankIfscCode || '—')}</span>
        </div>
        <div class="emp-detail-item">
          <span class="emp-detail-label">PAN Card Number</span>
          <span class="emp-detail-value">${this.escapeHtml(emp.panTaxNo || '—')}</span>
        </div>
      </div>
    `;

    // Side-by-side buttons: Edit and Remove
    if (this.cardActionsLeft) {
      this.cardActionsLeft.innerHTML = `
        <button type="button" class="btn btn-primary" id="emp-card-edit-btn">✏️ Edit Employee</button>
        <button type="button" class="btn btn-danger" id="emp-card-remove-btn">🗑️ Remove Employee</button>
      `;

      const editBtn = document.getElementById('emp-card-edit-btn');
      if (editBtn) editBtn.addEventListener('click', () => this.openEditCard());

      const removeBtn = document.getElementById('emp-card-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.handleDeleteEmployee(emp.id, emp.name);
        });
      }
    }

    if (this.cardDismissBtn) {
      this.cardDismissBtn.textContent = 'Close';
      this.cardDismissBtn.onclick = () => this.closeCard();
    }
  }

  getDesignationOptionsHtml(currentDesignation = '') {
    let rolesList = (this.roles && this.roles.length > 0) ? this.roles : [
      { id: 'ROLE001', name: 'HR MANAGER', salary: 20000 },
      { id: 'ROLE002', name: 'ACCOUNTANT', salary: 32000 },
      { id: 'ROLE003', name: 'EXECUTIVE MANAGER', salary: 20000 },
      { id: 'ROLE004', name: 'REPORT WRITER', salary: 20000 },
      { id: 'ROLE005', name: 'DATA ENTRY', salary: 17000 }
    ];

    const curUpper = (currentDesignation || '').trim().toUpperCase();
    const isKnown = rolesList.some((r) => (r.name || '').trim().toUpperCase() === curUpper);

    let html = '<option value="">-- Select Designation --</option>';
    rolesList.forEach((r) => {
      const rName = (r.name || '').trim();
      const selected = (curUpper === rName.toUpperCase()) ? 'selected' : '';
      html += `<option value="${this.escapeHtml(rName)}" ${selected}>${this.escapeHtml(rName)}</option>`;
    });

    const isOther = !isKnown && currentDesignation !== '';
    if (isOther) {
      html += `<option value="${this.escapeHtml(currentDesignation)}" selected>${this.escapeHtml(currentDesignation)}</option>`;
    }
    html += `<option value="OTHER">Other / Custom Role...</option>`;
    return { html, isOther, curUpper };
  }

  setupDesignationHandlers() {
    const desigSelect = document.getElementById('form-emp-desig');
    const customGroup = document.getElementById('custom-desig-group');
    const customInput = document.getElementById('form-emp-custom-desig');
    const salaryInput = document.getElementById('form-emp-salary');

    if (desigSelect) {
      desigSelect.addEventListener('change', () => {
        const val = desigSelect.value;
        if (val === 'OTHER') {
          if (customGroup) customGroup.style.display = 'block';
          if (customInput) customInput.focus();
        } else {
          if (customGroup) customGroup.style.display = 'none';
          const match = (this.roles || []).find((r) => (r.name || '').trim().toUpperCase() === val.toUpperCase());
          if (match && salaryInput) {
            salaryInput.value = match.salary;
          } else if (DESIGNATION_SALARIES[val] !== undefined && salaryInput) {
            salaryInput.value = DESIGNATION_SALARIES[val];
          }
        }
      });
    }
  }

  validateUniqueness(payload, excludeEmpId = null) {
    const rawPhone = payload.phone || '';
    const normPhone = rawPhone.replace(/\D/g, '');
    const checkPhone = normPhone.length > 10 ? normPhone.slice(-10) : normPhone;

    const normEmail = (payload.email || '').trim().toLowerCase();
    const normAccount = (payload.bankAccountNo || '').trim().toUpperCase();
    const normPan = (payload.panTaxNo || '').trim().toUpperCase();

    for (const emp of this.employees) {
      if (excludeEmpId && emp.id === excludeEmpId) continue;

      if (checkPhone && checkPhone.length >= 5) {
        let existingPhone = (emp.phone || '').replace(/\D/g, '');
        if (existingPhone.length > 10) existingPhone = existingPhone.slice(-10);
        if (existingPhone && existingPhone === checkPhone) {
          return {
            field: 'phone',
            message: `Phone number '${payload.phone}' is already registered to employee ${emp.id} (${emp.name}). Phone numbers must be unique.`
          };
        }
      }

      if (normEmail) {
        const existingEmail = (emp.email || '').trim().toLowerCase();
        if (existingEmail && existingEmail === normEmail) {
          return {
            field: 'email',
            message: `Email address '${payload.email}' is already registered to employee ${emp.id} (${emp.name}). Email addresses must be unique.`
          };
        }
      }

      if (normAccount) {
        const existingAccount = (emp.bankAccountNo || '').trim().toUpperCase();
        if (existingAccount && existingAccount === normAccount) {
          return {
            field: 'bankAccountNo',
            message: `Bank Account number '${payload.bankAccountNo}' is already registered to employee ${emp.id} (${emp.name}). Account numbers must be unique.`
          };
        }
      }

      if (normPan) {
        const existingPan = (emp.panTaxNo || '').trim().toUpperCase();
        if (existingPan && existingPan === normPan) {
          return {
            field: 'panTaxNo',
            message: `PAN Card number '${payload.panTaxNo}' is already registered to employee ${emp.id} (${emp.name}). PAN numbers must be unique.`
          };
        }
      }
    }

    return null;
  }

  // 2. ADD MODE (Opens sleek popup form with Designation dropdown and auto-salary)
  openAddCard() {
    this.selectedEmp = null;
    this.cardMode = 'add';
    const nextId = this.computeNextEmpId();

    if (this.cardTitle) this.cardTitle.textContent = 'Register New Staff Member';
    if (this.cardIdPill) this.cardIdPill.textContent = nextId;
    if (this.cardAvatar) this.cardAvatar.textContent = '➕';

    if (this.cardViewMode) this.cardViewMode.style.display = 'none';
    if (this.cardFormMode) this.cardFormMode.style.display = 'block';

    const desigData = this.getDesignationOptionsHtml('');

    this.cardFormMode.innerHTML = `
      <form id="card-employee-form" novalidate>
        <div class="emp-card-section-title">
          <span>👤</span> Personal Information &amp; Compensation
        </div>

        <div class="emp-details-grid">
          <div class="card-edit-group">
            <label for="form-emp-id">Employee ID *</label>
            <input type="text" id="form-emp-id" class="form-control" value="${nextId}" placeholder="e.g. ${nextId}" required />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-name">Full Name *</label>
            <input type="text" id="form-emp-name" class="form-control" placeholder="e.g. Rahul Sharma" required />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-desig">Designation / Role *</label>
            <select id="form-emp-desig" class="form-control" required>
              ${desigData.html}
            </select>
          </div>
          <div class="card-edit-group" id="custom-desig-group" style="display: none;">
            <label for="form-emp-custom-desig">Custom Role Title *</label>
            <input type="text" id="form-emp-custom-desig" class="form-control" placeholder="e.g. Senior Auditor" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-salary">Monthly Salary (₹/month) *</label>
            <input type="number" step="any" min="0" id="form-emp-salary" class="form-control" placeholder="0.00" style="font-weight: 600;" required />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-join-date">Date of Joining</label>
            <input type="date" id="form-emp-join-date" class="form-control" value="2024-04-01" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-leave-date">Date of Leaving</label>
            <input type="date" id="form-emp-leave-date" class="form-control" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-phone">Phone Number</label>
            <input type="text" id="form-emp-phone" class="form-control" placeholder="e.g. +91 98765 43210" />
          </div>
          <div class="card-edit-group full-width">
            <label for="form-emp-email">Email Address</label>
            <input type="email" id="form-emp-email" class="form-control" placeholder="e.g. rahul@stiflink.com" />
          </div>
        </div>

        <div class="emp-card-section-title" style="margin-top: 1rem;">
          <span>🏦</span> Bank Account &amp; Tax Identifiers
        </div>
        <div class="emp-details-grid">
          <div class="card-edit-group">
            <label for="form-emp-bank-name">Bank Name</label>
            <input type="text" id="form-emp-bank-name" class="form-control" placeholder="e.g. State Bank of India" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-account-no">Account Number</label>
            <input type="text" id="form-emp-account-no" class="form-control" placeholder="e.g. 30981245678" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-ifsc">IFSC Code</label>
            <input type="text" id="form-emp-ifsc" class="form-control" placeholder="e.g. SBIN0001234" style="text-transform: uppercase;" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-pan">PAN Card Number</label>
            <input type="text" id="form-emp-pan" class="form-control" placeholder="e.g. ABCDE1234F" style="text-transform: uppercase;" />
          </div>
        </div>
      </form>
    `;

    this.setupDesignationHandlers();

    // Footer actions for Add mode
    if (this.cardActionsLeft) {
      this.cardActionsLeft.innerHTML = `
        <button type="button" class="btn btn-primary" id="card-action-submit-btn">+ Register Employee</button>
      `;

      const submitBtn = document.getElementById('card-action-submit-btn');
      if (submitBtn) submitBtn.addEventListener('click', () => this.handleSaveAdd());
    }

    if (this.cardDismissBtn) {
      this.cardDismissBtn.textContent = 'Cancel';
      this.cardDismissBtn.onclick = () => this.closeCard();
    }

    this.showModal();
    const nameInput = document.getElementById('form-emp-name');
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  }

  // 3. EDIT MODE (Pre-populated form with Designation dropdown and unique validation)
  openEditCard() {
    if (!this.selectedEmp || !this.cardFormMode) return;
    const emp = this.selectedEmp;
    this.cardMode = 'edit';

    if (this.cardTitle) this.cardTitle.textContent = `Edit Details: ${emp.name}`;
    if (this.cardIdPill) this.cardIdPill.textContent = emp.id;
    if (this.cardAvatar) this.cardAvatar.textContent = '✏️';

    if (this.cardViewMode) this.cardViewMode.style.display = 'none';
    if (this.cardFormMode) this.cardFormMode.style.display = 'block';

    const desigData = this.getDesignationOptionsHtml(emp.designation || '');
    let salaryVal = emp.salary || emp.baseSalary || 0;
    if (!salaryVal && DESIGNATION_SALARIES[desigData.curUpper]) {
      salaryVal = DESIGNATION_SALARIES[desigData.curUpper];
    }

    this.cardFormMode.innerHTML = `
      <form id="card-employee-form" novalidate>
        <div class="emp-card-section-title">
          <span>✏️</span> Edit Employee (${this.escapeHtml(emp.id)})
        </div>

        <div class="emp-details-grid">
          <div class="card-edit-group">
            <label for="form-emp-id">Employee ID</label>
            <input type="text" id="form-emp-id" class="form-control" value="${this.escapeHtml(emp.id)}" disabled style="background: #f1f5f9; cursor: not-allowed;" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-name">Full Name *</label>
            <input type="text" id="form-emp-name" class="form-control" value="${this.escapeHtml(emp.name)}" required />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-desig">Designation / Role *</label>
            <select id="form-emp-desig" class="form-control" required>
              ${desigData.html}
            </select>
          </div>
          <div class="card-edit-group" id="custom-desig-group" style="${desigData.isOther ? 'display: block;' : 'display: none;'}">
            <label for="form-emp-custom-desig">Custom Role Title *</label>
            <input type="text" id="form-emp-custom-desig" class="form-control" value="${this.escapeHtml(desigData.isOther ? emp.designation : '')}" placeholder="e.g. Senior Auditor" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-salary">Monthly Salary (₹/month) *</label>
            <input type="number" step="any" min="0" id="form-emp-salary" class="form-control" value="${salaryVal || 0}" style="font-weight: 600; background: #f1f5f9; cursor: not-allowed;" readonly required />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-join-date">Date of Joining</label>
            <input type="date" id="form-emp-join-date" class="form-control" value="${this.escapeHtml(emp.joinDate || '2024-04-01')}" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-leave-date">Date of Leaving</label>
            <input type="date" id="form-emp-leave-date" class="form-control" value="${this.escapeHtml(emp.leaveDate || '')}" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-phone">Phone Number</label>
            <input type="text" id="form-emp-phone" class="form-control" value="${this.escapeHtml(emp.phone || '')}" />
          </div>
          <div class="card-edit-group full-width">
            <label for="form-emp-email">Email Address</label>
            <input type="email" id="form-emp-email" class="form-control" value="${this.escapeHtml(emp.email || '')}" />
          </div>
        </div>

        <div class="emp-card-section-title" style="margin-top: 1rem;">
          <span>🏦</span> Bank Account &amp; Tax Identifiers
        </div>
        <div class="emp-details-grid">
          <div class="card-edit-group">
            <label for="form-emp-bank-name">Bank Name</label>
            <input type="text" id="form-emp-bank-name" class="form-control" value="${this.escapeHtml(emp.bankName || '')}" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-account-no">Account Number</label>
            <input type="text" id="form-emp-account-no" class="form-control" value="${this.escapeHtml(emp.bankAccountNo || '')}" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-ifsc">IFSC Code</label>
            <input type="text" id="form-emp-ifsc" class="form-control" value="${this.escapeHtml(emp.bankIfscCode || '')}" style="text-transform: uppercase;" />
          </div>
          <div class="card-edit-group">
            <label for="form-emp-pan">PAN Card Number</label>
            <input type="text" id="form-emp-pan" class="form-control" value="${this.escapeHtml(emp.panTaxNo || '')}" style="text-transform: uppercase;" />
          </div>
        </div>
      </form>
    `;

    this.setupDesignationHandlers();

    // Footer actions for Edit mode: Save and Remove side-by-side
    if (this.cardActionsLeft) {
      this.cardActionsLeft.innerHTML = `
        <button type="button" class="btn btn-success" id="card-action-submit-btn">💾 Save Changes</button>
        <button type="button" class="btn btn-danger" id="emp-card-remove-btn">🗑️ Remove Employee</button>
      `;

      const submitBtn = document.getElementById('card-action-submit-btn');
      if (submitBtn) submitBtn.addEventListener('click', () => this.handleSaveEdit());

      const removeBtn = document.getElementById('emp-card-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.handleDeleteEmployee(emp.id, emp.name);
        });
      }
    }

    if (this.cardDismissBtn) {
      this.cardDismissBtn.textContent = 'Cancel';
      this.cardDismissBtn.onclick = () => this.openViewCard(emp.id);
    }
  }

  // ========================================================
  // SAVE ADD / SAVE EDIT HANDLERS WITH UNIQUENESS VALIDATION
  // ========================================================
  async handleSaveAdd() {
    let id = (document.getElementById('form-emp-id')?.value || '').trim().toUpperCase();
    const name = (document.getElementById('form-emp-name')?.value || '').trim();
    const desigSelectVal = (document.getElementById('form-emp-desig')?.value || '').trim();
    const customDesigVal = (document.getElementById('form-emp-custom-desig')?.value || '').trim();
    let designation = desigSelectVal === 'OTHER' ? customDesigVal : desigSelectVal;
    if (!designation) designation = 'Staff';

    const salary = parseFloat(document.getElementById('form-emp-salary')?.value) || 0;

    const joinDate = (document.getElementById('form-emp-join-date')?.value || '').trim() || '2024-04-01';
    const leaveDate = (document.getElementById('form-emp-leave-date')?.value || '').trim();
    const phone = (document.getElementById('form-emp-phone')?.value || '').trim();
    const email = (document.getElementById('form-emp-email')?.value || '').trim();
    const bankName = (document.getElementById('form-emp-bank-name')?.value || '').trim();
    const bankAccountNo = (document.getElementById('form-emp-account-no')?.value || '').trim();
    const bankIfscCode = (document.getElementById('form-emp-ifsc')?.value || '').trim().toUpperCase();
    const panTaxNo = (document.getElementById('form-emp-pan')?.value || '').trim().toUpperCase();

    if (!name) {
      if (window.app) window.app.showToast('Please enter Employee Full Name', 'error');
      document.getElementById('form-emp-name')?.focus();
      return;
    }

    if (isNaN(salary) || salary <= 0) {
      if (window.app) window.app.showToast('Please enter a valid Monthly Salary (₹)', 'error');
      document.getElementById('form-emp-salary')?.focus();
      return;
    }

    if (!id) {
      id = this.computeNextEmpId();
    }

    const payload = {
      id,
      name,
      designation,
      salary,
      monthlySalary: salary,
      baseSalary: salary,
      email,
      phone,
      joinDate,
      leaveDate,
      bankName,
      bankAccountNo,
      bankIfscCode,
      panTaxNo,
      isActive: true
    };

    const uniquenessErr = this.validateUniqueness(payload, null);
    if (uniquenessErr) {
      if (window.app) window.app.showToast(uniquenessErr.message, 'error');
      if (uniquenessErr.field === 'phone') document.getElementById('form-emp-phone')?.focus();
      else if (uniquenessErr.field === 'email') document.getElementById('form-emp-email')?.focus();
      else if (uniquenessErr.field === 'bankAccountNo') document.getElementById('form-emp-account-no')?.focus();
      else if (uniquenessErr.field === 'panTaxNo') document.getElementById('form-emp-pan')?.focus();
      return;
    }

    const submitBtn = document.getElementById('card-action-submit-btn');
    const origText = submitBtn ? submitBtn.innerHTML : '+ Register Employee';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Registering &amp; Updating Excel...';
    }

    try {
      let created;
      if (typeof this.api.createEmployee === 'function') {
        created = await this.api.createEmployee(payload);
      } else {
        created = await this.api.request('/api/employees', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      if (window.app) {
        window.app.showToast(`Employee "${name}" (${id}) registered! Excel table updated immediately.`, 'success');
      }

      this.closeCard();
      await this.loadEmployees();
    } catch (err) {
      console.error('[EmployeeManager] Error creating employee:', err);
      if (window.app) {
        window.app.showToast('Failed to register employee: ' + err.message, 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    }
  }

  async handleSaveEdit() {
    if (!this.selectedEmp) return;
    const empId = this.selectedEmp.id;

    const name = (document.getElementById('form-emp-name')?.value || '').trim();
    const desigSelectVal = (document.getElementById('form-emp-desig')?.value || '').trim();
    const customDesigVal = (document.getElementById('form-emp-custom-desig')?.value || '').trim();
    let designation = desigSelectVal === 'OTHER' ? customDesigVal : desigSelectVal;
    if (!designation) designation = 'Staff';

    const salary = parseFloat(document.getElementById('form-emp-salary')?.value) || 0;

    const joinDate = (document.getElementById('form-emp-join-date')?.value || '').trim() || '2024-04-01';
    const leaveDate = (document.getElementById('form-emp-leave-date')?.value || '').trim();
    const phone = (document.getElementById('form-emp-phone')?.value || '').trim();
    const email = (document.getElementById('form-emp-email')?.value || '').trim();
    const bankName = (document.getElementById('form-emp-bank-name')?.value || '').trim();
    const bankAccountNo = (document.getElementById('form-emp-account-no')?.value || '').trim();
    const bankIfscCode = (document.getElementById('form-emp-ifsc')?.value || '').trim().toUpperCase();
    const panTaxNo = (document.getElementById('form-emp-pan')?.value || '').trim().toUpperCase();

    if (!name) {
      if (window.app) window.app.showToast('Employee name cannot be empty', 'error');
      document.getElementById('form-emp-name')?.focus();
      return;
    }

    if (isNaN(salary) || salary <= 0) {
      if (window.app) window.app.showToast('Please enter a valid Monthly Salary (₹)', 'error');
      document.getElementById('form-emp-salary')?.focus();
      return;
    }

    const payload = {
      name,
      designation,
      salary,
      monthlySalary: salary,
      baseSalary: salary,
      email,
      phone,
      joinDate,
      leaveDate,
      bankName,
      bankAccountNo,
      bankIfscCode,
      panTaxNo,
      isActive: true
    };

    const uniquenessErr = this.validateUniqueness(payload, empId);
    if (uniquenessErr) {
      if (window.app) window.app.showToast(uniquenessErr.message, 'error');
      if (uniquenessErr.field === 'phone') document.getElementById('form-emp-phone')?.focus();
      else if (uniquenessErr.field === 'email') document.getElementById('form-emp-email')?.focus();
      else if (uniquenessErr.field === 'bankAccountNo') document.getElementById('form-emp-account-no')?.focus();
      else if (uniquenessErr.field === 'panTaxNo') document.getElementById('form-emp-pan')?.focus();
      return;
    }

    const submitBtn = document.getElementById('card-action-submit-btn');
    const origText = submitBtn ? submitBtn.innerHTML : '💾 Save Changes';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Saving &amp; Updating Excel...';
    }

    try {
      let updated;
      if (typeof this.api.updateEmployee === 'function') {
        updated = await this.api.updateEmployee(empId, payload);
      } else {
        updated = await this.api.request(`/api/employees/${encodeURIComponent(empId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      }

      this.selectedEmp = updated;

      if (window.app) {
        window.app.showToast(`Updated "${name}" (${empId})! Excel table updated immediately.`, 'success');
      }

      await this.loadEmployees();
      this.openViewCard(empId);
    } catch (err) {
      console.error('[EmployeeManager] Failed to update employee:', err);
      if (window.app) {
        window.app.showToast('Failed to update employee: ' + err.message, 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origText;
      }
    }
  }

  async handleDeleteEmployee(id, name) {
    if (!confirm(`Are you sure you want to remove employee "${name}" (${id})?`)) {
      return;
    }

    try {
      let res;
      if (typeof this.api.deleteEmployee === 'function') {
        res = await this.api.deleteEmployee(id);
      } else {
        res = await this.api.request(`/api/employees/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
      }

      if (window.app) {
        window.app.showToast(`Employee "${name}" (${id}) removed and Excel updated immediately`, 'info');
      }
      this.closeCard();
      await this.loadEmployees();
    } catch (err) {
      console.error('[EmployeeManager] Failed to delete employee:', err);
      if (window.app) {
        window.app.showToast('Failed to delete employee: ' + err.message, 'error');
      }
    }
  }

  escapeHtml(str) {
    return PayrollUtils.escapeHtml(str);
  }
}
