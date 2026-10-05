import React from 'react';

export default function TabNavigation({ activeTab, setActiveTab, counts }) {
  const tabs = [
    { id: 'Company', label: 'Company' },
    { id: 'Department', label: 'Department' },
    { id: 'Self PDCA', label: 'Self PDCA' },
    { id: 'CFT', label: 'CFT' },
  ];

  return (
    <div className="bg-white rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] inline-flex flex-wrap items-center gap-1.5 max-w-full">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span 
                className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                  tab.badgeColor || 'bg-amber-400 text-slate-900'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
