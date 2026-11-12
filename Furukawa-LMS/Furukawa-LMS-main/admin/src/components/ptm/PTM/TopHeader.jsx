import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  ChevronRight, 
  Globe, 
  Download, 
  Settings, 
  Bell,
  Check,
  ArrowLeft,
  LogOut,
  UserCheck
} from 'lucide-react';

export default function TopHeader({ 
  onExport, 
  currentView = 'list',
  onBackToList,
  currentUser,
  onLogout
}) {
  const [langMenu, setLangMenu] = useState(false);
  const [currentLang, setCurrentLang] = useState('EN');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0].toUpperCase())
        .slice(0, 2)
        .join('')
    : 'SP';

  return (
    <header className="h-16 w-full min-w-0 shrink-0 bg-white backdrop-blur-md border-b border-[#E9ECEF] flex items-center justify-between gap-2 px-3 sm:px-6 sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2.5 text-base">
        <button 
          onClick={onBackToList}
          className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
          title="Home"
        >
          <Home className="w-4 h-4" />
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 stroke-[2.5]" />
        
        <span 
          onClick={onBackToList}
          className={`font-bold text-base tracking-tight ${
            currentView === 'form' 
              ? 'text-slate-500 hover:text-blue-600 cursor-pointer' 
              : 'text-slate-800'
          }`}
        >
          PTM
        </span>

        {currentView === 'form' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 stroke-[2.5]" />
            <span className="font-bold text-base text-blue-600">
              Form View
            </span>
            <button
              onClick={onBackToList}
              className="ml-3 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to PTM List</span>
            </button>
          </>
        )}
      </div>

      {/* Right Utility Icons */}
      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div className="relative">
          <button 
            onClick={() => setLangMenu(!langMenu)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors text-xs font-semibold cursor-pointer"
            title="Select Language"
          >
            <Globe className="w-4 h-4 text-slate-500" />
            <span className="text-slate-700 font-medium">{currentLang}</span>
          </button>

          {langMenu && (
            <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50 text-xs font-medium">
              {['EN', 'HI', 'JA'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setCurrentLang(lang);
                    setLangMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between cursor-pointer"
                >
                  <span>{lang === 'EN' ? 'English (EN)' : lang === 'HI' ? 'Hindi (HI)' : 'Japanese (JA)'}</span>
                  {currentLang === lang && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Download Icon */}
        <button 
          onClick={onExport}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Download Report"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Settings Icon */}
        <button 
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Notifications Icon with dot */}
        <button 
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative cursor-pointer"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* User Avatar Circle and Popover */}
        <div ref={userMenuRef} className="ml-1 pl-2 border-l border-slate-200 relative flex items-center">
          <button 
            type="button"
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="w-8 h-8 rounded-full bg-[#1D4ED8] hover:bg-blue-800 text-white flex items-center justify-center font-bold text-xs shadow-sm cursor-pointer transition-colors"
            title={`${currentUser?.name || 'Shivampanday'} (${currentUser?.employeeId || 'EMP0089'})`}
          >
            {initials}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {currentUser?.name || currentUser?.username || 'Shivampanday'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {currentUser?.employeeId || 'EMP0089'}
                  </p>
                  <p className="text-[10px] text-blue-600 font-semibold truncate">
                    {currentUser?.department || 'C&C Quality'}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
