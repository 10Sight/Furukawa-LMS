import React from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import RevisionHistoryTable from './RevisionHistoryTable';
import { formatDate } from './revisionHistoryUtils';

// Same audit log data as RevisionHistoryList, grouped into one collapsible
// section per sheet instead of a single flat table mixing every sheet
// together. Groups are ordered alphabetically by sheet name (matching the
// Sheets tab); entries within a group stay newest-first, inherited from the
// API's global `ORDER BY updatedAt DESC`.
const RevisionHistoryBySheet = ({ logs, loading, emptyMessage }) => {
    if (loading) {
        return <div className="py-10 text-center text-muted-foreground">Loading history...</div>;
    }

    if (!logs || logs.length === 0) {
        return <div className="py-10 text-center text-muted-foreground">{emptyMessage || "No revision history yet."}</div>;
    }

    const groups = new Map();
    for (const log of logs) {
        const key = log.sheetKey || log.sheetName;
        if (!groups.has(key)) groups.set(key, { sheetName: log.sheetName, entries: [] });
        groups.get(key).entries.push(log);
    }
    const sortedGroups = Array.from(groups.entries()).sort((a, b) =>
        a[1].sheetName.localeCompare(b[1].sheetName)
    );

    return (
        <Accordion type="multiple" className="space-y-2">
            {sortedGroups.map(([sheetKey, group]) => (
                <AccordionItem key={sheetKey} value={sheetKey} className="border rounded-md px-4">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="font-medium">{group.sheetName}</span>
                            <Badge variant="secondary">
                                {group.entries.length} {group.entries.length === 1 ? "change" : "changes"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                Last updated {formatDate(group.entries[0].updatedAt)}
                            </span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <RevisionHistoryTable logs={group.entries} showSheetName={false} />
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
};

export default RevisionHistoryBySheet;
