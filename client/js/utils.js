/**
 * PayrollUtils - Core OOP utility class providing shared formatting,
 * calendar math, comparison algorithms, and DOM helpers across the application.
 */
class PayrollUtils {
  /**
   * Escape HTML entities to prevent XSS in dynamic templates.
   */
  static escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format a numeric amount to Indian Rupee format (e.g. ₹32,000.00).
   */
  static formatCurrency(num, decimals = 2) {
    const n = Number(num || 0);
    return '₹' + n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Format a numeric amount with standard Indian commas without the currency symbol.
   */
  static formatNumber(num, decimals = 2) {
    const n = Number(num || 0);
    return n.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Safe 2-decimal place rounding.
   */
  static round2(val) {
    return Math.round((Number(val) || 0) * 100) / 100;
  }

  /**
   * Natural alphanumeric string comparison (handles numbers within strings cleanly, e.g. EMP002 < EMP010).
   */
  static naturalCompare(a, b) {
    const strA = (a === null || a === undefined) ? '' : String(a);
    const strB = (b === null || b === undefined) ? '' : String(b);
    return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  }

  /**
   * Standardized sorting binder for HTML tables with <th class="sortable" data-sort="fieldName">.
   */
  static bindTableSorting(tableEl, getSortState, onSortChange) {
    if (!tableEl) return;
    tableEl.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (!field) return;
        const state = getSortState();
        let newDir = 'asc';
        if (state.field === field) {
          newDir = (state.direction === 'asc') ? 'desc' : 'asc';
        }
        onSortChange(field, newDir);
        PayrollUtils.updateSortHeaders(tableEl, field, newDir);
      });
    });
  }

  /**
   * Synchronize sort arrow styling on sortable table headers.
   */
  static updateSortHeaders(tableEl, sortField, sortDirection) {
    if (!tableEl) return;
    tableEl.querySelectorAll('th.sortable').forEach((th) => {
      const field = th.getAttribute('data-sort');
      th.classList.remove('sort-asc', 'sort-desc');
      if (field === sortField) {
        th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  /**
   * Dynamic Financial Year Generator (starting base year strictly 2026-27).
   */
  static getDynamicFinancialYears(baseStartYear = 2026) {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0 = Jan, 3 = Apr
    const currentFyStart = (curMonth >= 3) ? curYear : curYear - 1;
    const maxFyStart = Math.max(currentFyStart + 1, 2027);
    const list = [];
    for (let y = baseStartYear; y <= maxFyStart; y++) {
      const endShort = String((y + 1) % 100).padStart(2, '0');
      list.push(`${y}-${endShort}`);
    }
    return list;
  }

  /**
   * Combine Financial Year and Month Name into canonical "Month YYYY" string.
   */
  static getCombinedMonth(fy, monthName) {
    if (!fy || !monthName) return 'October 2026';
    const parts = fy.split('-');
    const startYear = parseInt(parts[0], 10);
    const secondYearShort = parseInt(parts[1], 10);
    const endYear = startYear >= 2000 ? Math.floor(startYear / 100) * 100 + secondYearShort : 2000 + secondYearShort;
    const janToMar = ['January', 'February', 'March'];
    const actualYear = janToMar.includes(monthName) ? endYear : startYear;
    return `${monthName} ${actualYear}`;
  }

  /**
   * Decompose "Month YYYY" string into { fy, month }.
   */
  static parseMonthStringToFyAndMonth(monthStr) {
    if (!monthStr) return { fy: '2026-27', month: 'October' };
    const parts = monthStr.trim().split(' ');
    if (parts.length >= 2) {
      const month = parts[0];
      const year = parseInt(parts[1], 10);
      const janToMar = ['January', 'February', 'March'];
      let startYear, endYear;
      if (janToMar.includes(month)) {
        startYear = year - 1;
        endYear = year;
      } else {
        startYear = year;
        endYear = year + 1;
      }
      const fy = `${startYear}-${String(endYear % 100).padStart(2, '0')}`;
      return { fy, month };
    }
    return { fy: '2026-27', month: 'October' };
  }

  /**
   * Determine exact number of days in a given "Month YYYY" (handles leap years).
   */
  static getDaysInMonth(monthStr) {
    const monthDaysMap = {
      january: 31, february: 28, march: 31, april: 30, may: 31, june: 30,
      july: 31, august: 31, september: 30, october: 31, november: 30, december: 31
    };
    if (!monthStr) return 30;
    const parts = monthStr.toLowerCase().split(' ');
    const mName = parts[0];
    const yr = parts[1] ? parseInt(parts[1], 10) : 2026;
    if (mName === 'february') {
      const isLeap = (yr % 4 === 0 && yr % 100 !== 0) || (yr % 400 === 0);
      return isLeap ? 29 : 28;
    }
    return monthDaysMap[mName] || 30;
  }

  /**
   * Calculate number of Sundays in a given "Month YYYY" (typically 4 or 5).
   */
  static getSundaysInMonth(monthStr) {
    if (!monthStr) return 4;
    const parts = monthStr.split(' ');
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const mIndex = monthNames.indexOf(parts[0].toLowerCase());
    const yr = parts[1] ? parseInt(parts[1], 10) : 2026;
    if (mIndex === -1) return 4;
    const totalDays = new Date(yr, mIndex + 1, 0).getDate();
    let sundays = 0;
    for (let day = 1; day <= totalDays; day++) {
      if (new Date(yr, mIndex, day).getDay() === 0) sundays++;
    }
    return sundays;
  }

  /**
   * Compute zero-based absolute month index (year * 12 + monthIndex) from "Month YYYY".
   */
  static getMonthYearIndex(monthStr) {
    if (!monthStr || typeof monthStr !== 'string') return 0;
    const parts = monthStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ];
      const mIdx = monthNames.indexOf(parts[0].toLowerCase());
      const year = parseInt(parts[1], 10);
      if (mIdx !== -1 && !isNaN(year)) {
        return year * 12 + mIdx;
      }
    }
    return 0;
  }

  /**
   * Compute zero-based absolute month index (year * 12 + monthIndex) from join date string.
   */
  static getJoinMonthYearIndex(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const trimmed = dateStr.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      return year * 12 + month;
    }
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const year = parseInt(dmyMatch[3], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      return year * 12 + month;
    }
    return 0;
  }

  /**
   * Convert integer amount to Indian English words.
   */
  static numberToWords(num) {
    const val = Math.round(Number(num) || 0);
    if (val <= 0) return 'Zero Rupees Only';
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

    return inWords(val) + ' Rupees Only';
  }
}

/**
 * ColumnVisibilityController - Reusable OOP component for customizable column visibility
 * with localStorage persistence and dropdown toggle menu.
 */
class ColumnVisibilityController {
  constructor(config) {
    this.storageKey = config.storageKey;
    this.tableEl = config.tableEl;
    this.dropdownEl = config.dropdownEl;
    this.btnEl = config.btnEl;
    this.menuEl = config.menuEl;
    this.listEl = config.listEl;
    this.allBtn = config.allBtn;
    this.resetBtn = config.resetBtn;
    this.availableCols = config.availableCols || [];
    this.defaultHidden = new Set(config.defaultHidden || []);
    this.hiddenColumns = new Set(this.defaultHidden);
    this.btnPrefix = config.btnPrefix || 'Columns';

    this.loadPreferences();
    this.initUI();
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.hiddenColumns = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load column preferences:', e);
    }
  }

  savePreferences() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.hiddenColumns]));
    } catch (e) {
      console.warn('Failed to save column preferences:', e);
    }
  }

  initUI() {
    if (!this.btnEl || !this.menuEl) return;

    this.btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = this.menuEl.style.display === 'block';
      this.menuEl.style.display = isOpen ? 'none' : 'block';
    });

    this.menuEl.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
      if (this.dropdownEl && !this.dropdownEl.contains(e.target)) {
        this.menuEl.style.display = 'none';
      }
    });

    if (this.allBtn) {
      this.allBtn.addEventListener('click', () => {
        this.hiddenColumns.clear();
        this.savePreferences();
        this.renderMenuList();
        this.applyVisibility();
      });
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.hiddenColumns = new Set(this.defaultHidden);
        this.savePreferences();
        this.renderMenuList();
        this.applyVisibility();
      });
    }

    this.renderMenuList();
    this.applyVisibility();
  }

  renderMenuList() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    this.availableCols.forEach((col) => {
      const isVisible = !this.hiddenColumns.has(col.key);
      const isMandatory = (col.key === 'id' || col.key === 'name' || col.key === 'index');

      const label = document.createElement('label');
      label.className = 'col-toggle-item';
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '0.5rem';
      label.style.padding = '0.35rem 0.5rem';
      label.style.fontSize = '0.82rem';
      label.style.cursor = isMandatory ? 'not-allowed' : 'pointer';
      label.style.color = isMandatory ? 'var(--text-muted)' : 'var(--text-primary)';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = isVisible;
      chk.disabled = isMandatory;
      chk.value = col.key;

      if (!isMandatory) {
        chk.addEventListener('change', () => {
          if (chk.checked) this.hiddenColumns.delete(col.key);
          else this.hiddenColumns.add(col.key);
          this.savePreferences();
          this.applyVisibility();
          this.updateBtnText();
        });
      }

      label.appendChild(chk);
      label.appendChild(document.createTextNode(col.label));
      this.listEl.appendChild(label);
    });

    this.updateBtnText();
  }

  updateBtnText() {
    if (!this.btnEl) return;
    const visibleCount = this.availableCols.length - this.hiddenColumns.size;
    this.btnEl.innerHTML = `<span>⚙️ ${this.btnPrefix} (${visibleCount}/${this.availableCols.length})</span> ▾`;
  }

  applyVisibility() {
    if (!this.tableEl) return;
    this.availableCols.forEach((col) => {
      const isHidden = this.hiddenColumns.has(col.key);
      const cells = this.tableEl.querySelectorAll(`[data-col="${col.key}"]`);
      cells.forEach((cell) => {
        cell.style.display = isHidden ? 'none' : '';
      });
    });
    this.updateBtnText();
  }

  isHidden(colKey) {
    return this.hiddenColumns.has(colKey);
  }
}

/**
 * ModalController - OOP controller managing accessible dialog modals
 * with backdrop dismiss, Escape key handling, and background scroll locking.
 */
class ModalController {
  constructor(modalEl, options = {}) {
    this.modalEl = modalEl;
    this.onClose = options.onClose || null;
    this.onOpen = options.onOpen || null;
    this.init();
  }

  init() {
    if (!this.modalEl) return;
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    const closeBtns = this.modalEl.querySelectorAll('[data-modal-close], .employee-card-close');
    closeBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });
  }

  isOpen() {
    return this.modalEl && (this.modalEl.classList.contains('active') || this.modalEl.style.display === 'flex');
  }

  open() {
    if (!this.modalEl) return;
    this.modalEl.style.display = 'flex';
    // Force layout recalculation so the opacity transition triggers
    void this.modalEl.offsetHeight;
    this.modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (typeof this.onOpen === 'function') this.onOpen();
  }

  close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('active');
    setTimeout(() => {
      if (!this.modalEl.classList.contains('active')) {
        this.modalEl.style.display = 'none';
      }
    }, 200);
    document.body.style.overflow = 'auto';
    if (typeof this.onClose === 'function') this.onClose();
  }
}

// Global Exports and Backward Compatibility Aliases
window.PayrollUtils = PayrollUtils;
window.ColumnVisibilityController = ColumnVisibilityController;
window.ModalController = ModalController;

window.getCombinedMonth = PayrollUtils.getCombinedMonth;
window.parseMonthStringToFyAndMonth = PayrollUtils.parseMonthStringToFyAndMonth;
window.getDynamicFinancialYears = PayrollUtils.getDynamicFinancialYears;
