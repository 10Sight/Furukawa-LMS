import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconLoader } from "@tabler/icons-react";
import SubSectionDetailHeader from "@/components/departments/SubSectionDetailHeader";
import MachineManager from "@/components/departments/MachineManager";
import { useGetSubSectionByIdQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";

const SubSectionDetail = () => {
    const { departmentId, lineId, subSectionId } = useParams();
    const navigate = useNavigate();

    // Fetch specific sub-section detail including dynamic users
    const { data: subSectionResult, isLoading: subLoading } = useGetSubSectionByIdQuery(subSectionId, {
        skip: !subSectionId || isNaN(subSectionId)
    });
    const subSection = subSectionResult?.data;

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

            <div className="mt-6">
                <MachineManager subSectionId={subSectionId} lineId={lineId} />
            </div>
        </div>
    );
};

export default SubSectionDetail;
