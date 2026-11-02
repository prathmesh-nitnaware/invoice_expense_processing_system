import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, 
  Save, RefreshCw, FileText, ExternalLink, ShieldCheck, Check, Sparkles 
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ValidationAlerts from '../components/ValidationAlerts';
import { 
  fetchInvoiceById, updateInvoiceFields, 
  updateInvoiceStatus, reprocessInvoice, getInvoiceFileUrl 
} from '../services/api';

export default function InvoiceReview({ invoiceId, setActivePage }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);

  const loadInvoice = () => {
    if (!invoiceId) return;
    setLoading(true);
    fetchInvoiceById(invoiceId)
      .then((data) => {
        setInvoice(data);
        setFormData({
          vendor_name: data.vendor_name || '',
          invoice_number: data.invoice_number || '',
          invoice_date: data.invoice_date || '',
          due_date: data.due_date || '',
          customer_name: data.customer_name || '',
          subtotal: data.subtotal != null ? String(data.subtotal) : '',
          tax_amount: data.tax_amount != null ? String(data.tax_amount) : '',
          tax_percentage: data.tax_percentage != null ? String(data.tax_percentage) : '',
          total_amount: data.total_amount != null ? String(data.total_amount) : '',
          currency: data.currency || 'USD',
          payment_status: data.payment_status || 'PENDING',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveCorrections = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        vendor_name: formData.vendor_name || null,
        invoice_number: formData.invoice_number || null,
        invoice_date: formData.invoice_date || null,
        due_date: formData.due_date || null,
        customer_name: formData.customer_name || null,
        subtotal: formData.subtotal !== '' ? parseFloat(formData.subtotal) : null,
        tax_amount: formData.tax_amount !== '' ? parseFloat(formData.tax_amount) : null,
        tax_percentage: formData.tax_percentage !== '' ? parseFloat(formData.tax_percentage) : null,
        total_amount: formData.total_amount !== '' ? parseFloat(formData.total_amount) : null,
        currency: formData.currency || 'USD',
        payment_status: formData.payment_status || 'PENDING',
      };

      const updated = await updateInvoiceFields(invoice.id, payload);
      setInvoice(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save corrections');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Confirm marking this invoice as ${newStatus}?`)) return;
    setSaving(true);
    try {
      const updated = await updateInvoiceStatus(invoice.id, newStatus, approvalNotes);
      setInvoice(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReprocess = async () => {
    if (!window.confirm('Reprocess this document through the OCR/AI extraction engine?')) return;
    setSaving(true);
    try {
      const updated = await reprocessInvoice(invoice.id);
      setInvoice(updated);
      setSaveSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto text-blue-600 animate-spin mb-3" />
        <p className="text-sm">Loading invoice extraction & validation details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-slate-500 text-sm">No invoice selected.</p>
        <button
          onClick={() => setActivePage('invoices')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
        >
          &larr; Return to Invoices
        </button>
      </div>
    );
  }

  const isFieldCorrected = (fieldName) => {
    return (invoice.corrected_fields || []).includes(fieldName);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActivePage('invoices')}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">
                Invoice Review #{invoice.id}
              </h1>
              <StatusBadge status={invoice.status} />
              {invoice.is_corrected && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  User Corrected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              File: <strong className="text-slate-700">{invoice.file_name}</strong> &bull; Size: {(invoice.file_size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={getInvoiceFileUrl(invoice.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Open PDF
          </a>

          <button
            onClick={handleReprocess}
            disabled={saving}
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Reprocess
          </button>

          {invoice.status !== 'REJECTED' && (
            <button
              onClick={() => handleStatusChange('REJECTED')}
              disabled={saving}
              className="inline-flex items-center px-3 py-1.5 border border-rose-200 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Reject
            </button>
          )}

          {invoice.status !== 'APPROVED' && (
            <button
              onClick={() => handleStatusChange('APPROVED')}
              disabled={saving}
              className="inline-flex items-center px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Approve Invoice
            </button>
          )}
        </div>
      </div>

      {/* Validation Issues Banner */}
      <ValidationAlerts warnings={invoice.validation_warnings} />

      {/* Save Success Alert */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          Changes and verification status saved successfully.
        </div>
      )}

      {/* Main Review Form & Raw Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Editable Financial Data Form */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Extracted Financial Fields</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify values extracted by AI. Fields with <span className="text-amber-600 font-medium">*edited*</span> highlight user modifications.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">AI Confidence</span>
              <span className="text-xs font-bold text-slate-800">
                {Math.round((invoice.confidence_score || 0.7) * 100)}%
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveCorrections} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vendor Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Vendor Name *</span>
                  {isFieldCorrected('vendor_name') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={formData.vendor_name}
                  onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isFieldCorrected('vendor_name') ? 'border-amber-300 bg-amber-50/20' : 'border-slate-300'
                  }`}
                  placeholder="e.g. Acme Corporation"
                />
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Invoice Number *</span>
                  {isFieldCorrected('invoice_number') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={formData.invoice_number}
                  onChange={(e) => handleInputChange('invoice_number', e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isFieldCorrected('invoice_number') ? 'border-amber-300 bg-amber-50/20' : 'border-slate-300'
                  }`}
                  placeholder="e.g. INV-2026-001"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Invoice Date *</span>
                  {isFieldCorrected('invoice_date') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isFieldCorrected('invoice_date') ? 'border-amber-300 bg-amber-50/20' : 'border-slate-300'
                  }`}
                  placeholder="YYYY-MM-DD"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Due Date</span>
                  {isFieldCorrected('due_date') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    isFieldCorrected('due_date') ? 'border-amber-300 bg-amber-50/20' : 'border-slate-300'
                  }`}
                  placeholder="YYYY-MM-DD"
                />
              </div>

              {/* Customer / Client */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Customer / Billed Business</span>
                  {isFieldCorrected('customer_name') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => handleInputChange('customer_name', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Your Company Name"
                />
              </div>

              {/* Subtotal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Subtotal Amount</span>
                  {isFieldCorrected('subtotal') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.subtotal}
                  onChange={(e) => handleInputChange('subtotal', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  placeholder="0.00"
                />
              </div>

              {/* Tax Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Tax Amount</span>
                  {isFieldCorrected('tax_amount') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.tax_amount}
                  onChange={(e) => handleInputChange('tax_amount', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  placeholder="0.00"
                />
              </div>

              {/* Total Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="text-blue-700">Total Invoice Amount *</span>
                  {isFieldCorrected('total_amount') && (
                    <span className="text-[10px] text-amber-600 font-normal">Edited</span>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.total_amount}
                  onChange={(e) => handleInputChange('total_amount', e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-blue-400 bg-blue-50/30 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                  placeholder="0.00"
                />
              </div>

              {/* Currency & Payment Status */}
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleInputChange('currency', e.target.value)}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>
                <div className="w-1/2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => handleInputChange('payment_status', e.target.value)}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                    <option value="OVERDUE">OVERDUE</option>
                    <option value="DUE">DUE</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 flex justify-between items-center border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Saving corrections automatically recalculates validation rules.
              </span>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saving ? 'Saving...' : 'Save & Validate Changes'}
              </button>
            </div>
          </form>

          {/* Optional Reviewer Notes */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reviewer Notes (Recorded in Audit Trail)
            </label>
            <input
              type="text"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="e.g. Verified with purchase order #PO-4481"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Right: Original Extraction Text & Raw Metadata Inspector */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-blue-600" />
                Original Extracted Document Text
              </h3>
              {invoice.ocr_applied && (
                <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium border border-purple-200">
                  OCR Applied
                </span>
              )}
            </div>

            <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg font-mono text-[11px] max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
              {invoice.raw_text || 'No text extracted from document.'}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Original digital text extracted via PyMuPDF (fitz) or Tesseract OCR fallback.
            </p>
          </div>

          {/* Quick link to Audit Details */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs flex justify-between items-center">
            <div>
              <p className="font-semibold text-slate-800">Need full audit logs?</p>
              <p className="text-slate-500 mt-0.5">View complete field-by-field modification history.</p>
            </div>
            <button
              onClick={() => setActivePage('details')}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100 shadow-sm"
            >
              Audit History &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

