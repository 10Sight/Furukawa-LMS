import fs from 'fs';

const filePath = 'd:/10Sight Technologies/Furukawa/Swargaya_Learning_Management_System/admin/src/pages/CMS/Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Target the specific block containing the Auth Code mapping
const targetRegex = /handleInputChange\(recIndex,\s*'Code',\s*empId\);/g;
if (targetRegex.test(content)) {
    content = content.replace(targetRegex, "handleInputChange(recIndex, 'OpCode', empId);");
    console.log('Successfully remapped Auth Operator Code to OpCode');
} else {
    console.log('Target for Auth Operator Code remap not found');
}

fs.writeFileSync(filePath, content, 'utf8');
