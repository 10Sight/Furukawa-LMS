import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  IconSearch,
  IconDownload,
  IconX,
  IconSquareCheck,
  IconSquareMinus,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";

const PROGRESS_STEPS = [
  { key: "fetching", label: "Fetching records" },
  { key: "generating", label: "Building workbook" },
  { key: "saving", label: "Preparing download" },
];

const IDLE_PROGRESS = { phase: "idle", current: 0, total: 0 };

export default function ExportColumnSelectorModal({
  isOpen,
  onOpenChange,
  columns = [],
  onExport,
  storageKey,
  title = "Customize Export Columns",
  description = "Choose which columns you want to include in your Excel export. Your selection is automatically saved.",
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [progress, setProgress] = useState(IDLE_PROGRESS);
  const [exportError, setExportError] = useState(null);

  const reportProgress = useCallback((update) => {
    setProgress((prev) => ({ ...prev, ...update }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let initialKeys = columns.map((c) => c.key);
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initialKeys = parsed.filter((k) => columns.some((c) => c.key === k));
          }
        }
      } catch (e) {
        console.error("Failed to load export column preferences", e);
      }
    }
    setSelectedKeys(initialKeys);
    setSearchTerm("");
    setProgress(IDLE_PROGRESS);
    setExportError(null);
  }, [isOpen, columns, storageKey]);

  const filteredColumns = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return columns;
    return columns.filter((c) => c.header.toLowerCase().includes(term));
  }, [columns, searchTerm]);

  const handleToggle = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => setSelectedKeys(columns.map((c) => c.key));
  const handleClearAll = () => setSelectedKeys([]);

  const runExport = async () => {
    if (selectedKeys.length === 0) return;
    setExportError(null);
    setProgress({ phase: "fetching", current: 0, total: 0 });
    try {
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(selectedKeys));
      }
      await onExport(selectedKeys, reportProgress);
      setProgress((prev) => ({ ...prev, phase: "done" }));
      await new Promise((resolve) => setTimeout(resolve, 700));
      onOpenChange(false);
    } catch (error) {
      console.error("Export callback failed", error);
      setExportError(error?.message || "Something went wrong while exporting.");
      setProgress((prev) => ({ ...prev, phase: "error" }));
    }
  };

  const isBusy = progress.phase === "fetching" || progress.phase === "generating" || progress.phase === "saving";

  const handleDialogOpenChange = (nextOpen) => {
    if (!nextOpen && isBusy) return;
    onOpenChange(nextOpen);
  };

  const activeStepIndex = PROGRESS_STEPS.findIndex((s) => s.key === progress.phase);
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;

  const dialogTitle = progress.phase === "error"
    ? "Export Failed"
    : progress.phase === "done"
    ? "Export Complete"
    : isBusy
    ? "Exporting Data"
    : title;

  const dialogDescription = progress.phase === "error"
    ? "The export could not be completed."
    : progress.phase === "done"
    ? "Your file has been downloaded."
    : isBusy
    ? "Please keep this window open while we prepare your file."
    : description;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange} className="max-w-2xl">
      <DialogContent className="max-h-[90vh] flex flex-col p-6 rounded-xl border border-slate-100 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-slate-100">
          <DialogTitle className="text-xl font-bold">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        {isBusy || progress.phase === "done" || progress.phase === "error" ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 gap-6 min-h-[250px]">
            {progress.phase === "error" ? (
              <>
                <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
                  <IconAlertTriangle className="w-7 h-7 text-rose-500" />
                </div>
                <p className="text-xs text-slate-500 text-center max-w-sm">{exportError}</p>
              </>
            ) : progress.phase === "done" ? (
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <IconCheck className="w-7 h-7 text-emerald-500" />
              </div>
            ) : (
              <div className="w-full max-w-sm space-y-5">
                {PROGRESS_STEPS.map((step, idx) => {
                  const status = idx < activeStepIndex ? "done" : idx === activeStepIndex ? "active" : "pending";
                  const showBar = status === "active";
                  const hasCount = showBar && progress.total > 0;
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                          status === "done"
                            ? "bg-emerald-500"
                            : status === "active"
                            ? "bg-indigo-600"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {status === "done" ? (
                          <IconCheck className="w-3.5 h-3.5" />
                        ) : status === "active" ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <span className="text-[10px] font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-medium ${status === "pending" ? "text-slate-400" : "text-slate-700"}`}>
                          {step.label}
                        </p>
                        {showBar && (
                          <>
                            <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              {hasCount ? (
                                <div
                                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              ) : (
                                <div className="h-full w-full bg-indigo-600 rounded-full animate-pulse" />
                              )}
                            </div>
                            {hasCount && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                {progress.current.toLocaleString()} / {progress.total.toLocaleString()} ({pct}%)
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search columns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 rounded-lg"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <IconX className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-10 text-xs rounded-lg flex items-center gap-1.5"
                >
                  <IconSquareCheck className="w-4 h-4 text-emerald-500" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-10 text-xs rounded-lg flex items-center gap-1.5"
                >
                  <IconSquareMinus className="w-4 h-4 text-rose-500" />
                  Clear All
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[250px] max-h-[45vh] pr-1 py-1">
              {filteredColumns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
                  <p className="text-sm">No columns match your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredColumns.map((col) => {
                    const isChecked = selectedKeys.includes(col.key);
                    return (
                      <div
                        key={col.key}
                        onClick={() => handleToggle(col.key)}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50"
                            : "border-slate-100 bg-slate-50/30 hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggle(col.key)}
                          id={`col-${col.key}`}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={`col-${col.key}`}
                          className="text-xs font-medium text-slate-700 leading-tight cursor-pointer"
                        >
                          {col.header}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <DialogFooter className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
          {progress.phase === "error" ? (
            <div className="flex items-center gap-3 w-full justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 text-xs rounded-lg"
              >
                Close
              </Button>
              <Button type="button" onClick={runExport} className="h-10 text-xs rounded-lg">
                Try Again
              </Button>
            </div>
          ) : isBusy || progress.phase === "done" ? null : (
            <>
              <div className="text-xs text-slate-500 font-medium">
                <span className="text-indigo-600 font-bold">{selectedKeys.length}</span> of{" "}
                {columns.length} columns selected
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-10 text-xs rounded-lg w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={runExport}
                  disabled={selectedKeys.length === 0}
                  className="h-10 text-xs rounded-lg w-full sm:w-auto flex items-center justify-center gap-1.5"
                >
                  <IconDownload className="w-4 h-4" />
                  Export Excel
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
