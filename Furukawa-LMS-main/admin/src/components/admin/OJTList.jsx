import React from "react";
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
import { IconEye, IconPlus, IconLoader } from "@tabler/icons-react";
import { useGetStudentOJTsQuery } from "@/Redux/AllApi/OnJobTrainingApi";
import { Alert, AlertDescription } from "@/components/ui/alert";

const OJTList = ({ studentId, onViewDetails, onAddTraining }) => {
    const { data, isLoading, error } = useGetStudentOJTsQuery(studentId, {
        refetchOnMountOrArgChange: true
    });

    const ojts = data?.data || [];

    if (isLoading) return <div className="flex justify-center p-8"><IconLoader className="animate-spin" /></div>;

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertDescription>Failed to load OJT records.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">On Job Training History</h3>
                <Button onClick={onAddTraining} size="sm" className="gap-2">
                    <IconPlus className="h-4 w-4" />
                    Add Training
                </Button>
            </div>

            {ojts.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-gray-50 text-gray-500">
                    No On Job Training records found. Start a new session.
                </div>
            ) : (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Training Name</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead>Line</TableHead>
                                <TableHead>Machine</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ojts.map((ojt) => (
                                <TableRow key={ojt.id || ojt._id}>
                                    <TableCell>{new Date(ojt.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-medium">{ojt.name || "Evaluation"}</TableCell>
                                    <TableCell>{ojt.department?.name || "-"}</TableCell>
                                    <TableCell>{ojt.line?.name || "-"}</TableCell>
                                    <TableCell>{ojt.machine?.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={ojt.result === 'Pass' ? 'success' : ojt.result === 'Fail' ? 'destructive' : 'secondary'}>
                                            {ojt.result || 'Pending'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => onViewDetails(ojt)}>
                                            <IconEye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default OJTList;
