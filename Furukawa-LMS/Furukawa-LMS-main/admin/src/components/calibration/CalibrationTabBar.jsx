import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/ui/button.jsx';
import { Badge } from '@/components/common/ui/badge.jsx';
import {
  FileText,
  PlusCircle,
  Calendar,
  Clock,
  ClipboardCheck,
  History,
  AlertTriangle,
  Trash2,
  CheckCircle2
} from 'lucide-react';

export const CALIBRATION_TABS = [
  {
    id: 'procedure',
    code: '1',
    shortLabel: 'Procedure',
    fullTitle: 'Calibration Procedure & SOP',
    Icon: FileText,
  },
  {
    id: 'addition-deletion',
    code: '2',
    shortLabel: 'Add / Delete Request',
    fullTitle: 'Instrument Addition & Deletion Request Form',
    Icon: PlusCircle,
  },
  {
    id: 'half-yearly-plan',
    code: '3',
    shortLabel: 'Half-Yearly Plan',
    fullTitle: 'In-House Calibration Plan (Half-Yearly)',
    Icon: Calendar,
  },
  {
    id: 'monthly-plan',
    code: '4',
    shortLabel: 'Monthly Plan',
    fullTitle: 'In-House Calibration Plan (Monthly)',
    Icon: Clock,
  },
  {
    id: 'report-format',
    code: '5',
    shortLabel: 'Report Format',
    fullTitle: 'In-House Calibration Report Format',
    Icon: ClipboardCheck,
  },
  {
    id: 'history-card',
    code: '6',
    shortLabel: 'History Card',
    fullTitle: 'Calibration Report History Card',
    Icon: History,
  },
  {
    id: 'decommissioning',
    code: '7',
    shortLabel: 'Decommissioning',
    fullTitle: 'Instrument Decommissioning Form',
    Icon: AlertTriangle,
  },
  {
    id: 'scrap-note',
    code: '8',
    shortLabel: 'Instrument Scrap',
    fullTitle: 'Instrument Scrap & Disposal Record',
    Icon: Trash2,
  },
  {
    id: 'usability-declaration',
    code: '9',
    shortLabel: 'Usability Declaration',
    fullTitle: 'Declaration for Instrument Usable Condition',
    Icon: CheckCircle2,
  },
];

export default function CalibrationTabBar({ activeTab, onSelectTab, basePath = '/cms/calibration' }) {
  const navigate = useNavigate();

  const handleTabClick = (tabId) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else {
      navigate(`${basePath}/${tabId}`);
    }
  };

  const activeTabMeta = CALIBRATION_TABS.find((t) => t.id === activeTab) || CALIBRATION_TABS[0];

  return (
    <div className="bg-card text-card-foreground rounded-xl p-2.5 shadow-xs border border-border flex items-center justify-between flex-wrap gap-2 w-full">
      {/* 9 Tabs formatted as Shadcn Pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CALIBRATION_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.Icon;

          return (
            <Button
              key={tab.id}
              type="button"
              variant={isActive ? "default" : "secondary"}
              size="sm"
              onClick={() => handleTabClick(tab.id)}
              className={`h-9 gap-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isActive
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title={tab.fullTitle}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{tab.shortLabel}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.code}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Showing tab text on right side */}
      <div className="text-xs text-muted-foreground font-medium hidden lg:block pr-2">
        Showing <strong>{activeTabMeta.shortLabel}</strong> (Tab {activeTabMeta.code} of 9)
      </div>
    </div>
  );
}
