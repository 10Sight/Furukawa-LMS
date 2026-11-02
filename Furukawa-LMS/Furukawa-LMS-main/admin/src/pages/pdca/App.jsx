import React, { useEffect, useMemo } from 'react';
import { MemoryRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PDCAProvider } from './context/PDCAContext';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import PDCASheetPage from './pages/PDCASheetPage';

class PDCAErrorBoundary extends React.Component {
  state = { failed: false, error: null };
  static getDerivedStateFromError(error) { return { failed: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('PDCA could not render', error, errorInfo); }
  render() {
    if (this.state.failed) return (
      <div role="alert" className="p-6 text-sm text-slate-700">
        <p className="font-semibold text-rose-600">PDCA could not load. Your saved records have not been deleted.</p>
        {this.state.error && (
          <pre className="mt-2 p-3 bg-slate-100 rounded text-xs text-rose-800 overflow-auto max-h-60 whitespace-pre-wrap">
            {this.state.error.message || String(this.state.error)}
            {'\n'}
            {this.state.error.stack}
          </pre>
        )}
        <button type="button" className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white" onClick={() => window.location.reload()}>Reload PDCA</button>
      </div>
    );
    return this.props.children;
  }
}

export default function App({ onFormViewChange }) {
  const initialEntries = useMemo(() => {
    try {
      const sp = new URLSearchParams(window.location.search).get('sheet');
      if (sp) return [`/sheet/${encodeURIComponent(decodeURIComponent(sp))}`];
      const h = window.location.hash;
      if (h && h.startsWith('#/sheet/')) {
        return [h.replace(/^#/, '')];
      }
    } catch { /* ignore */ }
    return ['/'];
  }, []);

  return (
    <PDCAErrorBoundary>
    <PDCAProvider>
    <BrowserRouter initialEntries={initialEntries}>
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
