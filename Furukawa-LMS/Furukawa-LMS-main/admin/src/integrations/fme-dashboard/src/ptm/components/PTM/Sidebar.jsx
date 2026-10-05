import React from 'react';
import { 
  ClipboardList, 
  LogOut, 
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck
} from 'lucide-react';

export default function Sidebar({ 
  collapsed, 
  setCollapsed, 
  hidden = false,
  currentView = 'list', 
  setCurrentView,
  onLogout 
}) {
  return (
    <aside 
      aria-hidden={hidden}
      className={`fixed top-0 left-0 h-screen bg-white border-r border-[#E9ECEF] flex flex-col z-30 transition-all duration-300 select-none shadow-sm ${
        hidden ? '-translate-x-full pointer-events-none' : ''
      } ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Sidebar Header: Toggle button and Logo */}
      <div className="h-16 flex items-center px-4 border-b border-[#F1F3F5] justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            id="sidebar-toggle-btn"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          
          {!collapsed && (
            <div className="flex items-center tracking-tight">
              <img src="/fme-logo.png" alt="Fme" className="h-8 w-14 object-cover object-center" />
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 px-3 space-y-2 overflow-y-auto">
        <button
          type="button"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors text-sm font-medium ${collapsed ? 'justify-center px-2' : ''}`}
          title="Back to Main Menu"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {!collapsed && <span className="text-[13px]">Back to Main Menu</span>}
        </button>

        {/* Active PTM Tab (matches screenshot blue pill) */}
        <div>
          <button
          onClick={() => setCurrentView && setCurrentView('list')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-semibold tracking-tight ${
              currentView === 'list' || currentView === 'form'
                ? 'text-white bg-[#2563EB] shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            } ${collapsed ? 'justify-center px-2' : ''}`}
            title="PTM Dashboard"
          >
            <ClipboardList className="w-4 h-4 flex-shrink-0 stroke-[2.2]" />
            {!collapsed && (
              <span className="text-[13px] font-bold">PTM</span>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCurrentView && setCurrentView('process-audit')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-semibold tracking-tight ${
            currentView === 'process-audit'
              ? 'text-white bg-[#2563EB] shadow-md shadow-blue-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          } ${collapsed ? 'justify-center px-2' : ''}`}
          title="Process Audit"
        >
          <ClipboardCheck className="w-4 h-4 flex-shrink-0 stroke-[2.2]" />
          {!collapsed && <span className="text-[13px] font-bold">Process Audit</span>}
        </button>
      </div>

      {/* Sidebar Footer: Logout */}
      <div className="p-3 border-t border-[#F1F3F5]">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
          title="Logout"
        >
          <LogOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
          {!collapsed && <span className="text-[13px]">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
