import React, { useState, useRef } from 'react';
import { 
  UploadCloud, FileText, CheckCircle2, AlertTriangle, 
  X, Loader2, ArrowRight, ShieldCheck, RefreshCw 
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { uploadInvoiceFiles } from '../services/api';

export default function UploadInvoices({ setActivePage, onSelectInvoice }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    validateAndAddFiles(files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    validateAndAddFiles(files);
  };

  const validateAndAddFiles = (newFiles) => {
    setErrorMessage(null);
    const valid = [];
    const errors = [];

    for (const f of newFiles) {
      if (!f.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`${f.name}: Only PDF documents are supported.`);
        continue;
      }
      if (f.size > 15 * 1024 * 1024) {
        errors.push(`${f.name}: Exceeds 15MB limit.`);
        continue;
      }
      if (f.size === 0) {
        errors.push(`${f.name}: File is empty (0 bytes).`);
        continue;
      }
      // Check already selected
      if (selectedFiles.some((item) => item.name === f.name && item.size === f.size)) {
        errors.push(`${f.name}: Already in upload queue.`);
        continue;
      }
      valid.push(f);
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(' '));
    }

    setSelectedFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setErrorMessage(null);

    try {
      const results = await uploadInvoiceFiles(selectedFiles);
      setUploadResults(results);
      setSelectedFiles([]); // clear queue
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during upload and parsing.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Invoices</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Upload PDF bills and receipts. The system automatically reads text via PyMuPDF/OCR, extracts financial fields with AI, validates totals, and flags any discrepancies.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white rounded-2xl p-8 sm:p-12 text-center transition-colors cursor-pointer group"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="text-base font-semibold text-slate-900">
          Drop invoice PDFs here, or <span className="text-blue-600 hover:underline">browse files</span>
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Supports single or multiple PDF invoices up to 15MB each.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            Duplicate Detection
          </span>
          <span className="inline-flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            PyMuPDF + OCR Engine
          </span>
          <span className="inline-flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mr-1" />
            Auto Validation Rules
          </span>
        </div>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Upload Notice</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected Queue */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-900">
              Files Ready for Processing ({selectedFiles.length})
            </h3>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear Queue
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {selectedFiles.map((f, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-slate-800">{f.name}</span>
                  <span className="text-slate-400">({(f.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleUploadSubmit}
              disabled={uploading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing & Extracting with AI...
                </>
              ) : (
                <>
                  Process {selectedFiles.length} Invoice{selectedFiles.length > 1 ? 's' : ''} &rarr;
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Processed Results */}
      {uploadResults.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-emerald-50/70 border-b border-emerald-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-emerald-900">
                Extraction & Validation Complete ({uploadResults.length} Invoices)
              </h3>
            </div>
            <button
              onClick={() => setActivePage('invoices')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
            >
              Go to Management Dashboard &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-3">File Name</th>
                  <th className="px-6 py-3">Extracted Vendor</th>
                  <th className="px-6 py-3">Invoice #</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Validation Status</th>
                  <th className="px-6 py-3 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploadResults.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3 font-medium text-slate-900">{inv.file_name}</td>
                    <td className="px-6 py-3">{inv.vendor_name || <span className="text-amber-600 italic">Missing</span>}</td>
                    <td className="px-6 py-3 font-mono">{inv.invoice_number || <span className="text-amber-600 italic">Missing</span>}</td>
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      {inv.total_amount != null ? `$${inv.total_amount.toFixed(2)}` : <span className="text-amber-600 italic font-normal">Missing</span>}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => {
                          onSelectInvoice(inv.id);
                          setActivePage('review');
                        }}
                        className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium border border-blue-200"
                      >
                        Review Extracted Data
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

