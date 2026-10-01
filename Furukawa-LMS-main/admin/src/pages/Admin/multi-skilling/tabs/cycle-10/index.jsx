import React from 'react';
import Cycle10 from '@/pages/Admin/sheets/cycle-10';

export default function Cycle10Tab({ department, section, line, subSection, ...props }) {
    return <Cycle10 isEmbedded={true} departmentId={department} sectionId={section} lineId={line} subSectionId={subSection} {...props} />;
}
