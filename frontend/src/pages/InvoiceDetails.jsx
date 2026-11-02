import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, FileText, Calendar, Clock, 
  ExternalLink, CheckCircle2, History, UserCheck, Shield 
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { fetchInvoiceById, getInvoiceFileUrl } from '../services/api';

export default function InvoiceDetails({ invoiceId, setActivePage }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    fetchInvoiceById(invoiceId)
      .then(setInvoice)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        Loading invoice history & audit trail...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-sm">Invoice not found.</p>
        <button
          onClick={() => setActivePage('invoices')}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs"
        >
          &larr; Return to Invoices
        </button>
      </div>
    );
  }

  const rawAi = invoice.extracted_data || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
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
                Invoice Details & Audit Log #{invoice.id}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Original Document: <strong className="text-slate-700">{invoice.file_name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={getInvoiceFileUrl(invoice.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-500" />
            View Document
          </a>
          <button
            onClick={() => setActivePage('review')}
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
          >
            Review & Edit
          </button>
        </div>
      </div>

      {/* Comparison: AI-Extracted vs Current Active/Corrected Values */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Extraction vs. Verified Values</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Preserved snapshot of original document extraction contrasted with current human-verified values.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 border-b">Field</th>
                <th className="px-4 py-3 border-b">Original AI Extracted</th>
                <th className="px-4 py-3 border-b">Current Verified Value</th>
                <th className="px-4 py-3 border-b text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { label: 'Vendor Name', key: 'vendor_name' },
                { label: 'Invoice Number', key: 'invoice_number' },
                { label: 'Invoice Date', key: 'invoice_date' },
                { label: 'Due Date', key: 'due_date' },
                { label: 'Customer Name', key: 'customer_name' },
                { label: 'Subtotal', key: 'subtotal', isMoney: true },
                { label: 'Tax Amount', key: 'tax_amount', isMoney: true },
                { label: 'Total Amount', key: 'total_amount', isMoney: true },
                { label: 'Currency', key: 'currency' },
                { label: 'Payment Status', key: 'payment_status' },
              ].map(({ label, key, isMoney }) => {
                const aiVal = rawAi[key];
                const activeVal = invoice[key];
                const isDifferent = (invoice.corrected_fields || []).includes(key);

                const formatVal = (v) => {
                  if (v == null || v === '') return <span className="text-slate-400 italic">None</span>;
                  if (isMoney) return `$${Number(v).toFixed(2)}`;
                  return String(v);
                };

                return (
                  <tr key={key} className={isDifferent ? 'bg-amber-50/30' : ''}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{label}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono">{formatVal(aiVal)}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 font-mono">
                      {formatVal(activeVal)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isDifferent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                          Manually Corrected
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          Original
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata & Timestamps Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
          <p className="font-semibold text-slate-800 flex items-center">
            <Clock className="w-4 h-4 mr-1 text-blue-600" />
            Timestamps
          </p>
          <div className="space-y-1 text-slate-600">
            <p>Uploaded: {invoice.created_at ? new Date(invoice.created_at).toLocaleString() : 'N/A'}</p>
            <p>Processed: {invoice.processed_at ? new Date(invoice.processed_at).toLocaleString() : 'N/A'}</p>
            <p>Approved: {invoice.approved_at ? new Date(invoice.approved_at).toLocaleString() : 'Not yet approved'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
          <p className="font-semibold text-slate-800 flex items-center">
            <Shield className="w-4 h-4 mr-1 text-emerald-600" />
            Security & Integrity
          </p>
          <div className="space-y-1 text-slate-600 font-mono text-[11px]">
            <p className="truncate" title={invoice.file_hash}>
              SHA-256: {invoice.file_hash ? invoice.file_hash.substring(0, 16) + '...' : 'N/A'}
            </p>
            <p>Size: {invoice.file_size} bytes</p>
            <p>OCR Used: {invoice.ocr_applied ? 'Yes' : 'No'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2 text-xs">
          <p className="font-semibold text-slate-800 flex items-center">
            <UserCheck className="w-4 h-4 mr-1 text-indigo-600" />
            Verification State
          </p>
          <div className="space-y-1 text-slate-600">
            <p>Status: <strong className="text-slate-900">{invoice.status}</strong></p>
            <p>AI Confidence: {Math.round((invoice.confidence_score || 0.7) * 100)}%</p>
            <p>Valid: {invoice.is_valid ? 'Passes all rules' : 'Has warnings'}</p>
          </div>
        </div>
      </div>

      {/* Chronological Audit Logs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Audit History Log</h2>
        </div>

        {invoice.audit_logs && invoice.audit_logs.length > 0 ? (
          <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
            {invoice.audit_logs.map((log) => (
              <div key={log.id} className="relative">
                {/* Bullet */}
                <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white" />
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.action}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-500 font-medium">By {log.performed_by}</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  {log.details && (
                    <div className="bg-slate-50 p-2.5 rounded-md font-mono text-[11px] text-slate-700 overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No audit records recorded yet.</p>
        )}
      </div>
    </div>
  );
}

