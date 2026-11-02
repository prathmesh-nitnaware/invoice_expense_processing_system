import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, XCircle } from 'lucide-react';

export default function StatusBadge({ status, className = '' }) {
  const s = (status || '').toUpperCase();

  let bg = 'bg-slate-100 text-slate-700 border-slate-200';
  let icon = <Clock className="w-3.5 h-3.5 mr-1" />;
  let label = s;

  if (s === 'APPROVED') {
    bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    icon = <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />;
    label = 'Approved';
  } else if (s === 'FLAGGED') {
    bg = 'bg-amber-50 text-amber-700 border-amber-200';
    icon = <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />;
    label = 'Flagged';
  } else if (s === 'PENDING_REVIEW') {
    bg = 'bg-blue-50 text-blue-700 border-blue-200';
    icon = <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />;
    label = 'Pending Review';
  } else if (s === 'REJECTED') {
    bg = 'bg-rose-50 text-rose-700 border-rose-200';
    icon = <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />;
    label = 'Rejected';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bg} ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

