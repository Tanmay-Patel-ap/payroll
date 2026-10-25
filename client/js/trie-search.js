/**
 * trie-search.js (Lightweight Searchable Dropdown)
 *
 * A clean, lightweight dropdown that looks exactly like a native select.
 * When the user types anything, options that cannot match are instantly eliminated.
 */

class LightSearchableDropdown {
  constructor(selectElement, options = {}) {
    this.select = typeof selectElement === 'string' ? document.querySelector(selectElement) : selectElement;
    if (!this.select) return;

    // Avoid double enhancement
    if (this.select._lightDropdown) {
      return this.select._lightDropdown;
    }

    this.options = Object.assign({
      placeholder: this.select.getAttribute('data-placeholder') || 'Select or type to filter...',
      allowCustom: true,
      onChange: null
    }, options);

    this.items = []; // { value, label, group, el, groupEl }
    this.isOpen = false;
    this.highlightedIndex = -1;

    this.initDOM();
    this.rebuild();
    this.bindEvents();

    this.select._lightDropdown = this;
    this.select._trieDropdown = this; // Backward compatibility
  }

  initDOM() {
    // Hide original select
    this.select.style.display = 'none';

    // Create wrapper styled like a select
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'light-select-wrapper';
    if (this.select.className) {
      this.wrapper.className += ' ' + this.select.className;
    }
    this.wrapper.style.display = 'inline-block';
    this.wrapper.style.width = this.select.style.width || '100%';

    // Create input that looks identical to a native select
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'form-control light-select-input';
    this.input.placeholder = this.options.placeholder;
    this.input.autocomplete = 'off';
    this.input.spellcheck = false;

    // Create dropdown menu
    this.menu = document.createElement('div');
    this.menu.className = 'light-select-menu';
    this.menu.style.display = 'none';

    this.wrapper.appendChild(this.input);
    this.wrapper.appendChild(this.menu);
    this.select.parentNode.insertBefore(this.wrapper, this.select);
  }

  rebuild() {
    this.menu.innerHTML = '';
    this.items = [];

    const children = Array.from(this.select.children);
    let itemIdx = 0;

    children.forEach((child) => {
      if (child.tagName === 'OPTGROUP') {
        const groupHeader = document.createElement('div');
        groupHeader.className = 'light-select-group';
        groupHeader.textContent = child.label || '';
        this.menu.appendChild(groupHeader);

        const groupItems = [];
        Array.from(child.children).forEach((opt) => {
          if (opt.value !== '') {
            const el = this.createOptionElement(opt, itemIdx);
            this.menu.appendChild(el);
            const itemObj = {
              index: itemIdx++,
              value: opt.value,
              label: opt.textContent.trim(),
              group: child.label || '',
              el,
              groupEl: groupHeader
            };
            this.items.push(itemObj);
            groupItems.push(itemObj);
          }
        });
        groupHeader._items = groupItems;
      } else if (child.tagName === 'OPTION') {
        if (child.value !== '') {
          const el = this.createOptionElement(child, itemIdx);
          this.menu.appendChild(el);
          this.items.push({
            index: itemIdx++,
            value: child.value,
            label: child.textContent.trim(),
            group: '',
            el,
            groupEl: null
          });
        }
      }
    });

    // Empty state container
    this.emptyNotice = document.createElement('div');
    this.emptyNotice.className = 'light-select-empty';
    this.emptyNotice.style.display = 'none';
    this.menu.appendChild(this.emptyNotice);

    // Sync current select value
    this.syncFromSelect();
  }

  createOptionElement(opt, index) {
    const el = document.createElement('div');
    el.className = 'light-select-option';
    el.textContent = opt.textContent.trim();
    el.setAttribute('data-value', opt.value);
    el.setAttribute('data-index', index);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectOption(opt.value, opt.textContent.trim());
    });

    el.addEventListener('mouseenter', () => {
      this.highlightItem(index);
    });

    return el;
  }

  bindEvents() {
    // Focus: select all text so user can immediately type to filter
    this.input.addEventListener('focus', () => {
      this.input.select();
      this.open();
      this.filter(this.input.value);
    });

    this.input.addEventListener('click', () => {
      if (!this.isOpen) {
        this.open();
        this.filter(this.input.value);
      }
    });

    // Typing: instantly eliminates non-matching options
    this.input.addEventListener('input', () => {
      if (!this.isOpen) this.open();
      this.filter(this.input.value);
    });

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.wrapper.contains(e.target)) {
        this.close();
      }
    });

    // Listen to external change on select
    this.select.addEventListener('syncTrie', () => this.syncFromSelect());
  }

  filter(query) {
    const q = (query || '').toLowerCase().trim();
    let visibleCount = 0;

    // Filter items: eliminate options that cannot match
    this.items.forEach((item) => {
      const match = !q || item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q);
      if (match) {
        item.el.style.display = 'block';
        visibleCount++;
      } else {
        item.el.style.display = 'none';
      }
    });

    // Update optgroup headers visibility
    const groups = this.menu.querySelectorAll('.light-select-group');
    groups.forEach((grp) => {
      if (grp._items) {
        const hasVisibleChild = grp._items.some((it) => it.el.style.display !== 'none');
        grp.style.display = hasVisibleChild ? 'block' : 'none';
      }
    });

    // Handle no matching options
    if (visibleCount === 0) {
      this.emptyNotice.style.display = 'block';
      if (this.options.allowCustom && q) {
        this.emptyNotice.textContent = `Use custom: "${query.trim()}" (Press Enter)`;
      } else {
        this.emptyNotice.textContent = 'No matching options';
      }
    } else {
      this.emptyNotice.style.display = 'none';
    }

    // Set highlighted item to first visible
    const firstVis = this.items.find((it) => it.el.style.display !== 'none');
    this.highlightedIndex = firstVis ? firstVis.index : -1;
    this.updateHighlightUI();
  }

  handleKeyDown(e) {
    const visibleItems = this.items.filter((it) => it.el.style.display !== 'none');

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
          this.filter(this.input.value);
          return;
        }
        if (visibleItems.length > 0) {
          const curPos = visibleItems.findIndex((it) => it.index === this.highlightedIndex);
          const nextPos = (curPos + 1) % visibleItems.length;
          this.highlightItem(visibleItems[nextPos].index, true);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
          this.filter(this.input.value);
          return;
        }
        if (visibleItems.length > 0) {
          const curPos = visibleItems.findIndex((it) => it.index === this.highlightedIndex);
          const prevPos = (curPos - 1 + visibleItems.length) % visibleItems.length;
          this.highlightItem(visibleItems[prevPos].index, true);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (this.highlightedIndex >= 0) {
          const selected = this.items.find((it) => it.index === this.highlightedIndex);
          if (selected && selected.el.style.display !== 'none') {
            this.selectOption(selected.value, selected.label);
            return;
          }
        }
        if (this.options.allowCustom && this.input.value.trim()) {
          this.selectCustom(this.input.value.trim());
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        break;

      case 'Tab':
        if (this.isOpen && this.highlightedIndex >= 0) {
          const selected = this.items.find((it) => it.index === this.highlightedIndex);
          if (selected && selected.el.style.display !== 'none') {
            this.selectOption(selected.value, selected.label);
          }
        }
        this.close();
        break;
    }
  }

  highlightItem(index, scroll = false) {
    this.highlightedIndex = index;
    this.updateHighlightUI(scroll);
  }

  updateHighlightUI(scroll = false) {
    this.items.forEach((item) => {
      if (item.index === this.highlightedIndex) {
        item.el.classList.add('highlighted');
        if (scroll) {
          item.el.scrollIntoView({ block: 'nearest' });
        }
      } else {
        item.el.classList.remove('highlighted');
      }
    });
  }

  selectOption(value, label) {
    this.input.value = label;
    this.select.value = value;

    // Highlight selected in UI
    this.items.forEach((item) => {
      item.el.classList.toggle('selected', item.value === value);
    });

    this.close();

    // Trigger standard change event on native select
    this.select.dispatchEvent(new Event('change', { bubbles: true }));

    if (typeof this.options.onChange === 'function') {
      this.options.onChange(value, label);
    }
  }

  selectCustom(customValue) {
    const val = customValue.trim();
    this.input.value = val;

    // Check if option already exists
    let existing = Array.from(this.select.options).find(
      (opt) => opt.value.toLowerCase() === val.toLowerCase() || opt.textContent.trim().toLowerCase() === val.toLowerCase()
    );

    if (existing) {
      this.select.value = existing.value;
    } else {
      const newOpt = new Option(val, val, true, true);
      this.select.add(newOpt);
      this.select.value = val;
    }

    this.close();
    this.select.dispatchEvent(new Event('change', { bubbles: true }));

    if (typeof this.options.onChange === 'function') {
      this.options.onChange(val, val);
    }
  }

  syncFromSelect() {
    const val = this.select.value;
    if (!val) {
      this.input.value = '';
      this.items.forEach((it) => it.el.classList.remove('selected'));
      return;
    }

    const matched = this.items.find((it) => it.value === val);
    if (matched) {
      this.input.value = matched.label;
      this.items.forEach((it) => it.el.classList.toggle('selected', it.value === val));
    } else {
      this.input.value = val;
    }
  }

  setValue(value, triggerChange = true) {
    this.select.value = value;
    this.syncFromSelect();
    if (triggerChange) {
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  getValue() {
    return this.select.value || this.input.value.trim();
  }

  open() {
    this.isOpen = true;
    this.menu.style.display = 'block';
  }

  close() {
    this.isOpen = false;
    this.menu.style.display = 'none';
    // If input is empty and was cancelled, sync back
    if (!this.input.value.trim() && this.select.value) {
      this.syncFromSelect();
    }
  }

  static enhanceSelect(selectElement, options = {}) {
    return new LightSearchableDropdown(selectElement, options);
  }
}

// Global aliases so other files work seamlessly
window.LightSearchableDropdown = LightSearchableDropdown;
window.SearchableSelect = LightSearchableDropdown;
window.TrieDropdown = LightSearchableDropdown;
