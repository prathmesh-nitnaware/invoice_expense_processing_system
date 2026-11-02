const API_BASE = '/api/v1';

export async function fetchDashboardSummary() {
  const res = await fetch(`${API_BASE}/dashboard/summary`);
  if (!res.ok) throw new Error('Failed to load dashboard metrics');
  return res.json();
}

export async function fetchInvoices({
  page = 1,
  pageSize = 10,
  search = '',
  status = 'ALL',
  vendorName = '',
  startDate = '',
  endDate = '',
  minAmount = '',
  maxAmount = ''
} = {}) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  if (search) params.append('search', search);
  if (status && status !== 'ALL') params.append('status', status);
  if (vendorName) params.append('vendor_name', vendorName);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (minAmount) params.append('min_amount', minAmount);
  if (maxAmount) params.append('max_amount', maxAmount);

  const res = await fetch(`${API_BASE}/invoices?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

export async function fetchInvoiceById(id) {
  const res = await fetch(`${API_BASE}/invoices/${id}`);
  if (!res.ok) throw new Error(`Invoice #${id} not found`);
  return res.json();
}

export async function uploadInvoiceFiles(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  const res = await fetch(`${API_BASE}/invoices/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Upload failed');
  }
  return data;
}

export async function updateInvoiceFields(id, updates) {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to update invoice');
  }
  return res.json();
}

export async function updateInvoiceStatus(id, newStatus, notes = '') {
  const res = await fetch(`${API_BASE}/invoices/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus, notes }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to update status');
  }
  return res.json();
}

export async function reprocessInvoice(id) {
  const res = await fetch(`${API_BASE}/invoices/${id}/reprocess`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Reprocessing failed');
  }
  return res.json();
}

export async function deleteInvoice(id) {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Delete failed');
  }
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export function getInvoiceFileUrl(id) {
  return `${API_BASE}/invoices/${id}/file`;
}

export function getExcelReportUrl({ startDate = '', endDate = '', vendorName = '', approvedOnly = true } = {}) {
  const params = new URLSearchParams({
    approved_only: String(approvedOnly)
  });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (vendorName) params.append('vendor_name', vendorName);
  return `${API_BASE}/reports/export?${params.toString()}`;
}

