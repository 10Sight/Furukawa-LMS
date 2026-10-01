import React from 'react';
import OperatorObservanceSheet from '@/components/admin/OperatorObservanceSheet';

export default function ObservanceTab({ department, section, line, subSection, ...props }) {
    return <OperatorObservanceSheet isEmbedded={true} departmentId={department} sectionId={section} lineId={line} subSectionId={subSection} {...props} />;
}
