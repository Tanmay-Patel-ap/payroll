/**
 * BackupManager - Manages data folder backups and restoration.
 * Supports copying to custom user directories, full ZIP archive download/upload,
 * native Windows folder browser dialogs, and automated scheduled backups.
 */
class BackupManager {
  constructor(apiClient) {
    this.api = apiClient;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.modal = document.getElementById('backup-restore-modal');
    this.openBtn = document.getElementById('btn-open-backup-modal');
    this.closeBtn = document.getElementById('backup-modal-close-btn');
    this.doneBtn = document.getElementById('backup-modal-done-btn');

    // Tabs
    this.tabBackup = document.getElementById('tab-btn-backup');
    this.tabRestore = document.getElementById('tab-btn-restore');
    this.tabAuto = document.getElementById('tab-btn-auto');

    // View Panes
    this.backupView = document.getElementById('backup-view-pane');
    this.restoreView = document.getElementById('restore-view-pane');
    this.autoView = document.getElementById('auto-backup-pane');

    // Manual Folder Backup
    this.targetPathInput = document.getElementById('backup-target-path');
    this.browseBackupPathBtn = document.getElementById('btn-browse-backup-path');
    this.setDefaultBtn = document.getElementById('btn-set-default-path');
    this.doFolderBackupBtn = document.getElementById('btn-execute-folder-backup');
    this.downloadZipBackupBtn = document.getElementById('btn-download-backup-zip');

    // Manual Restore
    this.sourcePathInput = document.getElementById('restore-source-path');
    this.browseRestorePathBtn = document.getElementById('btn-browse-restore-path');
    this.doFolderRestoreBtn = document.getElementById('btn-execute-folder-restore');
    this.zipFileInput = document.getElementById('restore-zip-input');
    this.doZipRestoreBtn = document.getElementById('btn-execute-zip-restore');

    // Automated Backup
    this.autoEnabledCheckbox = document.getElementById('auto-backup-enabled');
    this.autoEnabledLabel = document.getElementById('auto-backup-enabled-label');
    this.autoIntervalValue = document.getElementById('auto-backup-interval-value');
    this.autoIntervalUnit = document.getElementById('auto-backup-interval-unit');
    this.autoDestFolder = document.getElementById('auto-backup-dest-folder');
    this.browseAutoDestBtn = document.getElementById('btn-browse-auto-backup-dest');
    this.autoKeepCopies = document.getElementById('auto-backup-keep-copies');
    this.autoLastTime = document.getElementById('auto-backup-last-time');
    this.autoLastStatus = document.getElementById('auto-backup-last-status');
    this.autoLastPath = document.getElementById('auto-backup-last-path');
    this.saveAutoConfigBtn = document.getElementById('btn-save-auto-backup-config');
    this.runAutoNowBtn = document.getElementById('btn-run-auto-backup-now');

    this.statusBox = document.getElementById('backup-status-box');
  }

  bindEvents() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.openModal());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.doneBtn) {
      this.doneBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.tabBackup) {
      this.tabBackup.addEventListener('click', () => this.switchTab('backup'));
    }
    if (this.tabRestore) {
      this.tabRestore.addEventListener('click', () => this.switchTab('restore'));
    }
    if (this.tabAuto) {
      this.tabAuto.addEventListener('click', () => this.switchTab('auto'));
    }

    if (this.setDefaultBtn) {
      this.setDefaultBtn.addEventListener('click', () => this.setDefaultBackupPath());
    }

    if (this.browseBackupPathBtn) {
      this.browseBackupPathBtn.addEventListener('click', () => {
        this.browseFolder(this.targetPathInput, 'Select Backup Destination Folder');
      });
    }

    if (this.browseRestorePathBtn) {
      this.browseRestorePathBtn.addEventListener('click', () => {
        this.browseFolder(this.sourcePathInput, 'Select Backup Folder to Restore');
      });
    }

    if (this.browseAutoDestBtn) {
      this.browseAutoDestBtn.addEventListener('click', () => {
        this.browseFolder(this.autoDestFolder, 'Select Automated Backup Directory');
      });
    }

    if (this.doFolderBackupBtn) {
      this.doFolderBackupBtn.addEventListener('click', () => this.handleFolderBackup());
    }

    if (this.downloadZipBackupBtn) {
      this.downloadZipBackupBtn.addEventListener('click', () => this.handleDownloadZipBackup());
    }

    if (this.doFolderRestoreBtn) {
      this.doFolderRestoreBtn.addEventListener('click', () => this.handleFolderRestore());
    }

    if (this.doZipRestoreBtn) {
      this.doZipRestoreBtn.addEventListener('click', () => this.handleZipRestore());
    }

    if (this.autoEnabledCheckbox) {
      this.autoEnabledCheckbox.addEventListener('change', () => {
        if (this.autoEnabledLabel) {
          const on = this.autoEnabledCheckbox.checked;
          this.autoEnabledLabel.textContent = on ? 'Enabled' : 'Disabled';
          this.autoEnabledLabel.style.color = on ? '#16a34a' : '#64748b';
        }
      });
    }

    if (this.saveAutoConfigBtn) {
      this.saveAutoConfigBtn.addEventListener('click', () => this.handleSaveAutoConfig());
    }

    if (this.runAutoNowBtn) {
      this.runAutoNowBtn.addEventListener('click', () => this.handleRunAutoNow());
    }
  }

  openModal() {
    this.clearStatus();
    if (!this.targetPathInput.value) {
      this.setDefaultBackupPath();
    }
    this.loadAutoBackupConfig();
    if (this.modal) {
      this.modal.classList.add('active');
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('active');
    }
  }

  switchTab(tab) {
    this.clearStatus();
    if (this.tabBackup) {
      this.tabBackup.className = (tab === 'backup') ? 'btn btn-primary' : 'btn btn-secondary';
    }
    if (this.tabRestore) {
      this.tabRestore.className = (tab === 'restore') ? 'btn btn-primary' : 'btn btn-secondary';
    }
    if (this.tabAuto) {
      this.tabAuto.className = (tab === 'auto') ? 'btn btn-primary' : 'btn btn-secondary';
    }

    if (this.backupView) {
      this.backupView.style.display = (tab === 'backup') ? 'block' : 'none';
    }
    if (this.restoreView) {
      this.restoreView.style.display = (tab === 'restore') ? 'block' : 'none';
    }
    if (this.autoView) {
      this.autoView.style.display = (tab === 'auto') ? 'block' : 'none';
    }

    if (tab === 'auto') {
      this.loadAutoBackupConfig();
    }
  }

  async browseFolder(targetInputElement, dialogTitle = 'Select Folder') {
    try {
      if (window.app) window.app.showToast('Opening folder selection dialog in Windows...', 'info');
      const resp = await fetch('/api/browse-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: dialogTitle })
      });
      const data = await resp.json();

      if (resp.ok && data.success && data.path) {
        if (targetInputElement) {
          targetInputElement.value = data.path;
          targetInputElement.focus();
        }
        if (window.app) window.app.showToast(`Selected: ${data.path}`, 'success');
      } else if (data.cancelled) {
        // Selection cancelled by user
      } else {
        if (window.app) window.app.showToast(data.error || 'Could not select folder', 'warning');
      }
    } catch (e) {
      console.warn('Folder browser dialog error:', e);
      if (window.app) window.app.showToast(`Could not open browser dialog: ${e.message}`, 'warning');
    }
  }

  setDefaultBackupPath() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const defaultPath = `C:\\PayrollBackups\\backup_${dateStr}_${timeStr}`;
    if (this.targetPathInput) {
      this.targetPathInput.value = defaultPath;
    }
  }

  showStatus(message, isSuccess = true) {
    if (!this.statusBox) return;
    this.statusBox.style.display = 'block';
    if (isSuccess) {
      this.statusBox.style.background = '#f0fdf4';
      this.statusBox.style.border = '1px solid #86efac';
      this.statusBox.style.color = '#15803d';
      this.statusBox.innerHTML = `<strong>✅ Success:</strong> ${message}`;
    } else {
      this.statusBox.style.background = '#fef2f2';
      this.statusBox.style.border = '1px solid #fca5a5';
      this.statusBox.style.color = '#b91c1c';
      this.statusBox.innerHTML = `<strong>❌ Error:</strong> ${message}`;
    }
  }

  clearStatus() {
    if (this.statusBox) {
      this.statusBox.style.display = 'none';
      this.statusBox.innerHTML = '';
    }
  }

  async handleFolderBackup() {
    const targetPath = (this.targetPathInput?.value || '').trim();
    if (!targetPath) {
      this.showStatus('Please enter or browse to a destination folder path.', false);
      this.targetPathInput?.focus();
      return;
    }

    this.doFolderBackupBtn.disabled = true;
    this.doFolderBackupBtn.textContent = '⏳ Backing up...';
    this.clearStatus();

    try {
      const resp = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath })
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        const sizeMb = (data.totalSizeBytes / (1024 * 1024)).toFixed(2);
        this.showStatus(`${data.message} (${data.fileCount} files, ${sizeMb} MB) at ${data.timestamp}`, true);
        if (window.app) window.app.showToast('Data backed up successfully!', 'success');
      } else {
        this.showStatus(data.error || 'Failed to complete backup', false);
      }
    } catch (err) {
      this.showStatus(`Network/Server error: ${err.message}`, false);
    } finally {
      this.doFolderBackupBtn.disabled = false;
      this.doFolderBackupBtn.textContent = '📁 Copy Backup to Folder';
    }
  }

  handleDownloadZipBackup() {
    window.location.href = '/api/backup/download';
    if (window.app) window.app.showToast('Preparing backup ZIP download...', 'info');
  }

  async handleFolderRestore() {
    const sourcePath = (this.sourcePathInput?.value || '').trim();
    if (!sourcePath) {
      this.showStatus('Please enter or browse to the folder path containing your backup.', false);
      this.sourcePathInput?.focus();
      return;
    }

    if (!confirm(`Are you sure you want to restore data from:\n${sourcePath}\n\nThis will update your active payroll records. A safety snapshot will be saved.`)) {
      return;
    }

    this.doFolderRestoreBtn.disabled = true;
    this.doFolderRestoreBtn.textContent = '⏳ Restoring Data...';
    this.clearStatus();

    try {
      const resp = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath })
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        this.showStatus(`${data.message}\nSafety snapshot created at: ${data.safetyBackup}`, true);
        if (window.app) window.app.showToast('Data restored successfully! Refreshing...', 'success');
        await this.reloadApplicationData();
      } else {
        this.showStatus(data.error || 'Failed to restore data', false);
      }
    } catch (err) {
      this.showStatus(`Network/Server error: ${err.message}`, false);
    } finally {
      this.doFolderRestoreBtn.disabled = false;
      this.doFolderRestoreBtn.textContent = '🔄 Restore from Folder Path';
    }
  }

  async handleZipRestore() {
    const file = this.zipFileInput?.files?.[0];
    if (!file) {
      this.showStatus('Please select a backup .zip file to upload and restore.', false);
      return;
    }

    if (!confirm(`Are you sure you want to restore data from ${file.name}?\n\nThis will update your active database. A safety snapshot will be created.`)) {
      return;
    }

    this.doZipRestoreBtn.disabled = true;
    this.doZipRestoreBtn.textContent = '⏳ Uploading & Restoring...';
    this.clearStatus();

    try {
      const resp = await fetch('/api/restore/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: file
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        this.showStatus(`${data.message}\nSafety snapshot created at: ${data.safetyBackup}`, true);
        if (window.app) window.app.showToast('Backup ZIP restored successfully! Refreshing...', 'success');
        if (this.zipFileInput) this.zipFileInput.value = '';
        await this.reloadApplicationData();
      } else {
        this.showStatus(data.error || 'Failed to restore ZIP backup', false);
      }
    } catch (err) {
      this.showStatus(`Network/Server error: ${err.message}`, false);
    } finally {
      this.doZipRestoreBtn.disabled = false;
      this.doZipRestoreBtn.textContent = '📤 Upload & Restore ZIP';
    }
  }

  async loadAutoBackupConfig() {
    try {
      const resp = await fetch('/api/backup/auto-config');
      if (!resp.ok) return;
      const cfg = await resp.json();

      if (this.autoEnabledCheckbox) {
        this.autoEnabledCheckbox.checked = !!cfg.enabled;
        if (this.autoEnabledLabel) {
          this.autoEnabledLabel.textContent = cfg.enabled ? 'Enabled' : 'Disabled';
          this.autoEnabledLabel.style.color = cfg.enabled ? '#16a34a' : '#64748b';
        }
      }

      if (this.autoIntervalValue) {
        this.autoIntervalValue.value = cfg.intervalValue || 6;
      }

      if (this.autoIntervalUnit) {
        this.autoIntervalUnit.value = cfg.intervalType || 'hours';
      }

      if (this.autoDestFolder) {
        this.autoDestFolder.value = cfg.destinationFolder || '';
      }

      if (this.autoKeepCopies) {
        this.autoKeepCopies.value = cfg.keepCopies || 10;
      }

      if (this.autoLastTime) {
        this.autoLastTime.textContent = cfg.lastBackupTime || 'None yet';
      }

      if (this.autoLastStatus) {
        this.autoLastStatus.textContent = cfg.lastBackupStatus || 'N/A';
        if (cfg.lastBackupStatus === 'Success') {
          this.autoLastStatus.style.color = '#16a34a';
        } else if (cfg.lastBackupStatus && cfg.lastBackupStatus.startsWith('Failed')) {
          this.autoLastStatus.style.color = '#dc2626';
        } else {
          this.autoLastStatus.style.color = '#64748b';
        }
      }

      if (this.autoLastPath) {
        this.autoLastPath.textContent = cfg.lastBackupPath || '-';
      }
    } catch (e) {
      console.warn('Could not load auto backup config:', e);
    }
  }

  async handleSaveAutoConfig() {
    const enabled = this.autoEnabledCheckbox ? this.autoEnabledCheckbox.checked : false;
    const intervalValue = parseInt(this.autoIntervalValue?.value || '6', 10);
    const intervalType = this.autoIntervalUnit?.value || 'hours';
    const destinationFolder = (this.autoDestFolder?.value || '').trim();
    const keepCopies = parseInt(this.autoKeepCopies?.value || '10', 10);

    if (isNaN(intervalValue) || intervalValue < 1) {
      this.showStatus('Please enter a valid interval period (minimum 1).', false);
      return;
    }

    if (enabled && !destinationFolder) {
      this.showStatus('Please specify or browse to an automated backup directory.', false);
      return;
    }

    this.saveAutoConfigBtn.disabled = true;
    this.saveAutoConfigBtn.textContent = '⏳ Saving...';
    this.clearStatus();

    try {
      const resp = await fetch('/api/backup/auto-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          intervalValue,
          intervalType,
          destinationFolder,
          keepCopies
        })
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        this.showStatus('Automated backup configuration saved successfully!', true);
        if (window.app) window.app.showToast('Auto-backup settings saved!', 'success');
        this.loadAutoBackupConfig();
      } else {
        this.showStatus(data.error || 'Failed to save auto-backup settings', false);
      }
    } catch (e) {
      this.showStatus(`Network error: ${e.message}`, false);
    } finally {
      this.saveAutoConfigBtn.disabled = false;
      this.saveAutoConfigBtn.textContent = '💾 Save Auto-Backup Settings';
    }
  }

  async handleRunAutoNow() {
    this.runAutoNowBtn.disabled = true;
    this.runAutoNowBtn.textContent = '⏳ Running Backup...';
    this.clearStatus();

    try {
      const resp = await fetch('/api/backup/auto-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await resp.json();

      if (resp.ok && data.success) {
        this.showStatus(`${data.message}`, true);
        if (window.app) window.app.showToast('Automated backup snapshot created!', 'success');
        this.loadAutoBackupConfig();
      } else {
        this.showStatus(data.error || 'Failed to execute automated backup', false);
      }
    } catch (e) {
      this.showStatus(`Network error: ${e.message}`, false);
    } finally {
      this.runAutoNowBtn.disabled = false;
      this.runAutoNowBtn.textContent = '⚡ Run Backup Now';
    }
  }

  async reloadApplicationData() {
    try {
      if (window.employeeManager) {
        await window.employeeManager.loadEmployees();
      }
      if (window.roleManager) {
        await window.roleManager.loadRoles();
      }
      if (window.salarySheetManager) {
        await window.salarySheetManager.loadSheet();
      }
    } catch (e) {
      console.warn('Could not reload all managers automatically:', e);
    }
  }
}

window.BackupManager = BackupManager;
