import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from 'lucide-react';

const RevisionRecordList = ({ records, loading, canEdit, onEdit, onAddOverride, linkToDetail = true, emptyMessage }) => {
    const navigate = useNavigate();

    const goToHistory = (record) => {
        navigate(`/admin/revision-table/${record.sheetKey}`, { state: { sheetName: record.sheetName } });
    };

    const stopAnd = (handler, record) => (e) => {
        e.stopPropagation();
        handler(record);
    };

    if (loading) {
        return <div className="py-10 text-center text-muted-foreground">Loading revision records...</div>;
    }

    if (!records || records.length === 0) {
        return <div className="py-10 text-center text-muted-foreground">{emptyMessage || "No revision records found."}</div>;
    }

    return (
        <div className="overflow-x-auto rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12">Sr. No.</TableHead>
                        <TableHead>Sheet Name</TableHead>
                        <TableHead>Department / Section</TableHead>
                        <TableHead>Doc. No.</TableHead>
                        <TableHead>Rev. No.</TableHead>
                        <TableHead>Rev. Date</TableHead>
                        <TableHead>Affected Sr. No. / Page</TableHead>
                        <TableHead>Change Details</TableHead>
                        {canEdit && <TableHead className="w-24 text-right">Action</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record, index) => (
                        <TableRow
                            key={record.id}
                            className={linkToDetail ? "cursor-pointer hover:bg-muted/50" : undefined}
                            onClick={linkToDetail ? () => goToHistory(record) : undefined}
                        >
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{record.sheetName}</TableCell>
                            <TableCell>
                                {record.departmentName ? (
                                    <div className="text-sm">
                                        {record.departmentName}
                                        {record.sectionName && <div className="text-muted-foreground text-xs">{record.sectionName}</div>}
                                    </div>
                                ) : (
                                    <Badge variant="secondary">Global</Badge>
                                )}
                            </TableCell>
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
                                <TableCell className="text-right whitespace-nowrap">
                                    <Button variant="ghost" size="icon" title="Edit this record" onClick={stopAnd(onEdit, record)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    {onAddOverride && (
                                        <Button variant="ghost" size="icon" title="Add department override" onClick={stopAnd(onAddOverride, record)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    )}
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
