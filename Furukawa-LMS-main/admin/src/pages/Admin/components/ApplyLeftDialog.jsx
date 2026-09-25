import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader, IconUserMinus } from "@tabler/icons-react";
import {
  useApplyLeftRequestMutation,
  useBulkApplyLeftRequestMutation,
} from "@/Redux/AllApi/LeftRequestApi";

const LEAVING_REASONS = [
  "Employee not response",
  "Exam",
  "Family Function",
  "Marriage",
  "Family Problem",
  "Festival",
  "Health Problem",
  "Join other company",
  "Indiscipline case",
];

// targets: array of { id, fullName, empId } -- length 1 for a single operator, or several for a bulk apply
const ApplyLeftDialog = ({ open, onOpenChange, targets = [], onSuccess }) => {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [remarks, setRemarks] = useState("");

  const [applyLeftRequest, { isLoading: isApplying }] = useApplyLeftRequestMutation();
  const [bulkApplyLeftRequest, { isLoading: isBulkApplying }] = useBulkApplyLeftRequestMutation();
  const isSubmitting = isApplying || isBulkApplying;
  const isBulk = targets.length > 1;

  useEffect(() => {
    if (open) {
      setDate(format(new Date(), "yyyy-MM-dd"));
      setReason("");
      setCustomReason("");
      setRemarks("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!date) { toast.error("Please select a date of leaving"); return; }
    if (!reason) { toast.error("Please select a reason of leaving"); return; }
    if (reason === "Other" && !customReason.trim()) { toast.error("Please specify the reason of leaving"); return; }
    if (targets.length === 0) { toast.error("No operator selected"); return; }

    const reasonOfLeavingByDept = (reason === "Other" ? customReason : reason).trim();

    try {
      if (isBulk) {
        const result = await bulkApplyLeftRequest({
          ids: targets.map((t) => t.id),
          leavingDate: date,
          reasonOfLeavingByDept,
          remarks: remarks.trim() || undefined,
        }).unwrap();
        const created = result?.data?.created?.length ?? 0;
        const skipped = result?.data?.skipped?.length ?? 0;
        toast.success(`${created} left request(s) submitted${skipped ? `, ${skipped} skipped` : ""}`);
      } else {
        await applyLeftRequest({
          userId: targets[0]?.id,
          leavingDate: date,
          reasonOfLeavingByDept,
          remarks: remarks.trim() || undefined,
        }).unwrap();
        toast.success("Left request submitted for approval");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to submit left request");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <IconUserMinus className="h-5 w-5" />
            {isBulk ? "Apply for Left (Bulk)" : "Apply for Left"}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `This will submit a left request for ${targets.length} selected operators. Their status stays active until an approver reviews it.`
              : `This will submit a left request for ${targets[0]?.fullName || "this operator"}. Their status stays active until an approver reviews it.`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="applyLeftDate">Date of Leaving</Label>
            <Input
              id="applyLeftDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="applyLeftReason">Reason of Leaving (Department)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="applyLeftReason">
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                {LEAVING_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please specify the reason"
                rows={2}
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="applyLeftRemarks">Remarks (optional)</Label>
            <Textarea
              id="applyLeftRemarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes for the reviewer"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !date || !reason || (reason === "Other" && !customReason.trim())}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSubmitting && <IconLoader className="h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplyLeftDialog;
