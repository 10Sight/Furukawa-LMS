import fs from 'fs';

const filePath = 'd:/10Sight Technologies/Furukawa/Swargaya_Learning_Management_System/admin/src/pages/CMS/Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add LineSelect component
const lineSelectCode = `
const LineSelect = ({ recIndex, departmentId, formData, onInputChange }) => {
    const { data: linesData, isLoading } = useGetLinesByDepartmentQuery(departmentId, { skip: !departmentId });
    const lines = linesData?.data || [];

    return (
        <select
            className="w-full text-center bg-transparent outline-none cursor-pointer"
            value={formData[\`rec_\${recIndex}_From\`] || ""}
            onChange={(e) => onInputChange(recIndex, 'From', e.target.value)}
            disabled={!departmentId}
        >
            <option value="">{isLoading ? "Loading..." : "Select Line"}</option>
            {lines.map(line => (
                <option key={line.id || line._id} value={line.name}>{line.name}</option>
            ))}
        </select>
    );
};
`;

if (!content.includes('const LineSelect')) {
    content = content.replace('const ProcessSelect', lineSelectCode + '\nconst ProcessSelect');
    console.log('Added LineSelect component');
}

// 2. Update Deputed Autocomplete onChange
const deputedTarget = /onChange={\({ fullName, empId, fromInfo }\) => {[\s\S]*?}}/;
const deputedReplacement = `onChange={({ fullName, empId, fromInfo, departmentId, deptName }) => {
                                                                handleInputChange(recIndex, 'DeputedCode', empId);
                                                                handleInputChange(recIndex, 'Deputed', fullName);
                                                                handleInputChange(recIndex, 'DeputedDeptId', departmentId);
                                                                handleInputChange(recIndex, 'DeputedDeptName', deptName);
                                                                handleInputChange(recIndex, 'From', fromInfo || "");
                                                            }}`;

if (deputedTarget.test(content)) {
    content = content.replace(deputedTarget, deputedReplacement);
    console.log('Updated Deputed Autocomplete mapping');
} else {
    console.log('Deputed Autocomplete mapping target not found');
}

// 3. Replace "From" input with LineSelect
const fromTarget = `<td rowSpan="3" className="border border-black p-1"><AutoResizeTextarea className="text-center" placeholder="From" value={formData[\`rec_\${recIndex}_From\`] || ""} onChange={(e) => handleInputChange(recIndex, 'From', e.target.value)} /></td>`;
const fromReplacement = `                                                    <td rowSpan="3" className="border border-black p-1">
                                                        <div className="flex flex-col gap-1 items-center justify-center h-full">
                                                            {formData[\`rec_\${recIndex}_DeputedDeptName\`] && (
                                                                <span className="text-[9px] text-gray-500 font-bold uppercase">{formData[\`rec_\${recIndex}_DeputedDeptName\`]}</span>
                                                            )}
                                                            <LineSelect 
                                                                recIndex={recIndex}
                                                                departmentId={formData[\`rec_\${recIndex}_DeputedDeptId\`]}
                                                                formData={formData}
                                                                onInputChange={handleInputChange}
                                                            />
                                                        </div>
                                                     </td>`;

if (content.includes(fromTarget)) {
    content = content.replace(fromTarget, fromReplacement);
    console.log('Replaced From input with LineSelect');
} else {
    // Try trimmed search
    const trimmedTarget = fromTarget.trim();
    if (content.includes(trimmedTarget)) {
        content = content.replace(trimmedTarget, fromReplacement);
        console.log('Replaced From input with LineSelect (trimmed)');
    } else {
         console.log('From input target not found');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
