import React, { useEffect, useState } from 'react';
import { FileText, Cpu, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchSettings } from '../services/api';

export default function Navbar({ activePage, setActivePage }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((e) => console.debug('Settings status fetch notice:', e.message));
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActivePage('dashboard')}>
            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-sm flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">AutoInvoice AI</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                Expense Automation
              </span>
            </div>
          </div>

          {/* Engine Status Indicators & Actions */}
          <div className="flex items-center space-x-4">
            {settings && (
              <div className="hidden md:flex items-center space-x-2 text-xs">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${
                    settings.ai_engine.gemini_configured
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                  title={settings.ai_engine.status_label}
                >
                  <Cpu className="w-3.5 h-3.5 mr-1" />
                  {settings.ai_engine.gemini_configured ? 'Gemini Live' : 'Demo Extraction Mode'}
                </span>

                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${
                    settings.ocr_engine.tesseract_available
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                  title={settings.ocr_engine.status_label}
                >
                  OCR: {settings.ocr_engine.tesseract_available ? 'Ready' : 'PyMuPDF Native'}
                </span>
              </div>
            )}

            <button
              onClick={() => setActivePage('upload')}
              className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
            >
              + Upload Invoices
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

