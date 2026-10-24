/**
 * ApiClient - Object-Oriented HTTP client for C++ Payroll Server
 */
class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on [${config.method || 'GET'}] ${endpoint}:`, err);
      throw err;
    }
  }

  // Employee Endpoints
  async getEmployees() {
    return this.request('/api/employees');
  }

  async getEmployeeById(id) {
    return this.request(`/api/employees/${encodeURIComponent(id)}`);
  }

  async createEmployee(employeeData) {
    return this.request('/api/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
  }

  async updateEmployee(id, employeeData) {
    return this.request(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData)
    });
  }

  async deleteEmployee(id) {
    return this.request(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  // Role Management Endpoints
  async getRoles() {
    return this.request('/api/roles');
  }

  async createRole(roleData) {
    return this.request('/api/roles', {
      method: 'POST',
      body: JSON.stringify(roleData)
    });
  }

  async updateRole(id, roleData) {
    return this.request(`/api/roles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(roleData)
    });
  }

  async deleteRole(id) {
    return this.request(`/api/roles/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }

  // Payroll Endpoints
  async getPayrollByMonth(month) {
    return this.request(`/api/payroll?month=${encodeURIComponent(month)}`);
  }

  async getSingleRecord(month, employeeId) {
    return this.request(`/api/payroll/record?month=${encodeURIComponent(month)}&employeeId=${encodeURIComponent(employeeId)}`);
  }

  async saveBatchPayroll(batchData) {
    return this.request('/api/payroll/batch', {
      method: 'POST',
      body: JSON.stringify(batchData)
    });
  }

  async bulkSavePayroll(month, records) {
    return this.saveBatchPayroll({ month, records });
  }

  async getRecordedMonths() {
    return this.request('/api/payroll/months');
  }

  async deletePayrollRecord(month, employeeId) {
    return this.request(`/api/payroll?month=${encodeURIComponent(month)}&employeeId=${encodeURIComponent(employeeId)}`, {
      method: 'DELETE'
    });
  }

  async downloadPayslipPdf(month, employeeId, edits = null) {
    let url = `${this.baseUrl}/api/payroll/slip-pdf`;
    let response;
    if (edits && Object.keys(edits).length > 0) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          employeeId,
          ...edits
        })
      });
    } else {
      url += `?month=${encodeURIComponent(month)}&employeeId=${encodeURIComponent(employeeId)}&force=1`;
      response = await fetch(url);
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Server error: ${response.status} ${response.statusText}`);
    }
    return await response.blob();
  }

  triggerBlobDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

// Automatically configure base URL if opened directly from filesystem (file://) or different dev port
let defaultBaseUrl = '';
if (typeof window !== 'undefined' && window.location) {
  if (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '8080')) {
    defaultBaseUrl = 'http://localhost:8080';
  }
}

// Export singleton instance
window.apiClient = new ApiClient(defaultBaseUrl);

