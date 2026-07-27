import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from 'lucide-react';

const RevisionRecordList = ({ records, loading, canEdit, onEdit }) => {
    if (loading) {
        return <div className="py-10 text-center text-muted-foreground">Loading revision records...</div>;
    }

    if (!records || records.length === 0) {
        return <div className="py-10 text-center text-muted-foreground">No revision records found.</div>;
    }

    return (
        <div className="overflow-x-auto rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12">Sr. No.</TableHead>
                        <TableHead>Sheet Name</TableHead>
                        <TableHead>Doc. No.</TableHead>
                        <TableHead>Rev. No.</TableHead>
                        <TableHead>Rev. Date</TableHead>
                        <TableHead>Affected Sr. No. / Page</TableHead>
                        <TableHead>Change Details</TableHead>
                        {canEdit && <TableHead className="w-16 text-right">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record, index) => (
                        <TableRow key={record.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{record.sheetName}</TableCell>
                            <TableCell>{record.docNo || "-"}</TableCell>
                            <TableCell>{record.revNo || "-"}</TableCell>
                            <TableCell>{record.revDate || "-"}</TableCell>
                            <TableCell className="max-w-xs">
                                <div>{record.affectedSrNoPage || "-"}</div>
                                {record.affectedSrNoPageHi && (
                                    <div className="text-muted-foreground text-sm">{record.affectedSrNoPageHi}</div>
                                )}
                            </TableCell>
                            <TableCell className="max-w-md whitespace-pre-wrap">
                                <div>{record.changeDetails || "-"}</div>
                                {record.changeDetailsHi && (
                                    <div className="text-muted-foreground text-sm">{record.changeDetailsHi}</div>
                                )}
                            </TableCell>
                            {canEdit && (
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => onEdit(record)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default RevisionRecordList;
