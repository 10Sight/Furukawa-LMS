import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import { usePDCA } from '../context/PDCAContext';

export default function MainLayout({ embedded = false, cmsIntegration = false, onFormViewChange }) {
  // Mobile (< 768px) is collapsed by default; desktop (>= 768px) is open by default
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const { toastMessage, data } = usePDCA();
  const navigate = useNavigate();
  const location = useLocation();

  // If on /sheet/:id or has activeSheetTopic
  const isSheetPage = location.pathname.startsWith('/sheet');

  React.useEffect(() => {
    onFormViewChange?.(isSheetPage);
  }, [isSheetPage, onFormViewChange]);

  const handleExportExcelAll = () => {
    const rows = ['S.No,ID,Topic,Description,Date,Time,Created By,Emp Code,Plant,Department']
      .concat(
        data.map((r, i) =>
          `${i + 1},"${r.id}","${r.topic}","${r.description}","${r.date}","${r.time}","${r.createdBy?.name || ''}","${r.createdBy?.code || ''}","${r.plant}","${r.department || ''}"`
        )
      )
      .join('\n');

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(rows);
    link.download = `PDCA_Export_All.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex overflow-x-hidden w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
          {toastMessage}
        </div>
      )}

      {/* Left Sidebar (hidden when viewing the PDCA sheet) */}
      {!embedded && !isSheetPage && (
        <Sidebar 
          collapsed={sidebarCollapsed} 
          setCollapsed={setSidebarCollapsed} 
        />
      )}

      {/* Main Content Area: adjusts margin to match sidebar on both mobile and desktop (0 margin on sheet page) */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ${
          embedded || isSheetPage ? 'ml-0' : (sidebarCollapsed ? 'ml-20' : 'ml-64')
        }`}
      >
        {/* Top Navbar (hidden on PDCA sheet page) */}
        {!cmsIntegration && !isSheetPage && (
          <TopHeader
            collapsed={sidebarCollapsed}
            onExport={handleExportExcelAll}
            activeSheetTopic={isSheetPage}
            onBackToPDCA={() => navigate('/')}
          />
        )}

        <main className={`flex-1 w-full min-w-0 mx-auto overflow-x-hidden ${
          isSheetPage ? 'p-2 sm:p-3 max-w-full' : 'p-3 sm:p-4 md:p-6 space-y-5 max-w-[1280px]'
        }`}>
          {cmsIntegration && !isSheetPage && (
            <div className="flex justify-end">
              <button type="button" onClick={handleExportExcelAll} title="Download PDCA Report" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Export All Records
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
