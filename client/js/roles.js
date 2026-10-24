/**
 * RoleManager - Handles Role & Salary Management tab.
 * Allows adding, editing, and removing company roles and their fixed monthly salaries.
 * Uses shared PayrollUtils and ModalController for clean, maintainable OOP architecture.
 */
class RoleManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.roles = [];
    this.searchTerm = '';
    this.sortField = 'name';
    this.sortDirection = 'asc';
    this.editingRole = null;

    this.initElements();
    this.bindEvents();
    this.loadRoles();
  }

  initElements() {
    this.table = document.getElementById('roles-table');
    this.tableBody = document.getElementById('roles-tbody');
    this.roleCountEl = document.getElementById('role-total-count');
    this.searchInput = document.getElementById('role-search-input');
    this.openAddBtn = document.getElementById('open-add-role-btn');

    // Role Add / Edit Modal & Controller
    this.modalEl = document.getElementById('role-edit-modal');
    this.modal = new ModalController(this.modalEl, {
      onClose: () => {
        this.editingRole = null;
      }
    });

    this.modalTitle = document.getElementById('role-modal-title');
    this.nameInput = document.getElementById('modal-role-name');
    this.salaryInput = document.getElementById('modal-role-salary');
    this.saveBtn = document.getElementById('role-modal-save-btn');
    this.cancelBtn = document.getElementById('role-modal-cancel-btn');
    this.closeBtn = document.getElementById('role-modal-close-btn');
  }

  bindEvents() {
    if (this.openAddBtn) {
      this.openAddBtn.addEventListener('click', () => this.openAddModal());
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

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.handleSave());
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.modal.close());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.modal.close());
    }

    if (this.nameInput) {
      this.nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSave();
        }
      });
    }

    if (this.salaryInput) {
      this.salaryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSave();
        }
      });
    }
  }

  async loadRoles() {
    try {
      const data = await this.api.getRoles();
      if (Array.isArray(data)) {
        this.roles = data;
      }
      this.render();
      this.broadcastRoles();
      if (window.employeeManager && typeof window.employeeManager.loadEmployees === 'function') {
        window.employeeManager.loadEmployees();
      }
    } catch (err) {
      console.error('[RoleManager] Error loading roles:', err);
      this.render();
    }
  }

  broadcastRoles() {
    window.dispatchEvent(new CustomEvent('rolesUpdated', { detail: this.roles }));
  }

  updateHeaderClasses() {
    PayrollUtils.updateSortHeaders(this.table, this.sortField, this.sortDirection);
  }

  getFilteredRoles() {
    let list = [...this.roles];
    if (this.searchTerm) {
      const q = this.searchTerm;
      list = list.filter((r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let result = 0;
      if (this.sortField === 'salary') {
        result = (parseFloat(a.salary) || 0) - (parseFloat(b.salary) || 0);
      } else {
        result = PayrollUtils.naturalCompare(a[this.sortField], b[this.sortField]);
      }
      return this.sortDirection === 'asc' ? result : -result;
    });

    return list;
  }

  render() {
    this.updateHeaderClasses();
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    const list = this.getFilteredRoles();

    if (this.roleCountEl) {
      this.roleCountEl.textContent = this.roles.length;
    }

    if (list.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem;">
            No roles found. Click "+ Add New Role" to register a company designation.
          </td>
        </tr>
      `;
      return;
    }

    list.forEach((role, idx) => {
      const tr = document.createElement('tr');
      const salary = Number(role.salary) || 0;

      tr.innerHTML = `
        <td style="color: var(--text-muted); width: 40px;">${idx + 1}</td>
        <td><strong style="color: var(--primary); font-size: 0.88rem;">${PayrollUtils.escapeHtml(role.id)}</strong></td>
        <td>
          <strong style="color: var(--text-primary); font-size: 0.95rem;">${PayrollUtils.escapeHtml(role.name)}</strong>
        </td>
        <td style="font-weight: 700; color: var(--accent); font-size: 1rem;">
          ${PayrollUtils.formatCurrency(salary, 0)} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">/ month</span>
        </td>
        <td style="white-space: nowrap; text-align: right;">
          <div style="display: inline-flex; gap: 0.4rem;">
            <button type="button" class="btn btn-secondary btn-sm role-edit-btn" data-id="${role.id}">✏️ Edit</button>
            <button type="button" class="btn btn-danger btn-sm role-remove-btn" data-id="${role.id}">🗑️ Remove</button>
          </div>
        </td>
      `;

      const editBtn = tr.querySelector('.role-edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openEditModal(role);
        });
      }

      const removeBtn = tr.querySelector('.role-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleDelete(role);
        });
      }

      this.tableBody.appendChild(tr);
    });
  }

  openAddModal() {
    this.editingRole = null;
    if (this.modalTitle) this.modalTitle.textContent = 'Add New Role & Monthly Salary';
    if (this.nameInput) {
      this.nameInput.value = '';
      this.nameInput.disabled = false;
    }
    if (this.salaryInput) this.salaryInput.value = '';
    this.modal.open();
    if (this.nameInput) setTimeout(() => this.nameInput.focus(), 80);
  }

  openEditModal(role) {
    if (!role) return;
    this.editingRole = role;
    if (this.modalTitle) this.modalTitle.textContent = `Edit Role: ${role.name}`;
    if (this.nameInput) {
      this.nameInput.value = role.name;
      this.nameInput.disabled = false;
    }
    if (this.salaryInput) {
      this.salaryInput.value = role.salary;
    }
    this.modal.open();
    if (this.salaryInput) setTimeout(() => this.salaryInput.focus(), 80);
  }

  showModal() {
    this.modal.open();
  }

  closeModal() {
    this.modal.close();
  }

  async handleSave() {
    const rawName = (this.nameInput?.value || '').trim();
    const name = rawName.toUpperCase();
    const salary = parseFloat(this.salaryInput?.value) || 0;

    if (!name) {
      if (window.app) window.app.showToast('Please enter a role designation title', 'error');
      this.nameInput?.focus();
      return;
    }

    if (isNaN(salary) || salary <= 0) {
      if (window.app) window.app.showToast('Please enter a valid monthly salary (₹)', 'error');
      this.salaryInput?.focus();
      return;
    }

    const duplicate = this.roles.find((r) =>
      r.name.trim().toUpperCase() === name && (!this.editingRole || r.id !== this.editingRole.id)
    );
    if (duplicate) {
      if (window.app) window.app.showToast(`Role "${name}" already exists`, 'error');
      this.nameInput?.focus();
      return;
    }

    const saveBtn = this.saveBtn;
    const origText = saveBtn ? saveBtn.innerHTML : 'Save Role';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '⏳ Saving...';
    }

    try {
      if (this.editingRole) {
        const updated = await this.api.updateRole(this.editingRole.id, { name, salary });
        const idx = this.roles.findIndex((r) => r.id === this.editingRole.id);
        if (idx >= 0) this.roles[idx] = updated;
        if (window.app) window.app.showToast(`Updated role "${name}" (${PayrollUtils.formatCurrency(salary, 0)})`, 'success');
      } else {
        const created = await this.api.createRole({ name, salary });
        this.roles.push(created);
        if (window.app) window.app.showToast(`Created role "${name}" (${PayrollUtils.formatCurrency(salary, 0)})`, 'success');
      }

      this.modal.close();
      this.render();
      this.broadcastRoles();
      if (window.employeeManager && typeof window.employeeManager.loadEmployees === 'function') {
        window.employeeManager.loadEmployees();
      }
    } catch (err) {
      console.error('[RoleManager] Error saving role:', err);
      if (window.app) window.app.showToast('Failed to save role: ' + err.message, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = origText;
      }
    }
  }

  async handleDelete(role) {
    if (!confirm(`Are you sure you want to remove the role "${role.name}" (${PayrollUtils.formatCurrency(role.salary, 0)})?`)) {
      return;
    }

    try {
      await this.api.deleteRole(role.id);
      this.roles = this.roles.filter((r) => r.id !== role.id);
      if (window.app) window.app.showToast(`Role "${role.name}" removed`, 'info');
      this.render();
      this.broadcastRoles();
      if (window.employeeManager && typeof window.employeeManager.loadEmployees === 'function') {
        window.employeeManager.loadEmployees();
      }
    } catch (err) {
      console.error('[RoleManager] Error removing role:', err);
      if (window.app) window.app.showToast('Failed to remove role: ' + err.message, 'error');
    }
  }
}
