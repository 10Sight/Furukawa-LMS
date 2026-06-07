const fs = require('fs');
let content = fs.readFileSync('d:/10Sight Agency/Sarvagaya Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/admin/ThreeDayMonitoringSheet.jsx', 'utf8');

content = content.replace(
    /<th className=\"border-r border-b border-black p-0 min-w-\[75px\] h-10 text-\[12px\] font-bold bg-yellow-100\/50\">Total<\/th>/g,
    '<th className=\"border-r border-b border-black p-0 min-w-[75px] h-10 text-[12px] font-bold bg-gray-50\">Total</th>'
);

content = content.replace(
    /<div className=\"flex border-b border-black bg-yellow-400\">\s*<div className=\"w-1\/2 border-r border-black p-2 font-bold\">Actual %<\/div>/g,
    '<div className=\"flex border-b border-black\">\n                                                                    <div className=\"w-1/2 border-r border-black p-2 font-bold\">Actual %</div>'
);

content = content.replace(
    /<div className=\"flex bg-yellow-400 mt-auto border-t border-black\">\s*<div className=\"w-1\/2 border-r border-black p-2 font-bold\">Achievement %<\/div>/g,
    '<div className=\"flex mt-auto border-t border-black\">\n                                                                        <div className=\"w-1/2 border-r border-black p-2 font-bold\">Achievement %</div>'
);

content = content.replace(/bg-yellow-400/g, 'bg-yellow-300');

content = content.replace(
    /<tr className=\"bg-gray-50\/50\">\s*<td className=\"border-r border-b border-black p-1 font-bold italic\" colSpan=\{1\}>Total Mark<\/td>/g,
    '<tr className=\"bg-gray-50/50\">\n                                                            <td className=\"border-r border-b border-black p-1 font-bold\" colSpan={1}>Total Mark:</td>'
);

content = content.replace(
    /<td className=\"border-r border-b border-black p-1 font-bold italic\" colSpan=\{1\}>Target %<\/td>/g,
    '<td className=\"border-r border-b border-black p-1 font-bold\" colSpan={1}>Target %</td>'
);

content = content.replace(
    /<tr className=\"bg-yellow-300\/80\">\s*<td className=\"border-r border-b border-black p-1 font-bold italic underline\" colSpan=\{1\}>Actual %<\/td>\s*<td className=\"border-r border-b border-black p-1 text-center font-bold\">-<\/td>\s*\{\[1, 2, 3\]\.map\(d => \{\s*const val = gridData\[\`\$\{catId\}_day\$\{d\}_actual\`\] \|\| \"\";\s*return \(\s*<td key=\{d\} className=\"border-r border-b border-black p-1 text-center font-bold text-black\" colSpan=\{11\}>/g,
    '<tr>\n                                                            <td className=\"border-r border-b border-black p-1 font-bold\" colSpan={1}>Actual %</td>\n                                                            <td className=\"border-r border-b border-black p-1 text-center font-bold\">-</td>\n                                                            {[1, 2, 3].map(d => {\n                                                                const val = gridData[`${catId}_day${d}_actual`] || \"\";\n                                                                return (\n                                                                    <td key={d} className=\"border-r border-b border-black p-1 text-center font-bold bg-yellow-300 text-black\" colSpan={11}>\n                                                                        <div className=\"relative flex items-center justify-center min-w-[100px] h-full\">\n                                                                            <span className=\"invisible whitespace-pre px-4 text-[13px] font-bold\">{val || \"00%\"}</span>\n                                                                            <div className=\"absolute inset-0 flex items-center justify-center\">{val}</div>\n                                                                        </div>\n                                                                    </td>\n                                                                );\n                                                            })}\n                                                        </tr>'
);

content = content.replace(
    /<tr className=\"bg-yellow-300\/80\">\s*<td className=\"border-r border-b border-black p-1 font-bold underline\">Actual %<\/td>\s*\{\[1, 2, 3\]\.map\(d => \(\s*<td key=\{d\} className=\"border-r border-b border-black p-1 text-center font-bold text-black\" colSpan=\{11\}>/g,
    '<tr>\n                                                        <td className=\"border-r border-b border-black p-1 font-bold\">Actual %</td>\n                                                        {[1, 2, 3].map(d => (\n                                                            <td key={d} className=\"border-r border-b border-black p-1 text-center font-bold text-black bg-yellow-300\" colSpan={11}>'
);

content = content.replace(
    /<td className=\"border-r border-b border-black p-1\">Target %<\/td>/g,
    '<td className=\"border-r border-b border-black p-1 font-bold\">Target %</td>'
);

// Attendance logic replacement
const attendanceHTML = `                                            </React.Fragment>
                                        );
                                    });
                                })}
                                {/* Attendance Row */}
                                <tr>
                                    <td className="border-r border-b border-black p-2 text-center font-bold text-[13px]" rowSpan={5}>6</td>
                                    <td className="border-r border-b border-black p-2 font-bold uppercase whitespace-pre-line text-[12px] align-top" rowSpan={5}>ATTENDANCE</td>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Total no. of Monitoring day's :</td>
                                    <td className="border-r border-b border-black p-2 text-center font-bold">3</td>
                                    <td className="border-b border-black p-4 align-top bg-white" colSpan={34} rowSpan={5}>
                                        <div className="flex gap-8 justify-start h-full">
                                            <div className="border border-black w-[350px]">
                                                <p className="text-center font-bold border-b border-black p-1 text-[11px]">Evaluation Criteria: Cycle time</p>
                                                <table className="w-full text-[11px]">
                                                    <tbody>
                                                        <tr><td className="border-r border-b border-black text-center font-bold w-8">0</td><td className="border-b border-black px-2">1% -30% of standard time</td></tr>
                                                        <tr><td className="border-r border-b border-black text-center font-bold">1</td><td className="border-b border-black px-2">31%-50% of standard time</td></tr>
                                                        <tr><td className="border-r border-black text-center font-bold">2</td><td className="px-2">51%-100% of standard time</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="border border-black w-[450px]">
                                                <p className="text-center font-bold border-b border-black p-1 text-[11px]">Evaluation Criteria: Quality / System, Discipline ,5S & Safety</p>
                                                <table className="w-full text-[11px]">
                                                    <tbody>
                                                        <tr><td className="border-r border-b border-black text-center font-bold w-8">0</td><td className="border-b border-black px-2">Not known/ Not adhere the rule</td></tr>
                                                        <tr><td className="border-r border-b border-black text-center font-bold">1</td><td className="border-b border-black px-2">Partially known / Partially adhere the rule</td></tr>
                                                        <tr><td className="border-r border-black text-center font-bold">2</td><td className="px-2">Known / Adhere the rule</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Operator Present day's</td>
                                    <td className="border-r border-b border-black p-0">
                                        <input
                                            className="w-full h-full text-center border-none outline-none font-bold text-[13px]"
                                            value={gridData[\`attendPresent_day1\`] || ""}
                                            onChange={(e) => handleGridChange('attendPresent', 'day1', e.target.value)}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Target %</td>
                                    <td className="border-r border-b border-black p-2 text-center font-bold">100%</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Actual %</td>
                                    <td className="border-r border-b border-black p-2 text-center font-bold text-black bg-yellow-300">
                                        {gridData['attendance_total_score'] || "100%"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px] uppercase">GAP OBSERVED</td>
                                    <td className="border-r border-b border-black p-0">
                                        <input
                                            className="w-full h-full text-center border-none outline-none font-bold text-[13px]"
                                            value={gridData[\`attendGap\`] || "0"}
                                            onChange={(e) => handleGridChange('attendGap', '', e.target.value)}
                                        />
                                    </td>
                                </tr>
                            </tbody>`;

const attendanceRegex = /<\/React\.Fragment>\s*\);\s*}\);\s*}\)}\s*<\/tbody>/;
content = content.replace(attendanceRegex, attendanceHTML);

// Remove the old attendance block completely
const oldAttendanceRegex = /\{\/\* Attendance Summary \*\/\}\s*<div className=\"mt-8 border-l border-t border-black flex text-\[12px\]\">[\s\S]*?\{\/\* Overall Score Assessment Table \*\/\}/;
content = content.replace(oldAttendanceRegex, '{/* Overall Score Assessment Table */}');

// Overall Score Assessment Table Replacement
const overallScoreTable = `{/* Overall Score Assessment Table */}
                    <div className="mt-8 flex gap-8 items-start">
                        <div className="border-l border-t border-black text-[12px] w-[800px] flex-none">
                            <table className="w-full border-collapse text-center">
                                <thead>
                                    <tr className="bg-gray-100 uppercase">
                                        <th className="border-r border-b border-black p-2 text-left min-w-[200px]" rowSpan={2}>Parameters</th>
                                        <th className="border-r border-b border-black p-2 min-w-[120px]" rowSpan={2}>Total Weightage</th>
                                        <th className="border-r border-b border-black p-1">Poor**</th>
                                        <th className="border-r border-b border-black p-1">Average</th>
                                        <th className="border-r border-b border-black p-1">V Good</th>
                                        <th className="border-r border-b border-black p-1">Excellent</th>
                                        <th className="border-r border-b border-black p-2 min-w-[150px]" rowSpan={2}>Avg. Score (individual) in %</th>
                                        <th className="border-r border-b border-black p-2 min-w-[150px]" rowSpan={2}>Score Achieved w.r.t weightage</th>
                                    </tr>
                                    <tr className="bg-gray-100 uppercase">
                                        <th className="border-r border-b border-black p-1" colSpan={4}>% range</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: "10 Cycle Check", weight: 0.4, id: "score1", ranges: ["70-80", "81-90", "91-95", "96-100"] },
                                        { label: "Quality / System", weight: 0.2, id: "score2", ranges: ["70-80", "81-90", "91-95", "96-100"] },
                                        { label: "Non defective products Produced", weight: 0.1, id: "score3", ranges: ["80-90", "91-95", "96-99", "100"] },
                                        { label: "Discipline", weight: 0.1, id: "score4", ranges: ["0-70", "71-80", "81-90", "91-100"] },
                                        { label: "Safety", weight: 0.1, id: "score5", ranges: ["90-95", "96-97", "98-99", "100"] },
                                        { label: "Attendance", weight: 0.1, id: "score6", ranges: ["50-75", "76-85", "86-90", "91-100"] },
                                    ].map((row, idx) => (
                                        <tr key={idx} className="h-10">
                                            <td className="border-r border-b border-black p-2 text-left font-bold bg-gray-50 text-[13px]">{row.label}</td>
                                            <td className="border-r border-b border-black p-2 font-bold text-[13px]">{row.weight}</td>
                                            {row.ranges.map((r, i) => (
                                                <td key={i} className="border-r border-b border-black p-1 bg-gray-50/20">{r}</td>
                                            ))}
                                            <td className="border-r border-b border-black p-0">
                                                <input
                                                    disabled={true}
                                                    className="w-full h-full text-center border-none outline-none font-bold text-black bg-yellow-300 text-[13px]"
                                                    value={gridData[\`summary_avg_\${row.id}\`] || ""}
                                                />
                                            </td>
                                            <td className="border-r border-b border-black p-0">
                                                <input
                                                    disabled={true}
                                                    className="w-full h-full text-center border-none outline-none font-bold text-black bg-yellow-300 text-[13px]"
                                                    value={gridData[\`summary_weight_\${row.id}\`] || ""}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="h-12 text-[12px]">
                                        <td className="border-r border-b border-black p-2 font-bold text-left bg-gray-100" colSpan={1}>Total</td>
                                        <td className="border-r border-b border-black p-2 font-bold uppercase bg-gray-100 text-[13px]">1</td>
                                        <td className="border-r border-b border-black p-2 text-left italic text-[11px] bg-gray-50 leading-tight" colSpan={4}>** Poor criteria is minimum passing marks for associates.</td>
                                        <td className="border-r border-b border-black p-2 font-bold bg-gray-100 uppercase">100%</td>
                                        <td className="border-r border-b border-black p-0">
                                            <input
                                                disabled={true}
                                                className="w-full h-full text-center border-none outline-none font-bold bg-yellow-300 text-black text-[14px]"
                                                value={gridData[\`summary_total_score\`] || ""}
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Signatures and Remarks Section */}
                        <div className="w-[500px] border border-black p-4 flex flex-col justify-between text-[11px] uppercase font-bold bg-slate-50/30">
                            <div className="flex justify-between h-[150px]">
                                {/* Checked By */}
                                <div className="flex flex-col justify-between items-center text-center">
                                    <span className="font-bold whitespace-nowrap">Checked By:-</span>
                                    <div className="flex-1 flex flex-col justify-end w-full pb-1">
                                        <input
                                            className="w-full border-b border-black text-center outline-none uppercase font-bold text-black bg-transparent py-1 text-[13px]"
                                            value={footerData.checkedByName || ""}
                                            onChange={(e) => handleFooterChange('checkedByName', e.target.value)}
                                            disabled={readOnly || isLocked}
                                        />
                                    </div>
                                    <span className="font-normal text-[10px] text-gray-500">(Process In charge)</span>
                                </div>

                                {/* Approved By */}
                                <div className="flex flex-col justify-center items-center text-center pt-8">
                                    <span className="font-bold whitespace-nowrap">Approved By:</span>
                                    <div className="w-full flex flex-col items-center gap-2 mt-4">
                                        {canApprove && !isLocked ? (
                                            <div className="flex gap-1 w-full justify-center">
                                                {!footerData.approvedByName ? (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => handleSignature('approvedByName', 'approve')} className="h-7 text-[9px] bg-green-50 text-green-700 px-2">Approve</Button>
                                                        <Button size="sm" variant="outline" onClick={() => handleSignature('approvedByName', 'reject')} className="h-7 text-[9px] bg-red-50 text-red-700 px-2">Reject</Button>
                                                    </>
                                                ) : (
                                                    (authUser?.isAdmin || footerData.approvedByName?.includes(authUser?.fullName || authUser?.name)) && (
                                                        <Button size="sm" variant="ghost" onClick={() => handleClearSignature('approvedByName')} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"><Trash2 size={12} /></Button>
                                                    )
                                                )}
                                            </div>
                                        ) : null}
                                        <input
                                            className={\`w-full border-b border-black text-center outline-none uppercase font-bold text-[13px] bg-transparent py-1 pointer-events-none \${footerData.approvedByName?.includes('Rejected') ? 'text-red-600' : 'text-black'}\`}
                                            value={footerData.approvedByName || ""}
                                            readOnly
                                        />
                                    </div>
                                    <span className="font-normal text-[10px] text-gray-500 mt-1">(Dept. Head)</span>
                                </div>

                                {/* Verified By */}
                                <div className="flex flex-col justify-between items-center text-center">
                                    <span className="font-bold whitespace-nowrap">Verified By:-</span>
                                    <div className="w-full flex flex-col items-center justify-end flex-1 pb-1 gap-2">
                                        {canVerify && !isLocked ? (
                                            <div className="flex gap-1 w-full justify-center">
                                                {!footerData.verifiedByName ? (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => handleSignature('verifiedByName', 'approve')} className="h-7 text-[9px] bg-green-50 text-green-700 px-2">Approve</Button>
                                                        <Button size="sm" variant="outline" onClick={() => handleSignature('verifiedByName', 'reject')} className="h-7 text-[9px] bg-red-50 text-red-700 px-2">Reject</Button>
                                                    </>
                                                ) : (
                                                    (authUser?.isAdmin || footerData.verifiedByName?.includes(authUser?.fullName || authUser?.name)) && (
                                                        <Button size="sm" variant="ghost" onClick={() => handleClearSignature('verifiedByName')} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"><Trash2 size={12} /></Button>
                                                    )
                                                )}
                                            </div>
                                        ) : null}
                                        <input
                                            className={\`w-full border-b border-black text-center outline-none uppercase font-bold text-[13px] bg-transparent py-1 pointer-events-none \${footerData.verifiedByName?.includes('Rejected') ? 'text-red-600' : 'text-black'}\`}
                                            value={footerData.verifiedByName || ""}
                                            readOnly
                                        />
                                    </div>
                                    <span className="font-normal text-[10px] text-gray-500">(Area In charge)</span>
                                </div>
                            </div>
                        </div>
                    </div>`;

const oldOverallScoreRegex = /\{\/\* Overall Score Assessment Table \*\/\}[\s\S]*?\{\/\* Meta Info Footer \*\/\}/;
content = content.replace(oldOverallScoreRegex, overallScoreTable + '\n\n                    <div className="mt-4 text-[10px] italic">* Procedure refer to product quality: if the defect capturing is less than 100% by employee, need to re-monitor for next 3 days</div>\n\n                    {/* Meta Info Footer */}');

fs.writeFileSync('d:/10Sight Agency/Sarvagaya Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/admin/ThreeDayMonitoringSheet.jsx', content);
console.log('Replacements Done');
