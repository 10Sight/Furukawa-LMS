import React from 'react';
import { FileText, Edit3, Trash2, FileQuestion } from 'lucide-react';
import { Button } from '@/components/common/ui/button.jsx';
import { Badge } from '@/components/common/ui/badge.jsx';
import { Card } from '@/components/common/ui/card.jsx';

export default function CalibrationDocumentsTable({
  items = [],
  searchQuery = '',
  selectedUnit = null,
  selectedDepartment = '',
  selectedSection = '',
  onOpenDocument = () => {},
  onView = null,
  onEdit = null,
  onDownload = () => {},
  onDelete = () => {}
}) {
  const handleView = onView || onOpenDocument;
  const handleEdit = onEdit || onOpenDocument;
  // Apply filtering based on search query and filter dropdowns
  const filteredItems = items.filter((item) => {
    // If no unit is selected, show no data
    if (!selectedUnit) {
      return false;
    }
    if (item.unit !== selectedUnit) {
      return false;
    }
    if (selectedDepartment && item.department !== selectedDepartment) {
      return false;
    }
    if (selectedSection && item.section !== selectedSection) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.documentName?.toLowerCase().includes(q);
      const matchCode = item.code?.toLowerCase().includes(q);
      const matchDept = item.department?.toLowerCase().includes(q);
      const matchSec = item.section?.toLowerCase().includes(q);
      return matchName || matchCode || matchDept || matchSec;
    }
    return true;
  });

  if (filteredItems.length === 0) {
    let emptyTitle = 'No checksheets added yet';
    let emptyDesc = 'No checksheets have been created for this tab yet. Click "+ Add Checksheet" to create one.';

    if (!selectedUnit) {
      emptyTitle = 'Please select the unit';
      emptyDesc = 'Please select a unit from the dropdown above to view calibration checksheets.';
    } else if (selectedUnit === 'Gujrat') {
      emptyTitle = 'No checksheets added yet';
      emptyDesc = 'No calibration checksheets have been registered for Gujrat plant yet.';
    } else if (items.some((i) => i.unit === selectedUnit)) {
      emptyTitle = 'No Documents Found';
      emptyDesc = 'No calibration document matches your active search or filter criteria. Try adjusting your filters.';
    }

    return (
      <Card className="rounded-xl border border-border bg-card p-8 sm:p-14 text-center shadow-xs w-full">
        <FileQuestion className="w-12 h-12 text-muted-foreground/60 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-foreground">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          {emptyDesc}
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full min-w-0 rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center w-16">
                S.No.
              </th>
              <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider min-w-[280px]">
                Documents Name
              </th>
              <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-32">
                Unit
              </th>
              <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-40">
                Department
              </th>
              <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-44">
                Section
              </th>
              <th className="py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center w-36">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border">
            {filteredItems.map((doc, idx) => (
              <tr key={doc.id || idx} className="hover:bg-muted/30 transition-colors">
                {/* 1. S.No. */}
                <td className="py-3.5 px-3 text-xs font-semibold text-muted-foreground text-center">
                  {doc.sNo || idx + 1}
                </td>

                {/* 2. Documents Name */}
                <td className="py-3.5 px-4 text-xs font-semibold text-foreground">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div
                        onClick={() => onOpenDocument(doc)}
                        className="truncate font-bold text-foreground hover:text-primary hover:underline transition-colors cursor-pointer"
                      >
                        {doc.documentName}
                      </div>
                      {doc.code && (
                        <span className="inline-block font-mono text-[10px] text-muted-foreground mt-0.5">
                          Code: {doc.code}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* 3. Unit */}
                <td className="py-3.5 px-4 text-xs font-medium text-foreground">
                  <Badge variant="outline" className="font-semibold text-xs border-border bg-muted/30 text-foreground">
                    {doc.unit || 'Bawal'}
                  </Badge>
                </td>

                {/* 4. Department */}
                <td className="py-3.5 px-4 text-xs font-semibold text-foreground">
                  {doc.department}
                </td>

                {/* 5. Section */}
                <td className="py-3.5 px-4 text-xs font-medium text-muted-foreground">
                  {doc.section}
                </td>

                {/* 6. Actions */}
                <td className="py-3.5 px-4 text-center">
                  <div className="inline-flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => (typeof onEdit === 'function' ? onEdit(doc) : handleEdit(doc))}
                      title="Edit Checksheet"
                      className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(doc)}
                      title="Delete Document"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
