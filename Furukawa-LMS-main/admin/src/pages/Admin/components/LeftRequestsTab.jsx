import React, { useState } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  IconCheck,
  IconX,
  IconClock,
  IconLoader,
  IconUserX,
  IconInfoCircle,
} from "@tabler/icons-react";
import { safeDateFormat } from "@/utils/dateUtils";
import {
  useGetAllLeftRequestsQuery,
  useApproveLeftRequestMutation,
  useRejectLeftRequestMutation,
  useCancelLeftRequestMutation,
} from "@/Redux/AllApi/LeftRequestApi";

const STATUS_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

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

const statusBadge = (status) => {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit animate-pulse">
          <IconClock className="h-3 w-3" /> Pending
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge className="bg-green-100 text-green-800 border border-green-200 flex items-center gap-1 w-fit">
          <IconCheck className="h-3 w-3" /> Approved
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge className="bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 w-fit">
          <IconX className="h-3 w-3" /> Rejected
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
          Withdrawn
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

// currentUserId: the logged-in reviewer/requester's id, used to allow a requester to withdraw
// their own pending request even without approve permission.
// onChanged: called after an approve/reject/cancel so the parent Students list (whose status
// badge for that operator just changed) can refetch.
const LeftRequestsTab = ({ canApproveLeft, currentUserId, onChanged }) => {
  const [statusTab, setStatusTab] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveReason, setApproveReason] = useState("");
  const [approveCustomReason, setApproveCustomReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);

  const { data, isLoading, isFetching, refetch } = useGetAllLeftRequestsQuery({
    status: statusTab,
    page,
    limit: 20,
  });

  const [approveLeftRequest, { isLoading: isApproving }] = useApproveLeftRequestMutation();
  const [rejectLeftRequest, { isLoading: isRejecting }] = useRejectLeftRequestMutation();
  const [cancelLeftRequest, { isLoading: isCancelling }] = useCancelLeftRequestMutation();

  const requests = data?.data?.rows || [];
  const totalPages = data?.data?.totalPages || 1;
  const total = data?.data?.total || 0;

  const openApprove = (request) => {
    setApproveTarget(request);
    const existingReason = request.reasonOfLeaving || "";
    if (existingReason && !LEAVING_REASONS.includes(existingReason)) {
      setApproveReason("Other");
      setApproveCustomReason(existingReason);
    } else {
      setApproveReason(existingReason);
      setApproveCustomReason("");
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    if (!approveReason) {
      toast.error("Please select a reason of leaving");
      return;
    }
    if (approveReason === "Other" && !approveCustomReason.trim()) {
      toast.error("Please specify the reason of leaving");
      return;
    }
    const reasonOfLeaving = (approveReason === "Other" ? approveCustomReason : approveReason).trim();
    try {
      await approveLeftRequest({ id: approveTarget.id, reasonOfLeaving }).unwrap();
      toast.success(`${approveTarget.fullName} marked as left`);
      setApproveTarget(null);
      refetch();
      onChanged?.();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to approve left request");
    }
  };

  const openReject = (request) => {
    setRejectTarget(request);
    setRejectionReason("");
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    try {
      await rejectLeftRequest({ id: rejectTarget.id, rejectionReason: rejectionReason.trim() }).unwrap();
      toast.success("Left request rejected");
      setRejectTarget(null);
      refetch();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to reject left request");
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelLeftRequest(cancelTarget.id).unwrap();
      toast.success("Left request withdrawn");
      setCancelTarget(null);
      refetch();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to withdraw left request");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={statusTab === tab.value ? "default" : "outline"}
            onClick={() => { setStatusTab(tab.value); setPage(1); }}
            className={statusTab === tab.value ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
          >
            {tab.label}
          </Button>
        ))}
        {isFetching && <IconLoader className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operator</TableHead>
              <TableHead>Department / Section</TableHead>
              <TableHead>Leaving Details</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <IconLoader className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading left requests...
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <IconInfoCircle className="h-5 w-5 mx-auto mb-2" />
                  No {statusTab !== "ALL" ? statusTab.toLowerCase() : ""} left requests found
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => {
                const canWithdraw = request.status === "PENDING" &&
                  (canApproveLeft || String(request.requestedBy) === String(currentUserId));
                return (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                            {(request.fullName || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium leading-tight">{request.fullName}</p>
                          <p className="text-xs text-muted-foreground">{request.empId || "-"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{request.departmentName || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[request.sectionName, request.lineName].filter(Boolean).join(" / ") || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">
                        {request.leavingDate ? safeDateFormat(request.leavingDate, "dd/MM/yyyy") : "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">{request.reasonOfLeaving}</div>
                      {request.remarks && (
                        <div className="text-xs text-muted-foreground italic mt-0.5">"{request.remarks}"</div>
                      )}
                      {request.status === "REJECTED" && request.rejectionReason && (
                        <div className="text-xs text-red-600 mt-0.5">Reason: {request.rejectionReason}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{request.requestedByName || "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {request.requestedByRole} · {request.createdAt ? safeDateFormat(request.createdAt, "dd/MM/yyyy") : ""}
                      </div>
                      {request.reviewedByName && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Reviewed by {request.reviewedByName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(request.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {request.status === "PENDING" && canApproveLeft && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openApprove(request)}
                              disabled={isApproving}
                              className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs"
                            >
                              <IconCheck className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openReject(request)}
                              disabled={isRejecting}
                              className="h-7 px-2 text-xs"
                            >
                              <IconX className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {canWithdraw && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCancelTarget(request)}
                            disabled={isCancelling}
                            className="h-7 px-2 text-xs"
                          >
                            <IconUserX className="h-3.5 w-3.5 mr-1" /> Withdraw
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <IconX className="h-5 w-5" />
              Reject Left Request
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting the left request for <strong>{rejectTarget?.fullName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isRejecting || !rejectionReason.trim()}
              className="gap-2"
            >
              {isRejecting && <IconLoader className="h-4 w-4 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(open) => {
          if (!open) {
            setApproveTarget(null);
            setApproveReason("");
            setApproveCustomReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <IconCheck className="h-5 w-5" />
              Approve Left Request
            </DialogTitle>
            <DialogDescription>
              Approve the left request for <strong>{approveTarget?.fullName}</strong>? Their status will be
              changed to LEFT with a leaving date of{" "}
              <strong>{approveTarget?.leavingDate ? safeDateFormat(approveTarget.leavingDate, "dd/MM/yyyy") : "-"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="approveReason">Reason of Leaving</Label>
            <Select value={approveReason} onValueChange={setApproveReason}>
              <SelectTrigger id="approveReason">
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                {LEAVING_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {approveReason === "Other" && (
              <Textarea
                value={approveCustomReason}
                onChange={(e) => setApproveCustomReason(e.target.value)}
                placeholder="Please specify the reason"
                rows={2}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving || !approveReason || (approveReason === "Other" && !approveCustomReason.trim())}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {isApproving && <IconLoader className="h-4 w-4 animate-spin" />}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUserX className="h-5 w-5" />
              Withdraw Left Request
            </DialogTitle>
            <DialogDescription>
              Withdraw the left request for <strong>{cancelTarget?.fullName}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isCancelling}
              className="gap-2"
            >
              {isCancelling && <IconLoader className="h-4 w-4 animate-spin" />}
              Confirm Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeftRequestsTab;
