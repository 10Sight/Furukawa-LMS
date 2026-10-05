import React from 'react';
import { 
  Home, 
  ChevronRight, 
  Download, 
  Settings, 
  Bell,
  ArrowLeft
} from 'lucide-react';

export default function TopHeader({ 
  onExport, 
  currentView = 'list',
  onBackToList
}) {
  return (
    <header className="h-16 w-full min-w-0 shrink-0 bg-white backdrop-blur-md border-b border-[#E9ECEF] flex items-center justify-between gap-2 px-3 sm:px-6 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2.5 text-sm">
        <button 
          onClick={onBackToList}
          className="text-slate-400 hover:text-blue-600 transition-colors"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 stroke-[2.5]" />
        
        <span 
          onClick={onBackToList}
          className={`font-bold text-[14px] tracking-tight ${
            currentView === 'form' 
              ? 'text-slate-500 hover:text-blue-600 cursor-pointer' 
              : 'text-slate-800'
          }`}
        >
          {currentView === 'process-audit' ? 'Process Audit' : 'PTM'}
        </span>

        {currentView === 'form' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 stroke-[2.5]" />
            <span className="font-bold text-[14px] text-blue-600">
              Form View
            </span>
            <button
              onClick={onBackToList}
              className="ml-3 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to PTM List</span>
            </button>
          </>
        )}
      </div>

      {/* Right Utility Icons matching screenshot */}
      <div className="flex items-center gap-2">
        {/* Download Icon */}
        <button 
          onClick={onExport}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Download Report"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Settings Icon */}
        <button 
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Notifications Icon with dot */}
        <button 
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* User Avatar Circle 'YY' in solid vibrant blue */}
        <div className="ml-1 pl-2 border-l border-slate-200 flex items-center">
          <div 
            className="w-8 h-8 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center font-bold text-xs shadow-sm cursor-pointer"
            title="Profile"
          >
            YY
          </div>
        </div>
      </div>
    </header>
  );
}
