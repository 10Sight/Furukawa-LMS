import React from 'react';
import ThreeDayMonitoring from "@/pages/training/monitoring/three-day/ThreeDayMonitoring.jsx";

export default function ThreeDayTab({ department, section, line, subSection, ...props }) {
    return <ThreeDayMonitoring isEmbedded={true} departmentId={department} sectionId={section} lineId={line} subSectionId={subSection} {...props} />;
}
