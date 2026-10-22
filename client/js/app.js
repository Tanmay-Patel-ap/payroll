/**
 * App - Main orchestrator managing tabs, state, and toast notifications
 */
class App {
  constructor() {
    this.currentTab = 'bulk-tab';
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

// Global bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  window.app = new App();
  window.employeeManager = new EmployeeManager(window.apiClient);
  window.singlePayrollEntry = new SinglePayrollEntry(window.apiClient);
  window.bulkPayrollEntry = new BulkPayrollEntry(window.apiClient);
  window.salarySheetManager = new SalarySheetManager(window.apiClient);
  window.payslipViewer = new PayslipViewer(window.apiClient);

  // Load initial employees and recorded months
  await window.employeeManager.loadEmployees();
  await window.salarySheetManager.refreshMonthsList();
  await window.payslipViewer.refreshMonthsList();

  // If there's an active month, initialize inputs
  const defaultMonth = "October 2026";
  const m1 = document.getElementById('bulk-month');
  const m2 = document.getElementById('single-month');
  const m3 = document.getElementById('sheet-month-input');
  const m4 = document.getElementById('slip-month-input');

  if (m1) m1.value = defaultMonth;
  if (m2) m2.value = defaultMonth;
  if (m3) m3.value = defaultMonth;
  if (m4) m4.value = defaultMonth;

  // Pre-load sheet for default month
  window.salarySheetManager.loadSheet(defaultMonth);
});

