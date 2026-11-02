import React from 'react';
import { LayoutDashboard, UploadCloud, FolderKanban, BarChart3, Settings } from 'lucide-react';

export default function Sidebar({ activePage, setActivePage }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Invoices', icon: UploadCloud },
    { id: 'invoices', label: 'Invoice Management', icon: FolderKanban },
    { id: 'reports', label: 'Expense Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings & Status', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        <div className="px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Main Menu</p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 mr-3 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60">
        <p className="text-xs font-medium text-slate-300">Invoice Engine v1.0</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Automated AI extraction & validation pipeline</p>
      </div>
    </aside>
  );
}

