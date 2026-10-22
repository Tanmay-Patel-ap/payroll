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

  async deleteEmployee(id) {
    return this.request(`/api/employees/${encodeURIComponent(id)}`, {
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

  async saveSinglePayroll(recordData) {
    return this.request('/api/payroll/single', {
      method: 'POST',
      body: JSON.stringify(recordData)
    });
  }

  async saveBatchPayroll(batchData) {
    return this.request('/api/payroll/batch', {
      method: 'POST',
      body: JSON.stringify(batchData)
    });
  }

  async getRecordedMonths() {
    return this.request('/api/payroll/months');
  }

  async deletePayrollRecord(month, employeeId) {
    return this.request(`/api/payroll?month=${encodeURIComponent(month)}&employeeId=${encodeURIComponent(employeeId)}`, {
      method: 'DELETE'
    });
  }
}

// Export singleton instance
window.apiClient = new ApiClient();

