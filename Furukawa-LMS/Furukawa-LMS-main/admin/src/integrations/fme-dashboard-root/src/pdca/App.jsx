import React, { useEffect } from 'react';
import { HashRouter as BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PDCAProvider } from './context/PDCAContext';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import PDCASheetPage from './pages/PDCASheetPage';

function CmsRouteSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.parent.postMessage({ type: 'fme-cms-route', page: 'pdca', hash: `#${pathname}` }, window.location.origin);
  }, [pathname]);
  return null;
}

export default function App({ onFormViewChange }) {
  return (
    <BrowserRouter>
      <CmsRouteSync />
      <PDCAProvider>
        <Routes>
          <Route path="/" element={<MainLayout embedded cmsIntegration onFormViewChange={onFormViewChange} />}>
            <Route index element={<DashboardPage />} />
            <Route path="sheet" element={<PDCASheetPage />} />
            <Route path="sheet/:id" element={<PDCASheetPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </PDCAProvider>
    </BrowserRouter>
  );
}
