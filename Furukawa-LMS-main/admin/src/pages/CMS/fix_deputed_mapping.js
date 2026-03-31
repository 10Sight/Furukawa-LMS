import fs from 'fs';

const filePath = 'd:/10Sight Technologies/Furukawa/Swargaya_Learning_Management_System/admin/src/pages/CMS/Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target the specific block containing the Deputed Autocomplete onChange mapping
const targetRegex = /onChange={\({ fullName, empId, fromInfo, departmentId, deptName }\) => {[\s\S]*?handleInputChange\(recIndex, 'From', fromInfo \|\| ""\);\s*}}/;

if (targetRegex.test(content)) {
    const replacement = `onChange={({ fullName, empId, departmentId, deptName, lineName }) => {
                                                                handleInputChange(recIndex, 'DeputedCode', empId);
                                                                handleInputChange(recIndex, 'Deputed', fullName);
                                                                handleInputChange(recIndex, 'DeputedDeptId', departmentId);
                                                                handleInputChange(recIndex, 'DeputedDeptName', deptName);
                                                                handleInputChange(recIndex, 'From', lineName || "");
                                                            }}`;
    content = content.replace(targetRegex, replacement);
    console.log('Successfully updated Deputed Autocomplete mapping to use lineName');
} else {
    // Try a more flexible search if exact match fails
    const flexibleRegex = /handleInputChange\(recIndex, 'From', fromInfo \|\| ""\);/;
    if (flexibleRegex.test(content)) {
        content = content.replace(flexibleRegex, "handleInputChange(recIndex, 'From', lineName || \"\");");
        // Also need to update the destructuring in the parent onChange
        content = content.replace(/onChange={\({ fullName, empId, fromInfo, departmentId, deptName }\)/, "onChange={({ fullName, empId, departmentId, deptName, lineName })");
        console.log('Successfully updated Deputed Autocomplete mapping using flexible search');
    } else {
        console.log('Target for Deputed Autocomplete mapping not found');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
