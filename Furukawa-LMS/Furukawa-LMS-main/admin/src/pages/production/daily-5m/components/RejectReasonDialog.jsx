import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/common/ui/dialog.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Textarea } from "@/components/forms/primitives/textarea.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { IconX } from "@tabler/icons-react";
import { REJECT_REASON_MAX, validateRejectReason, normalizeRejectReason } from "../../../../../../shared/daily5mRowStatus.js";

// Asks for the reason before a 5M row is rejected. `rowIndex` is null while closed.
const RejectReasonDialog = ({ rowIndex, onConfirm, onCancel }) => {
    const open = rowIndex !== null && rowIndex !== undefined;
    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
            <DialogContent className="sm:max-w-[480px]">
                {/* Keyed by row so the text resets for every rejection */}
                {open && <RejectReasonForm key={rowIndex} rowNo={rowIndex + 1} onConfirm={onConfirm} onCancel={onCancel} />}
            </DialogContent>
        </Dialog>
    );
};

const RejectReasonForm = ({ rowNo, onConfirm, onCancel }) => {
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const error = validateRejectReason(reason);
    const length = normalizeRejectReason(reason).length;

    const submit = () => {
        setTouched(true);
        if (!error) onConfirm(normalizeRejectReason(reason));
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-600">
                        <IconX size={16} className="stroke-[3]" />
                    </span>
                    Reject Row {rowNo}
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
                <Label htmlFor="reject-reason-input" className="text-sm font-semibold text-slate-700">
                    Reason for rejection <span className="text-red-500">*</span>
                </Label>
                <Textarea
                    id="reject-reason-input"
                    autoFocus
                    placeholder="e.g. Lot number does not match the traveller card."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onBlur={() => setTouched(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
                    rows={4}
                    maxLength={REJECT_REASON_MAX}
                    className="resize-none text-sm"
                />
                <div className="flex justify-between text-xs">
                    <span className="text-red-500">{touched && error}</span>
                    <span className={length > REJECT_REASON_MAX - 30 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                        {length}/{REJECT_REASON_MAX}
                    </span>
                </div>
            </div>
            <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button disabled={!!error} className="bg-red-600 hover:bg-red-700 text-white" onClick={submit}>
                    Reject Row
                </Button>
            </DialogFooter>
        </>
    );
};

export default RejectReasonDialog;
