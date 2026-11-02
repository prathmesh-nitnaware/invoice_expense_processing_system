import React, { useEffect, useState } from 'react';
import { 
  FileText, CheckCircle2, Clock, AlertTriangle, 
  DollarSign, ArrowUpRight, TrendingUp, RefreshCw, UploadCloud 
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { fetchDashboardSummary } from '../services/api';

export default function Dashboard({ setActivePage, onSelectInvoice }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchDashboardSummary()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500">Loading financial dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl max-w-xl mx-auto my-8">
        <h3 className="font-semibold text-lg">Unable to load dashboard</h3>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time oversight of invoice processing, AI extraction, and validated expenses.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Refresh
          </button>
          <button
            onClick={() => setActivePage('upload')}
            className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
          >
            <UploadCloud className="w-4 h-4 mr-1.5" />
            Upload Invoices
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Invoices"
          value={data.total_invoices_processed}
          subtext="Processed by system"
          icon={FileText}
          color="slate"
        />
        <MetricCard
          title="Approved Expenses"
          value={`$${(data.total_approved_expenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtext="Confirmed financial outflow"
          icon={CheckCircle2}
          color="emerald"
        />
        <MetricCard
          title="Pending Review"
          value={data.pending_review_count}
          subtext="Awaiting human confirmation"
          icon={Clock}
          color="blue"
        />
        <MetricCard
          title="Flagged for Issues"
          value={data.flagged_count}
          subtext="Mismatches or missing fields"
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Charts & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Expenditure Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Monthly Expenditure Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">Aggregated invoice totals by billing month</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
              Total: ${(data.total_expenditure || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {data.monthly_expenditure && data.monthly_expenditure.length > 0 ? (
            <div className="space-y-4">
              {data.monthly_expenditure.map((item) => {
                const maxAmount = Math.max(...data.monthly_expenditure.map((m) => m.amount), 1);
                const percent = Math.min(Math.round((item.amount / maxAmount) * 100), 100);
                return (
                  <div key={item.month} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{item.month} ({item.count} invoices)</span>
                      <span className="font-semibold text-slate-900">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              No historical monthly data recorded yet. Upload invoice PDFs to generate trends.
            </div>
          )}
        </div>

        {/* Vendor Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">Top Vendor Expenditure</h2>
            <p className="text-xs text-slate-500 mb-5">Highest volume supplier accounts</p>

            {data.vendor_expenditure && data.vendor_expenditure.length > 0 ? (
              <div className="space-y-3.5">
                {data.vendor_expenditure.slice(0, 5).map((v) => (
                  <div key={v.vendor_name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate max-w-[150px]" title={v.vendor_name}>
                        {v.vendor_name}
                      </span>
                      <span className="font-semibold text-slate-900">
                        ${v.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${v.percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 w-8 text-right">{v.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                No vendors recorded yet.
              </div>
            )}
          </div>

          <button
            onClick={() => setActivePage('reports')}
            className="mt-6 w-full py-2 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 text-center"
          >
            View Full Expense Reports &rarr;
          </button>
        </div>
      </div>

      {/* Recent Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Invoices</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest documents parsed through the AI pipeline</p>
          </div>
          <button
            onClick={() => setActivePage('invoices')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            View All ({data.total_invoices_processed}) &rarr;
          </button>
        </div>

        {data.recent_invoices && data.recent_invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-6 py-3">Vendor</th>
                  <th className="px-6 py-3">Invoice #</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.recent_invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 truncate max-w-xs">
                      {inv.vendor_name}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-700">
                      {inv.invoice_number}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {inv.invoice_date || 'N/A'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-900">
                      {inv.total_amount != null
                        ? `$${inv.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : <span className="text-amber-600 italic font-normal text-xs">Missing</span>}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => {
                          onSelectInvoice(inv.id);
                          setActivePage('review');
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200"
                      >
                        Review &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-sm">
            No invoices processed yet. Click "+ Upload Invoices" to get started!
          </div>
        )}
      </div>
    </div>
  );
}

