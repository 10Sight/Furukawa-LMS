import React from 'react';
import Cycle10 from "@/pages/training/monitoring/cycle-10/index.js";

export default function Cycle10Tab({ department, section, line, subSection, ...props }) {
    return <Cycle10 isEmbedded={true} departmentId={department} sectionId={section} lineId={line} subSectionId={subSection} {...props} />;
}
