import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Cpu, Eye, ShieldCheck, 
  Database, HardDrive, RefreshCw, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { fetchSettings } from '../services/api';

export default function Settings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSettings = () => {
    setLoading(true);
    fetchSettings()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
        Loading system environment & configuration...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl max-w-xl mx-auto my-8">
        <h3 className="font-semibold text-lg">Failed to retrieve settings</h3>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={loadSettings}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings & Status</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Verify connected AI engines, OCR rasterization services, database drivers, and active validation tolerances.
        </p>
      </div>

      {/* AI Extraction Engine Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">AI Extraction Engine</h2>
              <p className="text-xs text-slate-500">Google Gemini API integration</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
              data.ai_engine.gemini_configured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {data.ai_engine.status_label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-slate-500 font-medium">Configured Gemini Model</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{data.ai_engine.gemini_model}</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-slate-500 font-medium">Security Safeguard</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">API Key Kept Securely on Server</p>
          </div>
        </div>

        {!data.ai_engine.gemini_configured && (
          <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-lg text-xs text-blue-800 space-y-1">
            <p className="font-semibold flex items-center">
              <AlertCircle className="w-4 h-4 mr-1.5 text-blue-600" />
              Demo Mode Information
            </p>
            <p>
              When <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">GEMINI_API_KEY</code> is not provided in environment variables, the system executes a deterministic rule-based parsing engine. To activate live Gemini LLM extraction, add your key to <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">.env</code> or Docker environment.
            </p>
          </div>
        )}
      </div>

      {/* Document Ingestion & OCR */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">PDF & Scanned Document Pipeline</h2>
              <p className="text-xs text-slate-500">PyMuPDF text extraction with Tesseract OCR fallback</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
              data.ocr_engine.tesseract_available
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {data.ocr_engine.status_label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-slate-500 font-medium">Primary Text Engine</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">PyMuPDF (fitz) v2.0</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-slate-500 font-medium">OCR Rasterization</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {data.ocr_engine.tesseract_available ? 'Available' : 'Fallback Mode'}
            </p>
          </div>
        </div>
      </div>

      {/* Validation Rules & Tolerances */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Validation Rules Engine</h2>
            <p className="text-xs text-slate-500">Business rules for flagging financial anomalies</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-slate-500 font-medium">Arithmetic Tolerance</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">&plusmn;${data.validation_rules.total_tolerance.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-slate-500 font-medium">Max Upload Size</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{data.validation_rules.max_upload_size_mb} MB</p>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <p className="text-slate-500 font-medium">Allowed Formats</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{data.validation_rules.allowed_extensions.join(', ')}</p>
          </div>
        </div>
      </div>

      {/* Database Connection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Database Connection</h2>
            <p className="text-xs text-slate-500">Relational storage driver</p>
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
          <p className="text-slate-500 font-medium">Active Database Driver</p>
          <p className="text-sm font-bold text-slate-900 mt-0.5">{data.database.driver}</p>
        </div>
      </div>
    </div>
  );
}

