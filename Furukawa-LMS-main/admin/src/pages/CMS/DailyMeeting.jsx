import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
    AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
    IconCalendar, IconFolder, IconFolderOpen, IconChevronDown, IconChevronUp, IconSettings, IconLoader2, IconAlertCircle, IconEye,
    IconPlus, IconPencil, IconTrash, IconArrowLeft, IconClock, IconUser, IconCalendarEvent, IconLock, IconCopy,
    IconFileSpreadsheet, IconRefresh, IconCloud
} from "@tabler/icons-react";
import {
    useGetAllDepartmentsQuery, useGetDailyMeetingConfigQuery, useSaveDailyMeetingConfigMutation,
    useGetDailyMorningMeetingsQuery, useGetDailyMorningMeetingDetailQuery,
    useCreateDailyMorningMeetingMutation, useCloneDailyMorningMeetingMutation,
    useUpdateDailyMorningMeetingMutation, useDeleteDailyMorningMeetingMutation,
    useRefreshDailyMorningMeetingEmbedUrlMutation, useOpenDailyMorningMeetingInM365Mutation,
    useSyncSectionDailyMeetingsFromM365Mutation,
    useSaveDailyMorningMeetingSheetMutation, useLazyGetDailyMorningMeetingM365SnapshotQuery
} from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ExcelClone from "@/components/admin/excelClone/ExcelClone";
import ExcelGraph from "@/components/admin/excelClone/ExcelGraph";
import MicrosoftExcelEmbed from "@/components/admin/m365Excel/MicrosoftExcelEmbed";
import { IconChartBar } from "@tabler/icons-react";

const formatMeetingDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatMeetingTime = (timeStr) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

// Mirrors server/utils/dailyMeetingAccess.util.js — kept in sync so the UI hides
// actions the backend would reject anyway. This is a UX convenience only; the
// server independently re-checks every write, so this never needs to be trusted.
const isDailyMeetingAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);

const hasPermission = (user, permission) => {
    if (isDailyMeetingAdmin(user)) return true;
    return !!user?.customRole?.permissions?.includes(permission);
};

// Reads are permission-only (no department/section lock); writes additionally
// require the user be assigned (directly or via their multi-assignment list)
// to both the section's department and the section itself.
const isUserAssignedToDeptAndSec = (user, departmentId, sectionId) => {
    if (isDailyMeetingAdmin(user)) return true;

    const userSectionIds = new Set([
        user?.sectionId != null ? String(user.sectionId) : null,
        ...(Array.isArray(user?.sections) ? user.sections.map(String) : [])
    ].filter(Boolean));
    const userDeptIds = new Set([
        user?.departmentId != null ? String(user.departmentId) : null,
        ...(Array.isArray(user?.departments) ? user.departments.map(String) : [])
    ].filter(Boolean));

    return userSectionIds.has(String(sectionId)) && userDeptIds.has(String(departmentId));
};

function CreateMeetingDialog({ open, onOpenChange, onCreate, isCreating }) {
    const [agenda, setAgenda] = useState("");
    const [description, setDescription] = useState("");
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (open) {
            setAgenda("");
            setDescription("");
            setNow(new Date());
        }
    }, [open]);

    const handleSubmit = () => {
        if (!agenda.trim()) {
            toast.error("Agenda is required.");
            return;
        }
        onCreate({ agenda: agenda.trim(), description: description.trim() });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>New Daily Morning Meeting</DialogTitle>
                    <DialogDescription>Timestamped to right now — the date and time can't be changed.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</Label>
                            <Input readOnly disabled value={now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} className="bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time</Label>
                            <Input readOnly disabled value={now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} className="bg-slate-50" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Agenda *</Label>
                        <Input value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="e.g. Line 3 downtime review" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes for this meeting" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isCreating} className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5">
                        {isCreating ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null} Create & Open
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditDetailsDialog({ meeting, onOpenChange, onSave, isSaving }) {
    const [agenda, setAgenda] = useState("");
    const [description, setDescription] = useState("");

    useEffect(() => {
        if (meeting) {
            setAgenda(meeting.agenda || "");
            setDescription(meeting.description || "");
        }
    }, [meeting]);

    const handleSubmit = () => {
        if (!agenda.trim()) {
            toast.error("Agenda is required.");
            return;
        }
        onSave({ agenda: agenda.trim(), description: description.trim() });
    };

    return (
        <Dialog open={!!meeting} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Meeting Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Agenda *</Label>
                        <Input value={agenda} onChange={(e) => setAgenda(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5">
                        {isSaving ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null} Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Prefills from the source meeting's agenda/description (both editable before
// saving), but the date/time shown are always "now" — the clone is always
// timestamped at creation time, matching the server (which ignores any
// date/time the client might send and stamps it itself).
function CloneMeetingDialog({ meeting, onOpenChange, onClone, isCloning }) {
    const [agenda, setAgenda] = useState("");
    const [description, setDescription] = useState("");
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        if (meeting) {
            setAgenda(meeting.agenda || "");
            setDescription(meeting.description || "");
            setNow(new Date());
        }
    }, [meeting]);

    const handleSubmit = () => {
        if (!agenda.trim()) {
            toast.error("Agenda is required.");
            return;
        }
        onClone({ agenda: agenda.trim(), description: description.trim() });
    };

    return (
        <Dialog open={!!meeting} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Save As New Meeting</DialogTitle>
                    <DialogDescription>Creates a copy of "{meeting?.agenda}" — same spreadsheet and charts, timestamped to right now.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</Label>
                            <Input readOnly disabled value={now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} className="bg-slate-50" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time</Label>
                            <Input readOnly disabled value={now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} className="bg-slate-50" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Agenda *</Label>
                        <Input value={agenda} onChange={(e) => setAgenda(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isCloning} className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5">
                        {isCloning ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconCopy className="w-4 h-4" />} Save As
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MeetingsTable({ meetings, isLoading, onView, onEdit, onDeleteRequest, onCloneRequest, onOpenM365, openingM365Id, canUpdate, canDelete, canCreate }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <IconLoader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
        );
    }
    if (meetings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <IconCalendarEvent className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No meetings recorded yet.</p>
            </div>
        );
    }
    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-14">Sr. No.</TableHead>
                        <TableHead>Agenda</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-28">Date</TableHead>
                        <TableHead className="w-24">Time</TableHead>
                        <TableHead className="w-40">Created By</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {meetings.map((m, idx) => (
                        <TableRow key={m.id} className="cursor-pointer" onClick={() => onView(m)}>
                            <TableCell className="text-slate-500">{idx + 1}</TableCell>
                            <TableCell className="font-medium text-slate-800">
                                <div className="flex items-center gap-1.5">
                                    <span>{m.agenda}</span>
                                    {m.fileProvider === "M365_SHAREPOINT" && (
                                        <span
                                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full shrink-0"
                                            title="Backed by Microsoft 365 / SharePoint"
                                        >
                                            <IconCloud className="w-2.5 h-2.5" /> M365
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-slate-500 max-w-xs truncate">{m.description || "—"}</TableCell>
                            <TableCell className="text-slate-600 whitespace-nowrap">{formatMeetingDate(m.meetingDate)}</TableCell>
                            <TableCell className="text-slate-600 whitespace-nowrap">{formatMeetingTime(m.meetingTime)}</TableCell>
                            <TableCell className="text-slate-600">{m.createdByName || "—"}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 cursor-pointer"
                                        onClick={() => onOpenM365(m)}
                                        disabled={openingM365Id === m.id}
                                        title="Open in Microsoft Excel Online"
                                    >
                                        {openingM365Id === m.id
                                            ? <IconLoader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                            : <IconFileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
                                    </Button>
                                    {canUpdate && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onEdit(m)} title="Edit spreadsheet">
                                            <IconPencil className="w-3.5 h-3.5 text-slate-500" />
                                        </Button>
                                    )}
                                    {canCreate && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onCloneRequest(m)} title="Save As (Clone)">
                                            <IconCopy className="w-3.5 h-3.5 text-slate-500" />
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer" onClick={() => onDeleteRequest(m)} title="Delete meeting">
                                            <IconTrash className="w-3.5 h-3.5 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

// Owns the ExcelClone ref + live sheet snapshot for one section's daily
// meetings: a list/view/edit space where each meeting gets its own
// independent spreadsheet + chart snapshot instead of one shared sheet.
function SectionMeetingSpace({ sectionId, departmentId }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const authUser = useSelector((state) => state.auth.user);

    // Create/update/delete are gated by both the permission string AND the user
    // actually being assigned to this department+section; admins bypass the
    // assignment check. Read has no department/section lock (permission-only,
    // enforced by the route itself further up the tree).
    const canCreate = hasPermission(authUser, "daily_meeting:create") && isUserAssignedToDeptAndSec(authUser, departmentId, sectionId);
    const canUpdate = hasPermission(authUser, "daily_meeting:update") && isUserAssignedToDeptAndSec(authUser, departmentId, sectionId);
    const canDelete = hasPermission(authUser, "daily_meeting:delete") && isUserAssignedToDeptAndSec(authUser, departmentId, sectionId);

    // Meeting-workspace state (which tab, which meeting, view vs edit) lives in the
    // URL instead of component state, so a refresh (or a shared link) lands the user
    // back where they were instead of resetting to the section's meeting list.
    const activeTab = searchParams.get("mtab") === "all" ? "all" : "month";
    const selectedMeetingId = searchParams.get("meeting") || null;
    // A URL edited by hand to force ?mode=edit still can't bypass canUpdate — this
    // downgrades to view instead of trusting the query string.
    const requestedMode = selectedMeetingId ? (searchParams.get("mode") === "edit" ? "edit" : "view") : "list";
    const mode = requestedMode === "edit" && !canUpdate ? "view" : requestedMode;

    const updateParams = useCallback((updates) => {
        const next = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined) next.delete(key);
            else next.set(key, value);
        });
        setSearchParams(next);
    }, [searchParams, setSearchParams]);

    const [createOpen, setCreateOpen] = useState(false);
    const [editDetailsMeeting, setEditDetailsMeeting] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [cloneTarget, setCloneTarget] = useState(null);
    const [isGraphVisible, setIsGraphVisible] = useState(true);

    const { data: meetingsData, isLoading: isListLoading } = useGetDailyMorningMeetingsQuery({ sectionId }, { skip: !sectionId });
    const meetings = useMemo(() => meetingsData?.data || [], [meetingsData]);
    const monthMeetings = useMemo(() => {
        const now = new Date();
        return meetings.filter((m) => {
            const d = new Date(`${m.meetingDate}T00:00:00`);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });
    }, [meetings]);

    const { data: meetingDetail, isFetching: isDetailLoading } = useGetDailyMorningMeetingDetailQuery(selectedMeetingId, { skip: !selectedMeetingId });
    const selectedMeeting = meetingDetail?.data;

    const excelRef = useRef(null);
    const [excelState, setExcelState] = useState(null);
    const handleChartsChange = useCallback((newCharts) => {
        excelRef.current?.updateCharts(newCharts);
    }, []);

    const [createMeeting, { isLoading: isCreating }] = useCreateDailyMorningMeetingMutation();
    const [cloneMeeting, { isLoading: isCloning }] = useCloneDailyMorningMeetingMutation();
    const [updateMeeting, { isLoading: isUpdating }] = useUpdateDailyMorningMeetingMutation();
    const [deleteMeeting, { isLoading: isDeleting }] = useDeleteDailyMorningMeetingMutation();
    const [refreshEmbedUrl, { isLoading: isRefreshingEmbed }] = useRefreshDailyMorningMeetingEmbedUrlMutation();
    const [openInM365] = useOpenDailyMorningMeetingInM365Mutation();
    const [openingM365Id, setOpeningM365Id] = useState(null);
    const [syncFromM365, { isLoading: isSyncingM365 }] = useSyncSectionDailyMeetingsFromM365Mutation();
    const [saveMeetingSheet] = useSaveDailyMorningMeetingSheetMutation();
    const [fetchM365Snapshot, { isFetching: isLoadingM365Chart }] = useLazyGetDailyMorningMeetingM365SnapshotQuery();

    // M365-backed meetings have no live in-browser editor to pull cell values from
    // (editing happens in a separate Excel Online tab), so the chart is fed by an
    // on-demand snapshot pulled from Microsoft Graph instead of live keystrokes.
    const handleLoadM365Chart = async () => {
        try {
            const res = await fetchM365Snapshot(selectedMeeting.id).unwrap();
            const snapshot = res.data;
            const sheetName = snapshot.sheetName || selectedMeeting.activeSheet || "Sheet 1";
            const existingCharts = selectedMeeting.sheets?.[sheetName]?.charts;
            setExcelState({
                sheets: {
                    [sheetName]: {
                        charts: existingCharts,
                        rowCount: snapshot.rowCount,
                        columnCount: snapshot.columnCount,
                    }
                },
                activeSheetName: sheetName,
                displayGrid: snapshot.displayGrid,
                columnCount: snapshot.columnCount,
                rowCount: snapshot.rowCount,
            });
        } catch (err) {
            toast.error(err?.data?.message || "Failed to load live data from Excel Online.");
        }
    };

    // Chart config (type/columns/colors) has nowhere else to live for a M365
    // meeting — ExcelClone isn't mounted to persist it the way it does for
    // LOCAL_JSON meetings — so this saves straight through the same sheet-save
    // endpoint, merging into whatever sheetData already exists (e.g. from before
    // migration) rather than overwriting it.
    const handleM365ChartsChange = async (newCharts) => {
        // Mirrors ExcelClone's own persistCharts, which no-ops when its `readOnly`
        // prop is set — same rule here since there's no ExcelClone instance mounted
        // to enforce it for a M365-backed meeting.
        if (!excelState || !selectedMeeting || mode !== "edit") return;
        const sheetName = excelState.activeSheetName;
        setExcelState((prev) => prev ? {
            ...prev,
            sheets: { ...prev.sheets, [sheetName]: { ...prev.sheets[sheetName], charts: newCharts } }
        } : prev);
        try {
            const baseSheets = selectedMeeting.sheets || {};
            const nextSheets = {
                ...baseSheets,
                [sheetName]: {
                    ...(baseSheets[sheetName] || { cells: {}, rowCount: excelState.rowCount, columnCount: excelState.columnCount }),
                    charts: newCharts
                }
            };
            await saveMeetingSheet({ meetingId: selectedMeeting.id, sheets: nextSheets, activeSheet: sheetName }).unwrap();
        } catch {
            toast.error("Failed to save chart settings.");
        }
    };

    const openView = (meeting) => updateParams({ meeting: String(meeting.id), mode: "view" });
    const openEdit = (meeting) => updateParams({ meeting: String(meeting.id), mode: "edit" });
    const backToList = () => { updateParams({ meeting: null, mode: null }); setExcelState(null); };

    const handleCreate = async ({ agenda, description }) => {
        try {
            const res = await createMeeting({ sectionId, agenda, description }).unwrap();
            toast.success("Meeting created successfully!");
            setCreateOpen(false);
            openEdit(res.data);
        } catch (err) {
            toast.error("Failed to create meeting. Please try again.");
        }
    };

    const handleClone = async ({ agenda, description }) => {
        try {
            const res = await cloneMeeting({ meetingId: cloneTarget.id, sectionId, agenda, description }).unwrap();
            toast.success("Meeting cloned successfully!");
            setCloneTarget(null);
            openEdit(res.data);
        } catch (err) {
            toast.error("Failed to clone meeting. Please try again.");
        }
    };

    const handleSaveDetails = async ({ agenda, description }) => {
        try {
            await updateMeeting({ meetingId: editDetailsMeeting.id, sectionId, agenda, description }).unwrap();
            toast.success("Meeting details updated!");
            setEditDetailsMeeting(null);
        } catch (err) {
            toast.error("Failed to update meeting details.");
        }
    };

    const handleDelete = async () => {
        try {
            await deleteMeeting({ meetingId: deleteTarget.id, sectionId }).unwrap();
            toast.success("Meeting deleted successfully!");
            if (String(deleteTarget.id) === selectedMeetingId) backToList();
            setDeleteTarget(null);
        } catch (err) {
            toast.error("Failed to delete meeting.");
        }
    };

    // 1-click open: the server auto-provisions the SharePoint workbook on first
    // use and decides edit-vs-view access itself (same department/admin -> edit,
    // everyone else -> read-only) — the client just opens whatever URL comes back.
    const handleOpenInM365 = async (meeting) => {
        setOpeningM365Id(meeting.id);
        try {
            const res = await openInM365({ meetingId: meeting.id }).unwrap();
            window.open(res.url, "_blank", "noopener,noreferrer");
            toast.success(res.mode === "edit" ? "Opening in Excel (Edit mode)" : "Opening in Excel (View-only mode)");
        } catch (err) {
            toast.error(err?.data?.message || "Failed to open in Microsoft Excel.");
        } finally {
            setOpeningM365Id(null);
        }
    };

    // Picks up files created or "Save a Copy"-d directly in Excel Online/SharePoint,
    // which never touch the LMS API on their own — the section's meeting list would
    // otherwise never learn about them.
    const handleSyncFromM365 = async () => {
        try {
            const res = await syncFromM365({ sectionId }).unwrap();
            toast.success(res?.message || "Sync complete.");
        } catch (err) {
            toast.error(err?.data?.message || "Failed to sync with Microsoft Excel.");
        }
    };

    const handleRefreshEmbedUrl = async () => {
        try {
            await refreshEmbedUrl({ meetingId: selectedMeeting.id }).unwrap();
        } catch (err) {
            toast.error(err?.data?.message || "Failed to refresh the Excel embed link.");
        }
    };

    if (mode !== "list") {
        return (
            <div className="space-y-3 p-3">
                <Button variant="outline" size="sm" onClick={backToList} className="cursor-pointer flex items-center gap-1.5">
                    <IconArrowLeft className="w-4 h-4" /> Back to Meetings
                </Button>

                {isDetailLoading && !selectedMeeting ? (
                    <div className="flex items-center justify-center py-16">
                        <IconLoader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    </div>
                ) : selectedMeeting ? (
                    <Card className="border-slate-200/70 shadow-sm">
                        <CardHeader className="pb-3 border-b border-slate-100 bg-white flex flex-row items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <CardTitle className="text-lg font-bold text-slate-800">{selectedMeeting.agenda}</CardTitle>
                                    {mode === "view" && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">View Only</span>
                                    )}
                                </div>
                                {selectedMeeting.description && (
                                    <CardDescription className="mt-1 max-w-2xl">{selectedMeeting.description}</CardDescription>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                                    <span className="flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" /> {formatMeetingDate(selectedMeeting.meetingDate)}</span>
                                    <span className="flex items-center gap-1"><IconClock className="w-3.5 h-3.5" /> {formatMeetingTime(selectedMeeting.meetingTime)}</span>
                                    {selectedMeeting.createdByName && (
                                        <span className="flex items-center gap-1"><IconUser className="w-3.5 h-3.5" /> {selectedMeeting.createdByName}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="cursor-pointer flex items-center gap-1.5 text-slate-600 hover:text-slate-900 border-slate-200"
                                    onClick={() => setIsGraphVisible((v) => !v)}
                                    title={isGraphVisible ? "Hide Charts" : "Show Charts"}
                                >
                                    {isGraphVisible ? <IconChevronUp className="w-4 h-4 text-slate-500" /> : <IconChevronDown className="w-4 h-4 text-slate-500" />}
                                    <span>{isGraphVisible ? "Hide Charts" : "Show Charts"}</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 cursor-pointer flex items-center gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                    onClick={() => handleOpenInM365(selectedMeeting)}
                                    disabled={openingM365Id === selectedMeeting.id}
                                    title="Open this meeting's spreadsheet in Microsoft Excel Online"
                                >
                                    {openingM365Id === selectedMeeting.id ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconFileSpreadsheet className="w-3.5 h-3.5" />} Open in Microsoft Excel
                                </Button>
                                {canUpdate && (
                                    <Button variant="outline" size="sm" className="shrink-0 cursor-pointer flex items-center gap-1.5" onClick={() => setEditDetailsMeeting(selectedMeeting)}>
                                        <IconPencil className="w-3.5 h-3.5" /> Edit Details
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 bg-white">
                            {selectedMeeting.fileProvider === "M365_SHAREPOINT" ? (
                                <>
                                    <div className={cn(
                                        "transition-all duration-300 ease-in-out overflow-hidden bg-slate-50/50 border-b border-slate-100",
                                        isGraphVisible ? "max-h-[500px] opacity-100 p-3" : "max-h-0 opacity-0 p-0 border-b-0"
                                    )}>
                                        {excelState ? (
                                            <ExcelGraph excelData={excelState} onChartsChange={handleM365ChartsChange} />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                                                <p className="text-xs text-slate-500 max-w-xs">
                                                    Charts read a snapshot of this workbook's live values from Microsoft 365 — pull it whenever you want an up-to-date chart.
                                                </p>
                                                <Button size="sm" className="cursor-pointer flex items-center gap-1.5" onClick={handleLoadM365Chart} disabled={isLoadingM365Chart}>
                                                    {isLoadingM365Chart ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconChartBar className="w-3.5 h-3.5" />} Load Chart from Excel
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <MicrosoftExcelEmbed
                                            webUrl={selectedMeeting.m365WebUrl}
                                            title={selectedMeeting.agenda}
                                            onRefresh={canUpdate ? handleRefreshEmbedUrl : undefined}
                                            isRefreshing={isRefreshingEmbed}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={cn(
                                        "transition-all duration-300 ease-in-out overflow-hidden bg-slate-50/50 border-b border-slate-100",
                                        isGraphVisible ? "max-h-[500px] opacity-100 p-3" : "max-h-0 opacity-0 p-0 border-b-0"
                                    )}>
                                        <ExcelGraph excelData={excelState} onChartsChange={handleChartsChange} />
                                    </div>
                                    <ExcelClone ref={excelRef} meetingId={String(selectedMeeting.id)} readOnly={mode === "view"} onDataChange={setExcelState} />
                                </>
                            )}
                        </CardContent>
                    </Card>
                ) : null}

                <EditDetailsDialog
                    meeting={editDetailsMeeting}
                    onOpenChange={(open) => { if (!open) setEditDetailsMeeting(null); }}
                    onSave={handleSaveDetails}
                    isSaving={isUpdating}
                />
            </div>
        );
    }

    return (
        <div className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Daily Morning Meetings</div>
                <div className="flex items-center gap-2">
                    {canUpdate && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncFromM365}
                            disabled={isSyncingM365}
                            className="cursor-pointer flex items-center gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                            title="Pull in files created or copied directly in Microsoft Excel Online"
                        >
                            {isSyncingM365 ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconRefresh className="w-3.5 h-3.5" />} Sync with Excel / M365
                        </Button>
                    )}
                    {canCreate && (
                        <Button size="sm" onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5">
                            <IconPlus className="w-4 h-4" /> Daily Morning Meeting
                        </Button>
                    )}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(val) => updateParams({ mtab: val === "all" ? "all" : null })} className="w-full">
                <TabsList className="bg-slate-100/80 p-1 rounded-lg h-auto border border-slate-200/50 w-fit">
                    <TabsTrigger value="month" className="text-xs font-semibold px-3 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">This Month's Daily Meetings</TabsTrigger>
                    <TabsTrigger value="all" className="text-xs font-semibold px-3 py-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">All Daily Meetings</TabsTrigger>
                </TabsList>
                <TabsContent value="month" className="mt-3">
                    <MeetingsTable meetings={monthMeetings} isLoading={isListLoading} onView={openView} onEdit={openEdit} onDeleteRequest={setDeleteTarget} onCloneRequest={setCloneTarget} onOpenM365={handleOpenInM365} openingM365Id={openingM365Id} canUpdate={canUpdate} canDelete={canDelete} canCreate={canCreate} />
                </TabsContent>
                <TabsContent value="all" className="mt-3">
                    <MeetingsTable meetings={meetings} isLoading={isListLoading} onView={openView} onEdit={openEdit} onDeleteRequest={setDeleteTarget} onCloneRequest={setCloneTarget} onOpenM365={handleOpenInM365} openingM365Id={openingM365Id} canUpdate={canUpdate} canDelete={canDelete} canCreate={canCreate} />
                </TabsContent>
            </Tabs>

            <CreateMeetingDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} isCreating={isCreating} />

            <CloneMeetingDialog
                meeting={cloneTarget}
                onOpenChange={(open) => { if (!open) setCloneTarget(null); }}
                onClone={handleClone}
                isCloning={isCloning}
            />

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{deleteTarget?.agenda}" and its spreadsheet. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white cursor-pointer flex items-center gap-1.5">
                            {isDeleting ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function AdminConfigPanel({ departmentId, sections, allSectionsLoading }) {
    const { data: configData, isLoading: configLoading } = useGetDailyMeetingConfigQuery(departmentId);
    const [saveConfig, { isLoading: isSaving }] = useSaveDailyMeetingConfigMutation();

    const [shutter, setShutter] = useState(false);
    const [selectedSections, setSelectedSections] = useState([]);
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        if (configData?.data) {
            setShutter(!!configData.data.shutter);
            setSelectedSections(configData.data.sections || []);
        }
    }, [configData]);

    const handleSave = async () => {
        try {
            await saveConfig({
                departmentId,
                shutter,
                sections: selectedSections
            }).unwrap();
            toast.success("Daily Meeting settings saved successfully!");
        } catch (err) {
            toast.error("Failed to save settings. Please try again.");
        }
    };

    const handleToggleSection = (sectionId, checked) => {
        if (checked) {
            setSelectedSections(prev => [...prev, sectionId]);
        } else {
            setSelectedSections(prev => prev.filter(id => id !== sectionId));
        }
    };

    if (configLoading || allSectionsLoading) {
        return (
            <div className="flex items-center gap-2 text-slate-500 py-6 text-sm">
                <IconLoader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Loading settings...
            </div>
        );
    }

    return (
        <Card className="border-slate-200 shadow-sm bg-slate-50/50 mb-6">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <IconSettings className="w-5 h-5 text-indigo-600" />
                    <CardTitle className="text-base font-semibold">Settings Configuration (Admin)</CardTitle>
                </div>
                <CardDescription>Customize section visibility for other roles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-100">
                    <div className="space-y-0.5">
                        <Label htmlFor={`shutter-${departmentId}`} className="text-sm font-semibold text-slate-900 cursor-pointer">
                            Enable Section Shutter
                        </Label>
                        <p className="text-xs text-slate-500 max-w-md">
                            When enabled, all sections will be shown automatically. If disabled, only chosen sections below will be visible.
                        </p>
                    </div>
                    <Switch
                        id={`shutter-${departmentId}`}
                        checked={shutter}
                        onCheckedChange={(val) => {
                            setShutter(val);
                            if (val) setSelectedSections([]);
                        }}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Allowed Sections</Label>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                disabled={shutter}
                                className="w-full sm:w-80 h-10 justify-between text-left font-normal border-slate-200 hover:bg-slate-50 bg-white"
                            >
                                <span className="truncate text-slate-700">
                                    {shutter
                                        ? "All Sections (Shutter Enabled)"
                                        : selectedSections.length > 0
                                            ? `${selectedSections.length} Section(s) Selected`
                                            : "Select Sections..."}
                                </span>
                                <IconChevronDown className="h-4 w-4 opacity-50 shrink-0" stroke={2.5} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-2 bg-white border border-slate-200 shadow-md rounded-xl z-50" align="start">
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                {sections.length === 0 ? (
                                    <div className="text-xs text-slate-400 p-2 text-center">No sections configured in this department</div>
                                ) : (
                                    sections.map((sec) => {
                                        const secId = String(sec.id || sec._id);
                                        const isChecked = selectedSections.includes(secId);
                                        return (
                                            <div key={secId} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                                <Checkbox
                                                    id={`sec-${departmentId}-${secId}`}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => handleToggleSection(secId, !!checked)}
                                                />
                                                <label
                                                    htmlFor={`sec-${departmentId}-${secId}`}
                                                    className="text-xs font-medium leading-none cursor-pointer flex-1 truncate text-slate-700 select-none"
                                                >
                                                    {sec.name}
                                                </label>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
                    >
                        {isSaving ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null}
                        Save Configuration
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SectionTabsView({ departmentId, sections, allSectionsLoading, isPreview = false }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const { data: configData, isLoading: configLoading } = useGetDailyMeetingConfigQuery(departmentId);

    const shutter = configData?.data ? !!configData.data.shutter : false;
    const selectedSectionsList = configData?.data?.sections || [];

    const visibleSections = useMemo(() => {
        if (allSectionsLoading) return [];
        if (shutter) return sections;
        return sections.filter(sec => {
            const secId = String(sec.id || sec._id);
            return selectedSectionsList.includes(secId);
        });
    }, [sections, shutter, selectedSectionsList, allSectionsLoading]);

    // Active section tab lives in the URL (?section=) so a refresh re-opens the
    // same section instead of falling back to the first tab.
    const activeSectionId = searchParams.get("section") || "";

    useEffect(() => {
        if (visibleSections.length === 0) return;
        const validIds = visibleSections.map((sec) => String(sec.id || sec._id));
        if (!activeSectionId || !validIds.includes(activeSectionId)) {
            const next = new URLSearchParams(searchParams);
            next.set("section", validIds[0]);
            setSearchParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleSections, activeSectionId]);

    if (configLoading || allSectionsLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (visibleSections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                    <IconAlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">No Sections Active</h4>
                <p className="text-xs text-slate-500 max-w-xs text-center mt-1">
                    {isPreview
                        ? "Enable the shutter or select sections in the panel above to display them."
                        : "Daily Meeting spaces are not currently configured for this department's sections. Please contact an Administrator."}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {isPreview && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                    <IconEye className="w-3.5 h-3.5" />
                    Preview (What Custom Roles See)
                </div>
            )}
            <Tabs
                value={activeSectionId}
                onValueChange={(val) => {
                    const next = new URLSearchParams(searchParams);
                    next.set("section", val);
                    next.delete("mtab");
                    next.delete("meeting");
                    next.delete("mode");
                    setSearchParams(next);
                }}
                className="w-full"
            >
                <TabsList className="flex flex-wrap gap-2 justify-start bg-transparent p-2 rounded-xl mb-4 h-auto w-fit">
                    {visibleSections.map((sec) => {
                        const secId = String(sec.id || sec._id);
                        const isActive = activeSectionId === secId;
                        const FolderIcon = isActive ? IconFolderOpen : IconFolder;
                        return (
                            <TabsTrigger
                                key={secId}
                                value={secId}
                                title={sec.name}
                                className="flex flex-none flex-col items-center gap-1 w-20 h-auto rounded-lg px-2 py-2 whitespace-normal cursor-pointer transition-all hover:bg-slate-100 hover:scale-[1.04] hover:shadow-sm data-[state=active]:bg-indigo-50 data-[state=active]:ring-1 data-[state=active]:ring-indigo-200 data-[state=active]:shadow-none data-[state=active]:hover:bg-indigo-100"
                            >
                                <FolderIcon className={cn("size-8 shrink-0", isActive ? "text-indigo-500" : "text-slate-400")} stroke={1.5} />
                                <span className={cn("text-[11px] font-medium text-center leading-tight line-clamp-2 break-words", isActive ? "text-indigo-700" : "text-slate-600")}>
                                    {sec.name}
                                </span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
                {visibleSections.map((sec) => (
                    <TabsContent key={sec.id || sec._id} value={String(sec.id || sec._id)}>
                        <Card className="border-slate-200/70 shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3 border-b border-slate-100 bg-white">
                                <CardTitle className="text-lg font-bold text-slate-800">{sec.name}</CardTitle>
                                <CardDescription>Section ID: {sec.id || sec._id} • Daily Standup Meeting Sheet</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 bg-white">
                                <SectionMeetingSpace sectionId={String(sec.id || sec._id)} departmentId={departmentId} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

export default function DailyMeeting() {
    const authUser = useSelector((state) => state.auth.user);
    const canReadDailyMeeting = hasPermission(authUser, "daily_meeting:read");
    const { data: deptsData, isLoading, error } = useGetAllDepartmentsQuery({ limit: 500 }, { skip: !canReadDailyMeeting });
    const departments = useMemo(() => deptsData?.data?.departments || [], [deptsData]);

    const isAdmin = useMemo(() => {
        return authUser?.role === 'SUPERADMIN' || authUser?.role === 'ADMIN' || authUser?.isAdmin === 1 || authUser?.isAdmin === true;
    }, [authUser]);

    const [searchParams, setSearchParams] = useSearchParams();

    // Active department tab lives in the URL (?dept=) so a refresh re-opens the same
    // department/section/meeting instead of restarting from the first department.
    const activeDeptId = searchParams.get("dept") || "";

    useEffect(() => {
        if (departments.length === 0) return;
        const validIds = departments.map((d) => String(d.id || d._id));
        if (!activeDeptId || !validIds.includes(activeDeptId)) {
            const next = new URLSearchParams(searchParams);
            next.set("dept", validIds[0]);
            setSearchParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departments, activeDeptId]);

    const { data: sectionsData, isLoading: sectionsLoading } = useGetSectionsByDepartmentQuery(activeDeptId, {
        skip: !activeDeptId
    });
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData]);

    return (
        <div className="space-y-6 w-full pb-20 p-2 md:p-4 min-h-screen">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-200">
                        <IconCalendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Daily Meeting</h1>
                        <p className="text-sm text-slate-500 font-medium">Browse daily standup and metrics by department and section</p>
                    </div>
                </div>
            </div>

            {!canReadDailyMeeting ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                        <IconLock className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Access Denied</h3>
                    <p className="text-sm text-slate-500 max-w-sm text-center mt-2 leading-relaxed">
                        You do not have permission to view Daily Meetings. Contact an administrator if you believe this is a mistake.
                    </p>
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 bg-red-50/50 rounded-3xl border border-red-100 text-red-600">
                    <p className="font-semibold">Failed to load departments</p>
                    <p className="text-sm text-red-500 mt-1">Please try refreshing the page.</p>
                </div>
            ) : departments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                        <IconFolder className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">No Departments Found</h3>
                    <p className="text-sm text-slate-500 max-w-sm text-center mt-2 leading-relaxed">
                        Please create departments first to view tabs.
                    </p>
                </div>
            ) : (
                <Tabs
                    value={activeDeptId}
                    onValueChange={(val) => {
                        const next = new URLSearchParams(searchParams);
                        next.set("dept", val);
                        next.delete("section");
                        next.delete("mtab");
                        next.delete("meeting");
                        next.delete("mode");
                        setSearchParams(next);
                    }}
                    className="w-full"
                >
                    <TabsList className="flex flex-wrap gap-3 justify-start bg-transparent p-2 rounded-xl mb-6 h-auto w-fit">
                        {departments.map((d) => {
                            const deptId = String(d.id || d._id);
                            const isActive = activeDeptId === deptId;
                            const FolderIcon = isActive ? IconFolderOpen : IconFolder;
                            return (
                                <TabsTrigger
                                    key={deptId}
                                    value={deptId}
                                    title={d.name}
                                    className="flex flex-none flex-col items-center gap-1 w-24 h-auto rounded-lg px-3 py-3 whitespace-normal cursor-pointer transition-all hover:bg-slate-100 hover:scale-[1.04] hover:shadow-sm data-[state=active]:bg-indigo-50 data-[state=active]:ring-1 data-[state=active]:ring-indigo-200 data-[state=active]:shadow-none data-[state=active]:hover:bg-indigo-100"
                                >
                                    <FolderIcon className={cn("size-10 shrink-0", isActive ? "text-indigo-500" : "text-slate-400")} stroke={1.5} />
                                    <span className={cn("text-xs font-medium text-center leading-tight line-clamp-2 break-words", isActive ? "text-indigo-700" : "text-slate-600")}>
                                        {d.name}
                                    </span>
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    {departments.map((d) => {
                        const deptId = String(d.id || d._id);
                        return (
                            <TabsContent key={deptId} value={deptId} className="space-y-6">
                                {isAdmin ? (
                                    <>
                                        <AdminConfigPanel
                                            departmentId={deptId}
                                            sections={sections}
                                            allSectionsLoading={sectionsLoading && activeDeptId === deptId}
                                        />
                                        <SectionTabsView
                                            departmentId={deptId}
                                            sections={sections}
                                            allSectionsLoading={sectionsLoading && activeDeptId === deptId}
                                            isPreview={true}
                                        />
                                    </>
                                ) : (
                                    <SectionTabsView
                                        departmentId={deptId}
                                        sections={sections}
                                        allSectionsLoading={sectionsLoading && activeDeptId === deptId}
                                        isPreview={false}
                                    />
                                )}
                            </TabsContent>
                        );
                    })}
                </Tabs>
            )}
        </div>
    );
}
