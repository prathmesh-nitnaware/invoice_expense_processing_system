import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import UploadInvoices from './pages/UploadInvoices';
import InvoiceManagement from './pages/InvoiceManagement';
import InvoiceReview from './pages/InvoiceReview';
import InvoiceDetails from './pages/InvoiceDetails';
import ExpenseReports from './pages/ExpenseReports';
import Settings from './pages/Settings';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setActivePage={setActivePage} onSelectInvoice={setSelectedInvoiceId} />;
      case 'upload':
        return <UploadInvoices setActivePage={setActivePage} onSelectInvoice={setSelectedInvoiceId} />;
      case 'invoices':
        return <InvoiceManagement setActivePage={setActivePage} onSelectInvoice={setSelectedInvoiceId} />;
      case 'review':
        return <InvoiceReview invoiceId={selectedInvoiceId} setActivePage={setActivePage} />;
      case 'details':
        return <InvoiceDetails invoiceId={selectedInvoiceId} setActivePage={setActivePage} />;
      case 'reports':
        return <ExpenseReports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard setActivePage={setActivePage} onSelectInvoice={setSelectedInvoiceId} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      {/* Top Navigation */}
      <Navbar activePage={activePage} setActivePage={setActivePage} />

      {/* Main Container with Sidebar */}
      <div className="flex flex-1">
        <Sidebar activePage={activePage} setActivePage={setActivePage} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

