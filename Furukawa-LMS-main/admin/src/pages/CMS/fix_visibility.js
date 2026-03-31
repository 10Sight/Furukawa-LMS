import fs from 'fs';

const filePath = 'd:/10Sight Technologies/Furukawa/Swargaya_Learning_Management_System/admin/src/pages/CMS/Daily5MRecording.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldAutoResize = `const AutoResizeTextarea = ({ value, onChange, placeholder, className, ...props }) => {
    return (
        <div className="grid w-full h-full min-w-[50px]">
            <div
                className={cn("invisible whitespace-pre-wrap break-words min-h-[1.5rem] p-0 m-0 text-left", className)}
                style={{ gridArea: '1 / 1 / 2 / 2' }}
            >
                {value || placeholder || ' '}
            </div>
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={cn("bg-transparent resize-none overflow-hidden focus:outline-none w-full h-full p-0 m-0 block", className)}
                style={{ gridArea: '1 / 1 / 2 / 2' }}
                rows={1}
                {...props}
            />
        </div>
    );
};`;

const newAutoResize = `const AutoResizeTextarea = ({ value, onChange, placeholder, className, ...props }) => {
    return (
        <div className="grid w-full h-full min-w-[50px] relative">
            <div
                className={cn("invisible whitespace-pre-wrap break-words min-h-[1.5rem] p-0 m-0 text-left pointer-events-none", className)}
                style={{ gridArea: '1 / 1 / 2 / 2' }}
            >
                {value || placeholder || ' '}
            </div>
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={cn("bg-transparent resize-none overflow-hidden focus:outline-none w-full h-full p-0 m-0 block text-black z-10", className)}
                style={{ gridArea: '1 / 1 / 2 / 2', minHeight: '1.5rem' }}
                rows={1}
                {...props}
            />
        </div>
    );
};`;

// Use a more flexible search if exact match fails
if (content.includes(oldAutoResize)) {
    content = content.replace(oldAutoResize, newAutoResize);
    console.log('Exact match found and replaced');
} else {
    console.log('Exact match not found, trying fuzzy match...');
    // Replace whitespace with generic regex \s+
    const fuzzyReg = /const AutoResizeTextarea = \({ value, onChange, placeholder, className, \.\.\.props }\) => \{\s+return \(\s+<div className="grid w-full h-full min-w-\[50px\]">\s+<div\s+className=\{cn\("invisible whitespace-pre-wrap break-words min-h-\[1\.5rem\] p-0 m-0 text-left", className\)\}\s+style=\{\{ gridArea: '1 \/ 1 \/ 2 \/ 2' \}\}\s+>\s+\{value \|\| placeholder \|\| ' '\}\s+<\/div>\s+<textarea\s+value=\{value\}\s+onChange=\{onChange\}\s+placeholder=\{placeholder\}\s+className=\{cn\("bg-transparent resize-none overflow-hidden focus:outline-none w-full h-full p-0 m-0 block", className\)\}\s+style=\{\{ gridArea: '1 \/ 1 \/ 2 \/ 2' \}\}\s+rows=\{1\}\s+\{\.\.\.props\}\s+\/>\s+<\/div>\s+\);\s+\};/;
    
    if (fuzzyReg.test(content)) {
        content = content.replace(fuzzyReg, newAutoResize);
        console.log('Fuzzy match found and replaced');
    } else {
        console.log('Fuzzy match also failed');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
