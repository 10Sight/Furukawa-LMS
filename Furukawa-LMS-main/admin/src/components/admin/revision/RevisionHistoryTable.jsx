import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from './revisionHistoryUtils';

// Core history table markup, shared by the flat list (per-sheet detail page)
// and the grouped-by-sheet accordion (main Revision Table page). `showSheetName`
// is off inside the accordion, where the sheet name is already the group header.
const RevisionHistoryTable = ({ logs, showSheetName = true }) => (
    <div className="overflow-x-auto rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date Updated</TableHead>
                    {showSheetName && <TableHead>Sheet Name</TableHead>}
                    <TableHead>Department / Section</TableHead>
                    <TableHead>Doc. No.</TableHead>
                    <TableHead>Rev. No.</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Change Details</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {logs.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell>{formatDate(log.updatedAt)}</TableCell>
                        {showSheetName && <TableCell className="font-medium">{log.sheetName}</TableCell>}
                        <TableCell>
                            {log.departmentName ? (
                                <div className="text-sm">
                                    {log.departmentName}
                                    {log.sectionName && <div className="text-muted-foreground text-xs">{log.sectionName}</div>}
                                </div>
                            ) : (
                                <Badge variant="secondary">Global</Badge>
                            )}
                        </TableCell>
                        <TableCell>{log.docNo || "-"}</TableCell>
                        <TableCell>{log.revNo || "-"}</TableCell>
                        <TableCell>
                            <div>{log.updatedByName || "Unknown"}</div>
                            {log.updatedBy && (
                                <div className="text-muted-foreground text-xs">ID: {log.updatedBy}</div>
                            )}
                        </TableCell>
                        <TableCell className="max-w-md whitespace-pre-wrap">
                            <div>{log.changeDetails || "-"}</div>
                            {log.changeDetailsHi && (
                                <div className="text-muted-foreground text-sm">{log.changeDetailsHi}</div>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);

export default RevisionHistoryTable;
