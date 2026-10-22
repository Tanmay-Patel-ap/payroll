/**
 * EmployeeManager - Handles employee listing, addition, and removal
 */
class EmployeeManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.employees = [];
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.tableBody = document.getElementById('employees-tbody');
    this.empCountEl = document.getElementById('emp-total-count');
    this.addForm = document.getElementById('add-employee-form');
    this.nameInput = document.getElementById('emp-name');
    this.desigInput = document.getElementById('emp-designation');
    this.salaryInput = document.getElementById('emp-base-salary');
    this.idInput = document.getElementById('emp-id');
  }

  bindEvents() {
    if (this.addForm) {
      this.addForm.addEventListener('submit', (e) => this.handleAddEmployee(e));
    }
  }

  async loadEmployees() {
    try {
      this.employees = await this.api.getEmployees();
      this.render();
      // Notify other components if needed
      window.dispatchEvent(new CustomEvent('employeesUpdated', { detail: this.employees }));
    } catch (err) {
      window.app.showToast('Failed to load employees: ' + err.message, 'error');
    }
  }

  render() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    if (this.empCountEl) {
      this.empCountEl.textContent = this.employees.length;
    }

    if (this.employees.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No employees found. Add your first employee above!
          </td>
        </tr>
      `;
      return;
    }

    this.employees.forEach((emp) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: var(--primary);">${this.escapeHtml(emp.id)}</strong></td>
        <td><strong>${this.escapeHtml(emp.name)}</strong></td>
        <td><span class="badge badge-info">${this.escapeHtml(emp.designation || 'Staff')}</span></td>
        <td style="font-weight: 600;">₹${Number(emp.baseSalary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        <td style="text-align: right;">
          <button class="btn btn-danger btn-sm" data-id="${emp.id}" title="Remove Employee">
            Remove
          </button>
        </td>
      `;

      tr.querySelector('button').addEventListener('click', () => this.handleDeleteEmployee(emp.id, emp.name));
      this.tableBody.appendChild(tr);
    });
  }

  async handleAddEmployee(e) {
    e.preventDefault();
    const name = this.nameInput.value.trim();
    const designation = this.desigInput.value.trim();
    const baseSalary = parseFloat(this.salaryInput.value);
    const id = this.idInput ? this.idInput.value.trim() : '';

    if (!name || isNaN(baseSalary) || baseSalary < 0) {
      window.app.showToast('Please provide a valid employee name and salary', 'error');
      return;
    }

    try {
      await this.api.createEmployee({ id, name, designation, baseSalary });
      window.app.showToast(`Employee "${name}" added successfully!`, 'success');
      this.addForm.reset();
      await this.loadEmployees();
    } catch (err) {
      window.app.showToast('Failed to add employee: ' + err.message, 'error');
    }
  }

  async handleDeleteEmployee(id, name) {
    if (!confirm(`Are you sure you want to remove employee "${name}" (${id})?`)) {
      return;
    }

    try {
      await this.api.deleteEmployee(id);
      window.app.showToast(`Employee "${name}" removed.`, 'success');
      await this.loadEmployees();
    } catch (err) {
      window.app.showToast('Failed to remove employee: ' + err.message, 'error');
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

