import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function ValidationAlerts({ warnings = [] }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-semibold text-amber-800">
            Validation Issues Detected ({warnings.length})
          </h3>
          <div className="mt-2 text-xs text-amber-700">
            <ul className="list-disc pl-5 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-xs italic text-amber-600">
            Please review the extracted data and apply any necessary corrections before approving.
          </p>
        </div>
      </div>
    </div>
  );
}

