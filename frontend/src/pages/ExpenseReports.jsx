import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Download, Filter, Calendar, 
  Building2, CheckCircle2, RefreshCw, BarChart2 
} from 'lucide-react';
import { getExcelReportUrl, fetchInvoices } from '../services/api';

export default function ExpenseReports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [approvedOnly, setApprovedOnly] = useState(true);

  // Live preview metrics
  const [previewData, setPreviewData] = useState({
    count: 0,
    total: 0,
    subtotal: 0,
    tax: 0,
  });
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadPreview = () => {
    setLoadingPreview(true);
    fetchInvoices({
      pageSize: 100,
      status: approvedOnly ? 'APPROVED' : 'ALL',
      vendorName,
      startDate,
      endDate,
    })
      .then((res) => {
        const items = res.items || [];
        const count = items.length;
        const total = items.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
        const subtotal = items.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
        const tax = items.reduce((acc, curr) => acc + (curr.tax_amount || 0), 0);
        setPreviewData({ count, total, subtotal, tax });
      })
      .catch((err) => console.error('Failed to load preview:', err))
      .finally(() => setLoadingPreview(false));
  };

  useEffect(() => {
    loadPreview();
  }, [startDate, endDate, vendorName, approvedOnly]);

  const downloadUrl = getExcelReportUrl({
    startDate,
    endDate,
    vendorName,
    approvedOnly,
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expense Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Generate and download formatted multi-sheet Excel reports with executive summaries, vendor breakdowns, and itemized registers.
        </p>
      </div>

      {/* Filter and Export Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-900">Configure Report Scope</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Vendor Filter */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Filter by Specific Vendor Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. AWS, Adobe, Office Supplies Ltd..."
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Approved Only Toggle */}
          <div className="sm:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900">Include Approved Invoices Only</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Exclude draft, pending review, or flagged invoices from final accounting reporting.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={approvedOnly}
                onChange={(e) => setApprovedOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Live Scope Preview */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Live Report Preview
            </p>
            {loadingPreview && <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <p className="text-[11px] text-slate-500">Invoices Included</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{previewData.count}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <p className="text-[11px] text-slate-500">Net Subtotal</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">${previewData.subtotal.toFixed(2)}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <p className="text-[11px] text-slate-500">Captured Tax</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">${previewData.tax.toFixed(2)}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <p className="text-[11px] text-slate-500">Gross Expenditure</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">${previewData.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Download Action */}
        <div className="pt-2 flex justify-end">
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Excel Spreadsheet (.xlsx)
          </a>
        </div>
      </div>

      {/* Excel Structure Information */}
      <div className="bg-blue-50/50 border border-blue-200 p-4 rounded-xl text-xs text-blue-900 space-y-1.5">
        <p className="font-semibold flex items-center">
          <FileSpreadsheet className="w-4 h-4 mr-1.5 text-blue-600" />
          Included Workbook Sheets
        </p>
        <ul className="list-disc pl-5 space-y-0.5 text-blue-800">
          <li><strong>Sheet 1: Executive Summary</strong> &mdash; KPI cards, date boundaries, and top vendor percentage breakdowns.</li>
          <li><strong>Sheet 2: Detailed Invoices</strong> &mdash; Complete itemized audit register with formatted currency cells and status indicators.</li>
        </ul>
      </div>
    </div>
  );
}

