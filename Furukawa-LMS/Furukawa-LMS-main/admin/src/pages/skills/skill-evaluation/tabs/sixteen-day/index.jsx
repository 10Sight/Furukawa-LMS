import React from 'react';
import SixteenDayMonitoring from "@/pages/training/monitoring/sixteen-day/index.js";

export default function SixteenDayTab({ department, section, line, subSection, ...props }) {
    return <SixteenDayMonitoring isEmbedded={true} departmentId={department} sectionId={section} lineId={line} subSectionId={subSection} {...props} />;
}
