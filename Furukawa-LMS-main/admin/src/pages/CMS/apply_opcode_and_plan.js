import fs from 'fs';

const filePath = 'd:/10Sight Technologies/Furukawa/Swargaya_Learning_Management_System/admin/src/pages/CMS/Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Insert OpCode display column before OpName Autocomplete
const opNameCellTarget = `<td rowSpan="3" className="border border-black p-1">
                                                        <OperatorAutocomplete
                                                            departmentId={selectedDepartment}
                                                            value={formData[\`rec_\${recIndex}_OpName\`] || ""}
                                                            onChange={({ fullName, empId, currentLevel }) => {`;

const opCodeCell = `<td rowSpan="3" className="border border-black p-1 text-center font-mono text-xs">
                                                        {formData[\`rec_\${recIndex}_OpCode\`] || ""}
                                                    </td>
                                                    `;

if (content.includes(opNameCellTarget)) {
    content = content.replace(opNameCellTarget, opCodeCell + opNameCellTarget);
    console.log('Inserted OpCode display column');
} else {
     // Regex fallback for whitespace variations
     const opNameRegex = /<td rowSpan="3" className="border border-black p-1">\s*<OperatorAutocomplete\s*departmentId={selectedDepartment}\s*value={formData\[`rec_\${recIndex}_OpName`\] \|\| ""\}\s*onChange={\(\{ fullName, empId, currentLevel \}\) => \{/;
     if (opNameRegex.test(content)) {
         content = content.replace(opNameRegex, (match) => opCodeCell + match);
         console.log('Inserted OpCode display column (regex)');
     } else {
         console.log('OpName cell target not found');
     }
}

// 2. Change Plan column (Index 775 approx) to date input
const planTarget = `<td rowSpan="3" className="border border-black p-1"><AutoResizeTextarea className="text-center" placeholder="Plan" value={formData[\`rec_\${recIndex}_Plan\`] || ""} onChange={(e) => handleInputChange(recIndex, 'Plan', e.target.value)} /></td>`;
const planReplacement = `<td rowSpan="3" className="border border-black p-1">
                                                        <input 
                                                            type="date" 
                                                            className="w-full text-center bg-transparent outline-none" 
                                                            value={formData[\`rec_\${recIndex}_Plan\`] || ""} 
                                                            onChange={(e) => handleInputChange(recIndex, 'Plan', e.target.value)} 
                                                        />
                                                     </td>`;

if (content.includes(planTarget)) {
    content = content.replace(planTarget, planReplacement);
    console.log('Updated Plan column to date input');
} else {
    // Regex fallback for Plan
    const planRegex = /<td rowSpan="3" className="border border-black p-1">\s*<AutoResizeTextarea[^>]*placeholder="Plan"[^>]*value={formData\[`rec_\${recIndex}_Plan`\] \|\| ""\}[^>]*onChange={\(e\) => handleInputChange\(recIndex, 'Plan', e\.target\.value\)} \/>\s*<\/td>/;
    if (planRegex.test(content)) {
        content = content.replace(planRegex, planReplacement);
         console.log('Updated Plan column to date input (regex)');
    } else {
        console.log('Plan column target not found');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
