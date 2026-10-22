import React from 'react';

// Full-width red strip rendered beneath a rejected row of the 5M recording sheet.
const RejectReasonRow = React.memo(({ colSpan, rowNo, reason, actionBy, actionAt }) => (
    <tr className="bg-red-50" data-reject-row={rowNo}>
        <td colSpan={colSpan} className="border border-black px-2 py-1 text-left text-[13px] text-red-700">
            <span className="font-bold uppercase">Row {rowNo} rejected:</span>{' '}
            <span className="whitespace-pre-wrap break-words">
                {reason || <em className="text-red-400">No reason recorded (rejected before reasons were required)</em>}
            </span>
            {actionBy && (
                <span className="ml-2 text-[11px] text-red-500/80">
                    by {actionBy}{actionAt && ` · ${new Date(actionAt).toLocaleString()}`}
                </span>
            )}
        </td>
    </tr>
));

RejectReasonRow.displayName = 'RejectReasonRow';

export default RejectReasonRow;
