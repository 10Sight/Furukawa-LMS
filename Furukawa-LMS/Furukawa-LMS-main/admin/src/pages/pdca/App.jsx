import React, { useEffect } from 'react';
import { MemoryRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PDCAProvider } from './context/PDCAContext';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import PDCASheetPage from './pages/PDCASheetPage';

class PDCAErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('PDCA could not render', error); }
  render() {
    if (this.state.failed) return (
      <div role="alert" className="p-6 text-sm text-slate-700">
        <p>PDCA could not load. Your saved records have not been deleted.</p>
        <button type="button" className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white" onClick={() => window.location.reload()}>Reload PDCA</button>
      </div>
    );
    return this.props.children;
  }
}

export default function App({ onFormViewChange }) {
  return (
    <PDCAErrorBoundary>
    <PDCAProvider>
    <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout embedded cmsIntegration onFormViewChange={onFormViewChange} />}>
            <Route index element={<DashboardPage />} />
            <Route path="sheet" element={<PDCASheetPage />} />
            <Route path="sheet/:id" element={<PDCASheetPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
    </BrowserRouter>
    </PDCAProvider>
    </PDCAErrorBoundary>
  );
}
