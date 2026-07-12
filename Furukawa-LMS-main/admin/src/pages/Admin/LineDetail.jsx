import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconLoader } from "@tabler/icons-react";
import { useGetDepartmentByIdQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetLinesByDepartmentQuery } from '@/Redux/AllApi/LineApi';
import MachineManager from '@/components/departments/MachineManager';
import SubSectionManager from '@/components/departments/SubSectionManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";

const LineDetail = () => {
    const { departmentId, lineId } = useParams();
    const navigate = useNavigate();
    const [logAction] = useLogActionMutation();

    // Fetch Department and Line Details for Header
    const { data: departmentData, isLoading: isDeptLoading } = useGetDepartmentByIdQuery(departmentId);
    const { data: linesData, isLoading: isLinesLoading } = useGetLinesByDepartmentQuery(departmentId);

    const departmentName = departmentData?.data?.name || "Loading Department...";
    const currentLine = linesData?.data?.find(l => (l.id || l._id).toString() === lineId.toString());
    const lineName = currentLine?.name || "Loading Line...";

    useEffect(() => {
        if (!departmentData?.data?.name || !currentLine?.name) return;
        logAction({
            action: "VIEW_LINE_DETAIL",
            details: { departmentId, departmentName: departmentData.data.name, lineId, lineName: currentLine.name },
        });
    }, [departmentId, lineId, departmentData?.data?.name, currentLine?.name]);

    if (isDeptLoading || isLinesLoading) {
        return <div className="flex justify-center items-center h-screen"><IconLoader className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => {
                        const baseLayout = window.location.pathname.split('/')[1] || 'admin';
                        navigate(`/${baseLayout}/departments/${departmentId}?tab=sections`);
                    }} className="hover:bg-gray-100 rounded-full">
                        <IconArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">{lineName} Detail</h1>
                        <p className="text-sm text-gray-500">Department: {departmentName} &gt; Line: {lineName}</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="sub-sections" className="w-full">
                <TabsList className="grid w-full grid-cols-1 max-w-[200px] mb-4">
                    <TabsTrigger value="sub-sections">Sub-Sections</TabsTrigger>
                </TabsList>

                <TabsContent value="sub-sections">
                    <SubSectionManager lineId={lineId} sectionId={currentLine?.sectionId} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default LineDetail;
