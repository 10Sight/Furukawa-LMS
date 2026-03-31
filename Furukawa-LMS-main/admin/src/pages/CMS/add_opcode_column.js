import fs from 'fs';

const filePath = 'd:/10Sight Technologies/Furukawa/Swargaya_Learning_Management_System/admin/src/pages/CMS/Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `<td rowSpan="3" className="border border-black p-1">
                                                        <OperatorAutocomplete
                                                            departmentId={selectedDepartment}
                                                            value={formData[\`rec_\${recIndex}_OpName\`] || ""}
                                                            onChange={({ fullName, empId, currentLevel }) => {`;

const newColumn = `<td rowSpan="3" className="border border-black p-1 text-center font-mono text-xs">
                                                        {formData[\`rec_\${recIndex}_OpCode\`] || ""}
                                                    </td>
                                                    `;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, newColumn + targetStr);
    console.log('Successfully inserted OpCode display column');
} else {
    // Try trimmed version
    const trimmedTarget = targetStr.replace(/\s+/g, ' ');
    const fileContentFlat = content.replace(/\s+/g, ' ');
    
    if (fileContentFlat.includes(trimmedTarget)) {
         console.log('Target found using flexible search, attempting precise replacement...');
         // Use a regex to find the matching block with any whitespace
         const regex = /<td rowSpan="3" className="border border-black p-1">\s*<OperatorAutocomplete\s*departmentId={selectedDepartment}\s*value={formData\[`rec_\${recIndex}_OpName`\] \|\| ""\}\s*onChange={\(\{ fullName, empId, currentLevel \}\) => \{/;
         if (regex.test(content)) {
             content = content.replace(regex, (match) => newColumn + match);
             console.log('Successfully inserted OpCode display column via regex');
         } else {
             console.log('Regex failed to match even with flexible search success');
         }
    } else {
        console.log('Target for OpCode display column insertion not found');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
