import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconLoader } from "@tabler/icons-react";
import SubSectionDetailHeader from "@/components/departments/SubSectionDetailHeader";
import MachineManager from "@/components/departments/MachineManager";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";

const SubSectionDetail = () => {
    const { departmentId, lineId, subSectionId } = useParams();
    const navigate = useNavigate();

    // Fetch line to get Line name if needed (optional optimization)
    // For now we just fetch sub-sections for this line to find the specific one
    const { data: subSectionsData, isLoading: subLoading } = useGetSubSectionsByLineQuery(lineId, {
        skip: !lineId || isNaN(lineId)
    });
    const subSection = subSectionsData?.data?.find(s => String(s.id || s._id) === String(subSectionId));

    if (subLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <IconLoader className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    if (!subSection) {
        return (
            <div className="p-8 text-center bg-card border rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Sub-Section not found</h2>
                <Button onClick={() => navigate(-1)}>Go Back</Button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate(-1)}
                    className="h-8 w-8"
                >
                    <IconArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-xl font-semibold">Sub-Section Detail</h2>
            </div>

            <SubSectionDetailHeader subSection={subSection} lineName={`Line ${lineId}`} />

            <Tabs defaultValue="stations" className="w-full">
                <TabsList className="grid w-full grid-cols-1 md:w-[200px]">
                    <TabsTrigger value="stations">Stations</TabsTrigger>
                </TabsList>
                <TabsContent value="stations" className="mt-6">
                    <MachineManager subSectionId={subSectionId} lineId={lineId} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SubSectionDetail;
