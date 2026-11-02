import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, ChevronLeft, ChevronRight, FileText, 
  ExternalLink, Eye, RefreshCw, Trash2, Download, AlertTriangle 
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { fetchInvoices, deleteInvoice, reprocessInvoice, getInvoiceFileUrl } from '../services/api';

export default function InvoiceManagement({ setActivePage, onSelectInvoice }) {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const loadInvoices = () => {
    setLoading(true);
    fetchInvoices({
      page,
      pageSize,
      search: searchTerm,
      status: statusFilter,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    })
      .then((res) => {
        setInvoices(res.items);
        setTotal(res.total);
        setTotalPages(res.total_pages);
      })
      .catch((err) => console.error('Failed to fetch invoices:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoices();
  }, [page, pageSize, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadInvoices();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setPage(1);
    setTimeout(loadInvoices, 50);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete invoice record #${id} (${name})?`)) return;
    try {
      await deleteInvoice(id);
      loadInvoices();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleReprocess = async (id) => {
    try {
      await reprocessInvoice(id);
      loadInvoices();
    } catch (e) {
      alert(`Reprocessing failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoice Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Search, filter, inspect, and manage invoice documents across all verification statuses.
          </p>
        </div>
        <button
          onClick={() => setActivePage('upload')}
          className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
        >
          + Upload Invoices
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Keyword Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search vendor, invoice #, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="FLAGGED">Flagged for Issues</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Date from/to */}
          <div className="flex gap-1.5">
            <input
              type="date"
              title="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 py-2 px-2 text-[11px] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="date"
              title="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 py-2 px-2 text-[11px] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Amount Min/Max */}
          <div className="flex gap-1.5">
            <input
              type="number"
              placeholder="Min $"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-1/2 py-2 px-2 text-[11px] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Max $"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-1/2 py-2 px-2 text-[11px] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </form>

        <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>Found <strong>{total}</strong> invoice{total === 1 ? '' : 's'} matching filter</span>
          <div className="flex gap-2">
            <button
              onClick={handleResetFilters}
              className="text-slate-500 hover:text-slate-700 underline"
            >
              Reset Filters
            </button>
            <button
              onClick={handleSearchSubmit}
              className="px-3 py-1 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-blue-600" />
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            No invoices match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Vendor</th>
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Invoice Date</th>
                  <th className="px-5 py-3 text-right">Total Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-center">Corrected</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3 text-slate-400 font-mono">#{inv.id}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900 truncate max-w-[180px]">
                      {inv.vendor_name || <span className="text-amber-600 italic font-normal">Missing</span>}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-700">
                      {inv.invoice_number || <span className="text-amber-600 italic font-normal">Missing</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{inv.invoice_date || 'N/A'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">
                      {inv.total_amount != null ? (
                        `$${inv.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : (
                        <span className="text-amber-600 italic font-normal">Missing</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      {inv.is_corrected ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Edited
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right space-x-1.5">
                      <button
                        title="Review / Edit"
                        onClick={() => {
                          onSelectInvoice(inv.id);
                          setActivePage('review');
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                      >
                        Review
                      </button>
                      <button
                        title="Audit & Full Details"
                        onClick={() => {
                          onSelectInvoice(inv.id);
                          setActivePage('details');
                        }}
                        className="px-2 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                      >
                        Details
                      </button>
                      <button
                        title="Reprocess Document"
                        onClick={() => handleReprocess(inv.id)}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete Invoice"
                        onClick={() => handleDelete(inv.id, inv.vendor_name || inv.file_name)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>per page</span>
          </div>

          <div className="flex items-center space-x-2">
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

