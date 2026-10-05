import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, 
  ArrowLeft, 
  LogOut, 
  Menu,
  ChevronLeft
} from 'lucide-react';
import logoImg from '../assets/images/logo.png';

export default function Sidebar({ collapsed, setCollapsed }) {
  return (
    <>
      <aside 
        className={`fixed top-0 left-0 h-screen bg-white border-r border-[#E9ECEF] flex flex-col z-50 md:z-30 transition-all duration-300 select-none shadow-sm ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Sidebar Header: Toggle button and Logo */}
        <div className={`h-16 flex items-center border-b border-[#F1F3F5] transition-all ${collapsed ? 'justify-center px-2' : 'px-3.5 gap-2.5'}`}>
        {/* Sidebar Collapse/Expand Button with user's book/sidebar icon */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/80 shadow-2xs transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          id="sidebar-toggle-btn"
        >
          {/* Exact match to the user's icon: rounded rectangle with left sidebar panel and chevron */}
          <svg
            className="w-5 h-5 text-slate-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="4" />
            <path d="M9 3v18" />
            {collapsed ? (
              <path d="m14 9 3 3-3 3" />
            ) : (
              <path d="m15 9-3 3 3 3" />
            )}
          </svg>
        </button>

        {/* Logo Image */}
        {!collapsed && (
          <div className="flex items-center tracking-tight overflow-hidden flex-1 animate-in fade-in duration-200">
            <img 
              src={logoImg} 
              alt="Logo" 
              className="h-10 w-auto max-w-[155px] object-contain" 
            />
          </div>
        )}
      </div>

      {/* Main Navigation - User requested single page 'PDCA' */}
      <div className={`flex-1 py-4 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {/* Back to Main Menu item */}
        <button 
          className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors text-sm font-medium ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
          title="Back to Main Menu"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400 flex-shrink-0" />
          {!collapsed && <span>Back to Main Menu</span>}
        </button>

        <div className="my-2 border-t border-slate-100"></div>

        {/* Single PDCA Page - Exactly matching the vibrant blue active rounded pill in the screenshot */}
        <div className="relative group">
          <Link
            to="/"
            className={`w-full flex items-center gap-3 py-3 rounded-2xl text-white bg-[#2563EB] shadow-md shadow-blue-500/25 transition-all text-sm font-semibold tracking-wide ${
              collapsed ? 'justify-center px-2' : 'px-4'
            }`}
            title="PDCA Dashboard"
          >
            {/* Clipboard / Plan-Do-Check-Act icon */}
            <ClipboardList className="w-5 h-5 flex-shrink-0 text-white stroke-[2.2]" />
            {!collapsed && (
              <span className="text-[15px] font-semibold tracking-tight">PDCA</span>
            )}
          </Link>
        </div>
      </div>

      {/* Sidebar Footer: Logout */}
      <div className={`p-3 border-t border-[#F1F3F5] ${collapsed ? 'flex justify-center p-2' : ''}`}>
        <button 
          className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors text-sm font-medium ${
            collapsed ? 'justify-center px-2' : 'px-3'
          }`}
          title="Logout"
        >
          <LogOut className="w-5 h-5 text-slate-400 flex-shrink-0 group-hover:text-red-500" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  </>
  );
}
