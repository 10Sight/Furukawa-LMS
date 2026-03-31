import fs from 'fs';

const filePath = 'd:/10Sight Technologies/Furukawa/Swargaya_Learning_Management_System/admin/src/pages/CMS/Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// The checkboxes look like this:
// <td className="border border-black p-1"><input type="checkbox" checked={formData[`rec_${recIndex}_FP1_Chk1`] || false} onChange={(e) => handleInputChange(recIndex, 'FP1_Chk1', e.target.checked)} /></td>

// We want to replace them with:
// <td className="border border-black p-1">
//     <select className="w-full text-center bg-transparent outline-none cursor-pointer" value={formData[`rec_${recIndex}_FP1_Chk1`] || ""} onChange={(e) => handleInputChange(recIndex, 'FP1_Chk1', e.target.value)}>
//         <option value="">Select</option>
//         <option value="OK">OK</option>
//         <option value="N/A">N/A</option>
//     </select>
// </td>

const replaceCheckboxes = (idPrefix) => {
    for (let i = 1; i <= 5; i++) {
        const fieldName = `${idPrefix}_Chk${i}`;
        const targetRegex = new RegExp(`<td className="border border-black p-1"><input type="checkbox" checked={formData\\[\`rec_\\\${recIndex}_${fieldName}\`\\] \\|\\| false} onChange={\\(e\\) => handleInputChange\\(recIndex, '${fieldName}', e\\.target\\.checked\\)} \\/><\\/td>`, 'g');
        
        const replacement = `<td className="border border-black p-1">
                                                        <select
                                                            className="w-full text-center bg-transparent outline-none cursor-pointer"
                                                            value={formData[\`rec_\${recIndex}_${fieldName}\`] || ""}
                                                            onChange={(e) => handleInputChange(recIndex, '${fieldName}', e.target.value)}
                                                        >
                                                            <option value="">Select</option>
                                                            <option value="OK">OK</option>
                                                            <option value="N/A">N/A</option>
                                                        </select>
                                                    </td>`;
        
        if (targetRegex.test(content)) {
            content = content.replace(targetRegex, replacement);
            console.log(`Updated ${fieldName} to dropdown`);
        } else {
             // Try a more flexible version if exact match fails
             const regexFlex = new RegExp(`<td[^>]*>\\s*<input\\s+type="checkbox"\\s+checked={formData\\[\`rec_\\\${recIndex}_${fieldName}\`\\]\\s*\\|\\|\\s*false}\\s*onChange={\\(e\\)\\s*=>\\s*handleInputChange\\(recIndex,\\s*'${fieldName}',\\s*e\\.target\\.checked\\)}\\s*\\/>\\s*<\\/td>`, 'g');
             if (regexFlex.test(content)) {
                 content = content.replace(regexFlex, replacement);
                 console.log(`Updated ${fieldName} to dropdown (flexible match)`);
             } else {
                 console.log(`Could not find ${fieldName} checkbox`);
             }
        }
    }
};

replaceCheckboxes('FP1');
replaceCheckboxes('FP2');
replaceCheckboxes('FP3');

fs.writeFileSync(filePath, content, 'utf8');
