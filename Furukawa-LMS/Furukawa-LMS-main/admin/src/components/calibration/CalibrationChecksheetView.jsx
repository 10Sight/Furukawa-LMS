import React from 'react';
import { ArrowLeft, Save, Download, FileText, FileQuestion } from 'lucide-react';
import { Button } from '@/components/common/ui/button.jsx';
import { Badge } from '@/components/common/ui/badge.jsx';
import { toast } from 'sonner';
import AdditionDeletionChecksheet from './checksheets/AdditionDeletionChecksheet.jsx';
import HalfYearlyPlanChecksheet from './checksheets/HalfYearlyPlanChecksheet.jsx';
import MonthlyPlanChecksheet from './checksheets/MonthlyPlanChecksheet.jsx';
import FormatChecksheet from './checksheets/FormatChecksheet.jsx';
import MatingGaugeChecksheet from './checksheets/MatingGaugeChecksheet.jsx';
import ReportFormatChecksheet from './checksheets/ReportFormatChecksheet.jsx';
import HistoryCardChecksheet from './checksheets/HistoryCardChecksheet.jsx';
import DecommissioningReportChecksheet from './checksheets/DecommissioningReportChecksheet.jsx';
import InstrumentScrapReportChecksheet from './checksheets/InstrumentScrapReportChecksheet.jsx';
import UsabilityDeclarationChecksheet from './checksheets/UsabilityDeclarationChecksheet.jsx';

export default function CalibrationChecksheetView({
  document = {},
  onBack = () => { }
}) {
  const isAdditionDeletion =
    document.code === 'F-CAL-02' ||
    document.id === 'DOC-CAL-02' ||
    document.documentName?.includes('Addition & Deletion') ||
    document.documentName?.includes('addition/deletion');

  const isHalfYearlyPlan =
    document.code === 'F-CAL-03' ||
    document.id === 'DOC-CAL-03' ||
    document.documentName?.includes('Half-Yearly') ||
    document.documentName?.includes('half yearly') ||
    document.documentName?.includes('In-House Calibration Plan Half-Yearly') ||
    document.documentName?.includes('Inhouse Calibration Plan Jul');

  const isMonthlyPlan =
    document.code === 'F-CAL-04' ||
    document.id === 'DOC-CAL-04' ||
    document.documentName?.includes('Monthly') ||
    document.documentName?.includes('monthly') ||
    document.documentName?.includes('Monthly Execution');

  const isHistoryCard =
    document.code === 'F-CAL-06' ||
    document.id === 'DOC-CAL-06' ||
    document.documentName?.includes('History Card') ||
    document.documentName?.includes('history card');

  const isMatingGauge =
    document.subType === 'mating-gauge' ||
    document.code === 'F-CAL-05-MG' ||
    document.id === 'DOC-CAL-05-MATING' ||
    document.documentName?.toLowerCase().includes('mating gauge');

  const isFormatChecksheet =
    !isMatingGauge &&
    (document.subType === 'format-checksheet' ||
      document.id === 'DOC-CAL-05-FORMAT' ||
      document.id === 'DOC-CAL-05' ||
      document.code === 'F-CAL-05');

  const isDecommissioning =
    document.code === 'F-CAL-07' ||
    document.id === 'DOC-CAL-07' ||
    document.documentName?.includes('Decommissioning') ||
    document.documentName?.includes('decommissioning');

  const isScrapReport =
    document.code === 'F-CAL-08' ||
    document.id === 'DOC-CAL-08' ||
    document.documentName?.includes('Scrap') ||
    document.documentName?.includes('scrap') ||
    document.documentName?.includes('Disposal');

  const isUsabilityDeclaration =
    document.code === 'F-CAL-09' ||
    document.id === 'DOC-CAL-09' ||
    document.documentName?.includes('Usable Condition') ||
    document.documentName?.includes('usable condition') ||
    document.documentName?.includes('Declaration') ||
    document.documentName?.includes('Usability') ||
    document.documentName?.includes('usability');

  const handleSave = () => {
    toast.success('Checksheet saved successfully!');
  };

  const handleExport = () => {
    toast.info('Preparing checksheet for print / export...');
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 h-dvh w-full bg-[#f8fafc] text-slate-800 flex flex-col overflow-hidden">
      {/* ── Top Navigation Bar: Shadcn themed header with Back, Metadata & Save/Export ── */}
      <div className="shrink-0 w-full bg-white border-b border-slate-200 px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 z-30">
        {/* Left Side: Back Button & Document Information */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-9 gap-1.5 px-3 font-semibold text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
            title="Back to Calibration List"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Back</span>
          </Button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {document.documentName || 'Calibration Checksheet Document'}
              </h2>
              {document.code && (
                <Badge variant="outline" className="font-mono text-[10px] font-bold text-slate-600 border-slate-300">
                  {document.code}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
              {document.unit && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium bg-slate-100 text-slate-700">
                  Unit: {document.unit}
                </Badge>
              )}
              {document.department && (
                <span>
                  • Dept: <strong className="text-slate-700">{document.department}</strong>
                </span>
              )}
              {document.section && (
                <span>
                  • Section: <strong className="text-slate-700">{document.section}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Save & Export Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="h-9 gap-1.5 px-4 font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer"
            title="Save Checksheet"
          >
            <Save className="w-4 h-4 stroke-[2.2]" />
            <span>Save</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9 gap-1.5 px-3.5 font-semibold text-xs border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
            title="Export or Print Checksheet"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* ── Main Checksheet Content Area: Full Vertical Scrolling ────────── */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto overscroll-contain p-3 sm:p-6 pb-28">
        <div className="w-full max-w-[1560px] mx-auto flex flex-col items-center">
          {isAdditionDeletion ? (
            <AdditionDeletionChecksheet document={document} />
          ) : isHalfYearlyPlan ? (
            <HalfYearlyPlanChecksheet document={document} />
          ) : isMonthlyPlan ? (
            <MonthlyPlanChecksheet document={document} />
          ) : isHistoryCard ? (
            <HistoryCardChecksheet document={document} />
          ) : isMatingGauge ? (
            <MatingGaugeChecksheet document={document} />
          ) : isFormatChecksheet ? (
            <FormatChecksheet document={document} />
          ) : isDecommissioning ? (
            <DecommissioningReportChecksheet document={document} />
          ) : isScrapReport ? (
            <InstrumentScrapReportChecksheet document={document} />
          ) : isUsabilityDeclaration ? (
            <UsabilityDeclarationChecksheet document={document} />
          ) : (
            <div className="w-full bg-white rounded-2xl border border-[#ECEFF3] p-12 sm:p-20 text-center shadow-sm min-h-[420px] flex flex-col items-center justify-center">
              <FileQuestion className="w-14 h-14 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">no checksheet added yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                This checksheet template is ready to be configured. You can build this form step-by-step.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
