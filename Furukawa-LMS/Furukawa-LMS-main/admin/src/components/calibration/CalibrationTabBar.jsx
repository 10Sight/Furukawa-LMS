import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/common/ui/tabs.jsx';

export const CALIBRATION_TABS = [
  {
    id: 'procedure',
    code: '1',
    shortLabel: 'Procedure',
    fullTitle: 'Calibration Procedure & SOP',
  },
  {
    id: 'addition-deletion',
    code: '2',
    shortLabel: 'Add / Delete Request',
    fullTitle: 'Instrument Addition & Deletion Request Form',
  },
  {
    id: 'half-yearly-plan',
    code: '3',
    shortLabel: 'Half-Yearly Plan',
    fullTitle: 'In-House Calibration Plan (Half-Yearly)',
  },
  {
    id: 'monthly-plan',
    code: '4',
    shortLabel: 'Monthly Plan',
    fullTitle: 'In-House Calibration Plan (Monthly)',
  },
  {
    id: 'report-format',
    code: '5',
    shortLabel: 'Report Format',
    fullTitle: 'In-House Calibration Report Format',
  },
  {
    id: 'history-card',
    code: '6',
    shortLabel: 'History Card',
    fullTitle: 'Calibration Report History Card',
  },
  {
    id: 'decommissioning',
    code: '7',
    shortLabel: 'Decommissioning',
    fullTitle: 'Instrument Decommissioning Form',
  },
  {
    id: 'scrap-note',
    code: '8',
    shortLabel: 'Instrument Scrap',
    fullTitle: 'Instrument Scrap & Disposal Record',
  },
  {
    id: 'usability-declaration',
    code: '9',
    shortLabel: 'Usability Declaration',
    fullTitle: 'Declaration for Instrument Usable Condition',
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

  return (
    <div className="w-full overflow-x-auto pb-2 no-print themed-scrollbar">
      <Tabs value={activeTab} onValueChange={handleTabClick} className="w-full">
        <TabsList className="flex gap-2 w-max bg-gray-100 p-1.5 rounded-lg shadow-sm border border-gray-200 h-auto">
          {CALIBRATION_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-xs font-bold px-5 py-2.5 rounded-md transition-all cursor-pointer"
            >
              {tab.shortLabel}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
