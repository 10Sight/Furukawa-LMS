import fs from 'fs';

const filePath = 'd:\\10Sight Technologies\\Furukawa\\Swargaya_Learning_Management_System\\admin\\src\\pages\\CMS\\Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Rename Auth Operator Code
const authCodeTarget = `                                                             onChange={({ fullName, empId, currentLevel }) => {
                                                                 handleInputChange(recIndex, 'OpName', fullName);
                                                                 handleInputChange(recIndex, 'Code', empId);
                                                                 handleInputChange(recIndex, 'CurSkill', currentLevel || "");
                                                             }}`;

const authCodeReplacement = `                                                             onChange={({ fullName, empId, currentLevel }) => {
                                                                 handleInputChange(recIndex, 'OpName', fullName);
                                                                 handleInputChange(recIndex, 'OpCode', empId);
                                                                 handleInputChange(recIndex, 'CurSkill', currentLevel || "");
                                                             }}`;

// 2. Implement Deputed Code Autocomplete (Global)
const deputedCodeTarget = `<td rowSpan="3" className="border border-black p-1"><AutoResizeTextarea className="text-center" placeholder="Code" value={formData[\`rec_\${recIndex}_Code\`] || ""} onChange={(e) => handleInputChange(recIndex, 'Code', e.target.value)} /></td>`;

const deputedCodeReplacement = `                                                     <td rowSpan="3" className="border border-black p-1">
                                                        <OperatorAutocomplete
                                                            value={formData[\`rec_\${recIndex}_DeputedCode\`] || ""}
                                                            onChange={({ fullName, empId, fromInfo }) => {
                                                                handleInputChange(recIndex, 'DeputedCode', empId);
                                                                handleInputChange(recIndex, 'Deputed', fullName);
                                                                handleInputChange(recIndex, 'From', fromInfo || "");
                                                            }}
                                                            placeholder="Op Code"
                                                        />
                                                     </td>`;

if (content.includes(authCodeTarget)) {
    content = content.replace(authCodeTarget, authCodeReplacement);
    console.log('Updated Auth Operator Code mapping');
} else {
    console.log('Auth Operator Code target not found');
}

if (content.includes(deputedCodeTarget)) {
    content = content.replace(deputedCodeTarget, deputedCodeReplacement);
    console.log('Implemented Deputed Code Autocomplete');
} else {
    // Try without indentation if first one fails
    const rawTarget = deputedCodeTarget.trim();
    if (content.includes(rawTarget)) {
        content = content.replace(rawTarget, deputedCodeReplacement);
        console.log('Implemented Deputed Code Autocomplete (trimmed search)');
    } else {
        console.log('Deputed Code target not found');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
