import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
};

const RevisionHistoryList = ({ logs, loading }) => {
    if (loading) {
        return <div className="py-10 text-center text-muted-foreground">Loading history...</div>;
    }

    if (!logs || logs.length === 0) {
        return <div className="py-10 text-center text-muted-foreground">No revision history yet.</div>;
    }

    return (
        <div className="overflow-x-auto rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date Updated</TableHead>
                        <TableHead>Sheet Name</TableHead>
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
                            <TableCell className="font-medium">{log.sheetName}</TableCell>
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
};

export default RevisionHistoryList;
