import React, { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    IconHistory, 
    IconChevronRight, 
    IconCheck, 
    IconX, 
    IconCalendar,
    IconFileText,
    IconLoader,
    IconArrowLeft
} from "@tabler/icons-react";
import { useGetImportLogsQuery, useGetImportLogDetailsQuery } from "@/Redux/AllApi/UserApi";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const OperatorImportLogs = () => {
    const [selectedLogId, setSelectedLogId] = useState(null);
    const { data: logsData, isLoading: isLoadingLogs } = useGetImportLogsQuery();
    const navigate = useNavigate();

    const handleLogClick = (id) => {
        setSelectedLogId(id);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => selectedLogId ? setSelectedLogId(null) : navigate(-1)}
                        className="h-9 w-9 p-0 rounded-full"
                    >
                        <IconArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <IconHistory className="h-7 w-7 text-orange-500" />
                            Operator Import Logs
                        </h1>
                        <p className="text-muted-foreground">
                            {selectedLogId ? "Detailed view of import results" : "History of all bulk operator imports"}
                        </p>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardContent className="p-6">
                    {!selectedLogId ? (
                        <div className="space-y-4">
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Date & Time</TableHead>
                                            <TableHead>File Name</TableHead>
                                            <TableHead className="text-center">Total Rows</TableHead>
                                            <TableHead className="text-center">Successful</TableHead>
                                            <TableHead className="text-center">Failed</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingLogs ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-60 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                        <IconLoader className="h-8 w-8 animate-spin text-orange-500" />
                                                        <p>Loading import history...</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : logsData?.data?.length > 0 ? (
                                            logsData.data.map((log) => (
                                                <TableRow 
                                                    key={log.id} 
                                                    className="cursor-pointer hover:bg-muted/30 transition-colors" 
                                                    onClick={() => handleLogClick(log.id)}
                                                >
                                                    <TableCell className="whitespace-nowrap font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <IconCalendar className="h-4 w-4 text-muted-foreground" />
                                                            {format(new Date(log.createdAt), "dd MMM yyyy, hh:mm a")}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="max-w-[300px] truncate">
                                                        <div className="flex items-center gap-2 font-mono text-sm text-blue-600">
                                                            <IconFileText className="h-4 w-4 text-muted-foreground" />
                                                            {log.fileName}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-lg">{log.totalRows}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1">
                                                                {log.successCount}
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground mt-1 font-bold">Total Success</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
                                                                {log.updatedCount || 0}
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground mt-1 font-bold">Updated</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <Badge variant="outline" className={log.failCount > 0 ? "bg-red-50 text-red-700 border-red-200 px-3 py-1" : "bg-gray-50 text-gray-400 border-gray-200 px-3 py-1"}>
                                                                {log.failCount}
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground mt-1 font-bold">Failed</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-medium">
                                                            View Details
                                                            <IconChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-60 text-center">
                                                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                        <IconHistory className="h-12 w-12 text-muted-foreground/30" />
                                                        <p className="text-lg font-medium">No import records found</p>
                                                        <p className="text-sm">When you import operators from Excel, they will appear here.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : (
                        <LogDetailsView logId={selectedLogId} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

const LogDetailsView = ({ logId }) => {
    const { data: detailsData, isLoading } = useGetImportLogDetailsQuery(logId);
    const summary = detailsData?.data?.summary;
    const details = detailsData?.data?.details || [];

    const failedRows = details.filter(d => d.status === 'FAILED');
    const updatedRows = details.filter(d => d.status === 'UPDATED');
    const addedRows = details.filter(d => d.status === 'CREATED');
    const noChangeRows = details.filter(d => d.status === 'SUCCESS');

    if (isLoading) {
        return (
            <div className="h-80 flex flex-col items-center justify-center gap-4">
                <IconLoader className="h-10 w-10 animate-spin text-orange-500" />
                <p className="text-muted-foreground font-medium">Fetching details for import #{logId}...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 text-orange-800 font-bold text-lg">
                        <IconFileText className="h-5 w-5" />
                        {summary?.fileName}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-orange-600 mt-1 font-medium">
                        <IconCalendar className="h-4 w-4" />
                        {summary?.createdAt ? format(new Date(summary.createdAt), "EEEE, dd MMMM yyyy 'at' hh:mm a") : ""}
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-orange-200 text-center shadow-sm min-w-[70px]">
                        <div className="text-xl font-bold text-green-600">{summary?.successCount || 0}</div>
                        <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground leading-tight">Total<br/>Success</div>
                    </div>
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-orange-200 text-center shadow-sm min-w-[70px]">
                        <div className="text-xl font-bold text-blue-600">{summary?.updatedCount || 0}</div>
                        <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground leading-tight">Total<br/>Updated</div>
                    </div>
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-orange-200 text-center shadow-sm min-w-[70px]">
                        <div className="text-xl font-bold text-red-600">{summary?.failCount || 0}</div>
                        <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground leading-tight">Total<br/>Failed</div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue={failedRows.length > 0 ? "failed" : updatedRows.length > 0 ? "updated" : addedRows.length > 0 ? "added" : "nochange"} className="w-full">
                <TabsList className="bg-muted/50 p-1 h-auto flex flex-wrap mb-4">
                    <TabsTrigger value="failed" className="data-[state=active]:bg-white px-4 h-9 gap-2 font-semibold">
                        <IconX className="h-4 w-4 text-red-500" />
                        Failed ({failedRows.length})
                    </TabsTrigger>
                    <TabsTrigger value="added" className="data-[state=active]:bg-white px-4 h-9 gap-2 font-semibold text-green-600">
                        <IconCheck className="h-4 w-4" />
                        Added ({addedRows.length})
                    </TabsTrigger>
                    <TabsTrigger value="updated" className="data-[state=active]:bg-white px-4 h-9 gap-2 font-semibold text-blue-600">
                        <IconHistory className="h-4 w-4" />
                        Updated ({updatedRows.length})
                    </TabsTrigger>
                    <TabsTrigger value="nochange" className="data-[state=active]:bg-white px-4 h-9 gap-2 font-semibold text-gray-500">
                        <IconCheck className="h-4 w-4" />
                        No Change ({noChangeRows.length})
                    </TabsTrigger>
                </TabsList>

                <div className="rounded-md border bg-white min-h-[400px]">
                    <TabsContent value="failed" className="m-0 overflow-y-auto max-h-[600px]">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[80px]">Row #</TableHead>
                                    <TableHead className="w-[250px]">Operator Info</TableHead>
                                    <TableHead>Failure Reason</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedRows.length > 0 ? (
                                    failedRows.map((detail) => (
                                        <TableRow key={detail.id} className="align-top hover:bg-red-50/30 transition-colors">
                                            <TableCell className="font-mono pt-4 font-bold text-muted-foreground">{detail.rowNumber}</TableCell>
                                            <TableCell className="pt-4">
                                                <div className="text-sm font-bold text-gray-900 leading-none mb-1">
                                                    {detail.rowData?.["Name"] || detail.rowData?.["fullName"] || "Unknown Name"}
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono bg-gray-100 px-1.5 py-0.5 rounded inline-block">
                                                    ID: {detail.rowData?.["Employee Code"] || detail.rowData?.["empId"] || "N/A"}
                                                </div>
                                            </TableCell>
                                            <TableCell className="pt-4">
                                                <div className="text-sm text-red-700 font-semibold bg-red-50 border border-red-100 p-2 rounded-md">
                                                    {detail.errorMessage}
                                                </div>
                                            </TableCell>
                                            <TableCell className="pt-4 text-right">
                                                <Badge className="bg-red-100 text-red-700 border-none hover:bg-red-100">Failed</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-60 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                                <IconCheck className="h-10 w-10 text-green-500" />
                                                <p className="font-bold text-lg">No failures in this import!</p>
                                                <p className="text-sm">All rows were processed successfully.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    <TabsContent value="added" className="m-0 overflow-y-auto max-h-[600px]">
                        <SuccessRowsTable data={addedRows} statusLabel="ADDED" />
                    </TabsContent>

                    <TabsContent value="updated" className="m-0 overflow-y-auto max-h-[600px]">
                        <SuccessRowsTable data={updatedRows} statusLabel="UPDATED" showChanges={true} />
                    </TabsContent>

                    <TabsContent value="nochange" className="m-0 overflow-y-auto max-h-[600px]">
                        <SuccessRowsTable data={noChangeRows} statusLabel="NO CHANGE" />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
};

const SuccessRowsTable = ({ data, statusLabel, showChanges = false }) => {
    return (
        <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                    <TableHead className="w-[80px]">Row #</TableHead>
                    <TableHead className="w-[250px]">Operator Info</TableHead>
                    <TableHead>Hierarchy / Mapping</TableHead>
                    <TableHead className="text-right">Action Log</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length > 0 ? (
                    data.map((detail) => (
                        <TableRow key={detail.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold text-muted-foreground">{detail.rowNumber}</TableCell>
                            <TableCell>
                                <div className="text-sm font-bold text-gray-900 leading-none mb-1">
                                    {detail.rowData?.["Name"] || detail.rowData?.["fullName"] || "N/A"}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono bg-gray-100 px-1.5 py-0.5 rounded inline-block">
                                    {detail.rowData?.["Employee Code"] || detail.rowData?.["empId"] || "N/A"}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-2">
                                    {detail.rowData?.["Department"] && (
                                        <Badge variant="secondary" className="text-[10px] font-bold uppercase">{detail.rowData["Department"]}</Badge>
                                    )}
                                    {detail.rowData?.["Section"] && (
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase">{detail.rowData["Section"]}</Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                {showChanges ? (
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="text-xs text-blue-600 font-bold bg-blue-50 inline-block px-2 py-1 rounded">
                                            {statusLabel}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground text-right max-w-[200px] leading-tight">
                                            {Object.entries(detail.changes || {}).map(([field, delta]) => (
                                                <div key={field} className="border-b last:border-0 border-gray-100 py-0.5">
                                                    <span className="font-bold">{field}</span>: {delta.from} → {delta.to}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`text-xs font-bold inline-block px-2 py-1 rounded ${
                                        statusLabel === 'ADDED' ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-50'
                                    }`}>
                                        {statusLabel}
                                    </div>
                                )}
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-60 text-center text-muted-foreground">
                            No {statusLabel.toLowerCase()} records in this import.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
};

export default OperatorImportLogs;
