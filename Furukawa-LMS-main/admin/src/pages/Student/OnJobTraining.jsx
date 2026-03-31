import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OnJobTrainingTable from "@/components/admin/OnJobTrainingTable";
import OJTTrainingRecordSheet from "@/components/admin/OJTTrainingRecordSheet";
import { useGetStudentOJTsQuery } from "@/Redux/AllApi/OnJobTrainingApi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconEye } from "@tabler/icons-react";

const StudentOnJobTraining = () => {
    const { user } = useSelector((state) => state.auth);
    const { data: ojtData, isLoading } = useGetStudentOJTsQuery(user?.id, { skip: !user?.id });
    const [selectedOjt, setSelectedOjt] = useState(null);
    const [viewFormat, setViewFormat] = useState("list"); // 'list', 'evaluation', 'record'

    if (!user) return <div>Loading...</div>;

    const ojts = ojtData?.data || [];

    if (selectedOjt) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>OJT Record Details</CardTitle>
                        <CardDescription>
                            <Button variant="ghost" onClick={() => setSelectedOjt(null)} className="mt-2">
                                ← Back to List
                            </Button>
                        </CardDescription>
                    </CardHeader>
                </Card>
                <Tabs defaultValue="record" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="record">Training Record Sheet</TabsTrigger>
                        <TabsTrigger value="evaluation">Evaluation Form</TabsTrigger>
                    </TabsList>
                    <TabsContent value="record">
                        <OJTTrainingRecordSheet
                            ojtId={selectedOjt._id}
                            studentName={user.fullName}
                            readOnly={true}
                            onBack={() => setSelectedOjt(null)}
                        />
                    </TabsContent>
                    <TabsContent value="evaluation">
                        <OnJobTrainingTable
                            ojtId={selectedOjt._id}
                            studentName={user.fullName}
                            model={user.department || "N/A"}
                            readOnly={true}
                            onBack={() => setSelectedOjt(null)}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>My On Job Training Records</CardTitle>
                    <CardDescription>
                        View your OJT records in different formats
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8">Loading records...</div>
                    ) : ojts.length === 0 ? (
                        <div className="text-center py-12 border rounded-lg bg-gray-50 text-gray-500">
                            No OJT records found.
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Training Topic</TableHead>
                                        <TableHead>Area/Line</TableHead>
                                        <TableHead>Trainer</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ojts.map((ojt) => (
                                        <TableRow key={ojt.id || ojt._id}>
                                            <TableCell>{new Date(ojt.createdAt || ojt.date).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-medium">{ojt.trainingTopic || ojt.name || "-"}</TableCell>
                                            <TableCell>{ojt.areaLine || "-"}</TableCell>
                                            <TableCell>{ojt.trainingGivenBy || "-"}</TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => setSelectedOjt(ojt)}
                                                >
                                                    <IconEye className="h-4 w-4" />
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default StudentOnJobTraining;
