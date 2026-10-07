import React from 'react';
import { 
  Home, 
  ChevronRight, 
  Download, 
  Settings, 
  Bell
} from 'lucide-react';

export default function TopHeader({ collapsed, onExport, activeSheetTopic, onBackToPDCA }) {
  return (
    <header className="h-16 w-full min-w-0 bg-white border-b border-[#E9ECEF] flex items-center justify-between px-3 md:px-6 sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1 sm:gap-2 text-sm min-w-0 mr-2">
        <button 
          onClick={onBackToPDCA}
          className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0 p-1 rounded-md"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 stroke-[2.5] flex-shrink-0" />
        <button
          onClick={onBackToPDCA}
          className={`font-semibold text-xs sm:text-[15px] tracking-tight transition-colors flex-shrink-0 ${
            activeSheetTopic ? 'text-slate-500 hover:text-blue-600 cursor-pointer' : 'text-slate-800'
          }`}
        >
          PDCA
        </button>
        {activeSheetTopic && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 stroke-[2.5] flex-shrink-0" />
            <span className="font-semibold text-slate-800 text-xs sm:text-[14px] tracking-tight truncate max-w-[120px] sm:max-w-none">
              M Tanaka San Audit
            </span>
          </>
        )}
      </div>

      {/* Right Utility Icons matching screenshot - desktop full icons, mobile responsive compact */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Download Icon - hidden on very small screens, visible from sm: */}
        <button 
          onClick={onExport}
          className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Download PDCA Report"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Settings Icon - hidden on very small screens, visible on md: */}
        <button 
          className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden sm:block"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Notifications Icon with dot */}
        <button 
          className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* User Avatar Circle 'YY' in solid vibrant blue */}
        <div className="ml-1 sm:ml-2 pl-1.5 sm:pl-2 border-l border-slate-200 flex items-center gap-2">
          <div 
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center font-bold text-[11px] sm:text-xs shadow-sm ring-2 ring-blue-100 cursor-pointer flex-shrink-0"
            title="Yogesh Yadav (AS081213)"
          >
            YY
          </div>
        </div>
      </div>
    </header>
  );
}
