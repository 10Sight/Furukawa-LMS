import React from 'react';
import OperatorObservanceSheet from "@/components/common/training/OperatorObservanceSheet.jsx";

export default function ObservanceTab({ department, section, line, subSection, ...props }) {
    return <OperatorObservanceSheet isEmbedded={true} departmentId={department} sectionId={section} lineId={line} subSectionId={subSection} {...props} />;
}
