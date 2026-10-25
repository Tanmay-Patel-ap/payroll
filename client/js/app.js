/**
 * App - Main orchestrator managing tabs, state, and toast notifications
 */
class App {
  constructor() {
    this.currentTab = 'salary-sheet-tab';
    this.toastContainer = document.getElementById('toast-container');
    this.initTabs();
  }

  initTabs() {
    const navButtons = document.querySelectorAll('.main-nav button');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update nav active states
    document.querySelectorAll('.main-nav button').forEach((btn) => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab pane visibility
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      if (pane.id === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  prepareAndPrint(tabId) {
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      if (pane.id === tabId) {
        pane.classList.add('print-active');
      } else {
        pane.classList.remove('print-active');
      }
    });

    window.print();

    // Cleanup after print dialog closes
    setTimeout(() => {
      document.querySelectorAll('.tab-pane').forEach((pane) => {
        pane.classList.remove('print-active');
      });
    }, 1000);
  }
}

function initFinancialYearSelects() {
  const years = PayrollUtils.getDynamicFinancialYears(2026);
  const selectIds = ['sheet-fy-select', 'slip-fy-select'];
  selectIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '';
    years.forEach((fy) => {
      const opt = document.createElement('option');
      opt.value = fy;
      opt.textContent = `FY ${fy}`;
      el.appendChild(opt);
    });
    if (years.includes(prev)) {
      el.value = prev;
    } else {
      el.value = '2026-27';
    }
  });
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize dynamic financial year dropdowns (starting 2026-27 onwards)
  initFinancialYearSelects();

  window.app = new App();
  window.roleManager = new RoleManager(window.apiClient);
  window.employeeManager = new EmployeeManager(window.apiClient);
  window.salarySheetManager = new SalarySheetManager(window.apiClient);
  window.payslipViewer = new PayslipViewer(window.apiClient);
  window.backupManager = new BackupManager(window.apiClient);

  // Load initial employees
  await window.employeeManager.loadEmployees();

  // Pre-load sheet for default month
  const defaultMonth = "October 2026";
  window.salarySheetManager.setMonth(defaultMonth);
});

