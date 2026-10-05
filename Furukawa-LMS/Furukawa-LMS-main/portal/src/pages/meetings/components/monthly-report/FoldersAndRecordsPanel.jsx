import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Folder, FolderPlus, FileText, Plus, Calendar, Eye, Search, ChevronRight, ArrowLeft, Trash2
} from "lucide-react";
import { IconLoader2, IconAlertTriangle, IconClockHour4 } from "@tabler/icons-react";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
    AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel
} from "@/components/common/ui/alert-dialog.jsx";
import {
    useGetMonthlyReportFoldersQuery, useDeleteMonthlyReportFolderMutation,
    useGetMonthlyReportRecordsQuery, useDeleteMonthlyReportRecordMutation,
    useGetMonthlyReportRecordDetailQuery,
} from "@/services/api/MonthlyMeetingReportApi.js";
import CreateFolderDialog from "./CreateFolderDialog.jsx";
import UploadRecordDialog from "./UploadRecordDialog.jsx";
import PresentationViewer from "./PresentationViewer.jsx";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = [String(new Date().getFullYear() - 1), String(new Date().getFullYear()), String(new Date().getFullYear() + 1)];

const FOLDER_COLORS = {
    amber: { bg: "bg-amber-50", text: "text-amber-600", iconBg: "bg-amber-100" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", iconBg: "bg-emerald-100" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", iconBg: "bg-indigo-100" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", iconBg: "bg-blue-100" },
};
const getFolderColors = (color) => FOLDER_COLORS[color] || FOLDER_COLORS.blue;

const CONVERSION_BADGE = {
    PENDING: { label: "Queued", className: "bg-slate-100 text-slate-600" },
    PROCESSING: { label: "Converting…", className: "bg-amber-50 text-amber-700" },
    DONE: { label: "Ready", className: "bg-emerald-50 text-emerald-700" },
    FAILED: { label: "Failed", className: "bg-rose-50 text-rose-700" },
};

const isInFlight = (records) => records.some((r) => r.conversionStatus === "PENDING" || r.conversionStatus === "PROCESSING");

export default function FoldersAndRecordsPanel({ departmentId, sectionId, canCreate, canDelete }) {
    const [activeFolderId, setActiveFolderId] = useState(null);
    const [activeRecordId, setActiveRecordId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterMonth, setFilterMonth] = useState("All");
    const [filterYear, setFilterYear] = useState("All");
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [showUploadRecord, setShowUploadRecord] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'folder'|'record', id, folderId?, label }

    const { data: foldersData, isLoading: foldersLoading } = useGetMonthlyReportFoldersQuery(sectionId, { skip: !sectionId });
    const folders = useMemo(() => foldersData?.data || [], [foldersData]);
    const activeFolder = folders.find((f) => f.id === activeFolderId);

    // Keep the record table's conversion-status badges fresh without a manual
    // refresh, but only poll while at least one record in this folder is still
    // converting. `pollRecords` trails one render behind the data it's derived
    // from (set in the effect below) so the same query call can both produce
    // the data and read back its own "still converting?" verdict to decide
    // whether to keep polling — RTK Query stops the interval as soon as this
    // flips back to false.
    const [pollRecords, setPollRecords] = useState(false);
    const { data: recordsData, isLoading: recordsLoading } = useGetMonthlyReportRecordsQuery(activeFolderId, {
        skip: !activeFolderId,
        pollingInterval: pollRecords ? 4000 : 0,
    });
    const records = useMemo(() => recordsData?.data || [], [recordsData]);

    useEffect(() => {
        setPollRecords(isInFlight(records));
    }, [records]);

    const activeRecordFromList = records.find((r) => r.id === activeRecordId);
    const { data: recordDetailData } = useGetMonthlyReportRecordDetailQuery(activeRecordId, {
        skip: !activeRecordId,
        pollingInterval: activeRecordFromList && (activeRecordFromList.conversionStatus === "PENDING" || activeRecordFromList.conversionStatus === "PROCESSING") ? 3000 : 0,
    });
    const activeRecord = recordDetailData?.data || activeRecordFromList;

    const [deleteFolder, { isLoading: isDeletingFolder }] = useDeleteMonthlyReportFolderMutation();
    const [deleteRecord, { isLoading: isDeletingRecord }] = useDeleteMonthlyReportRecordMutation();

    const filteredFolders = folders.filter((f) => {
        if (!searchQuery.trim()) return true;
        return f.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const filteredRecords = records.filter((r) => {
        const matchesMonth = filterMonth === "All" || r.month === filterMonth;
        const matchesYear = filterYear === "All" || r.year === filterYear;
        const matchesQuery = !searchQuery.trim() || r.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesMonth && matchesYear && matchesQuery;
    });

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            if (deleteTarget.type === "folder") {
                await deleteFolder({ folderId: deleteTarget.id, sectionId }).unwrap();
                toast.success("Folder deleted successfully!");
                if (activeFolderId === deleteTarget.id) setActiveFolderId(null);
            } else {
                await deleteRecord({ recordId: deleteTarget.id, folderId: deleteTarget.folderId }).unwrap();
                toast.success("Record deleted successfully!");
                if (activeRecordId === deleteTarget.id) setActiveRecordId(null);
            }
            setDeleteTarget(null);
        } catch (err) {
            toast.error(err?.message || "Failed to delete.");
        }
    };

    if (activeRecordId) {
        return (
            <PresentationViewer
                record={activeRecord}
                onBack={() => setActiveRecordId(null)}
            />
        );
    }

    return (
        <div className="flex flex-col gap-5 flex-1 min-h-0">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {activeFolder ? (
                        <>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => { setActiveFolderId(null); setSearchQuery(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-bold transition-colors border border-slate-200 cursor-pointer">
                                    <ArrowLeft size={14} /><span>All Folders</span>
                                </button>
                                <ChevronRight size={14} className="text-slate-400" />
                                <div className="flex items-center gap-2">
                                    <Folder size={17} className="text-indigo-600" />
                                    <span className="text-sm font-extrabold text-slate-800">{activeFolder.name}</span>
                                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">{activeFolder.recordCount} PPTs</span>
                                </div>
                            </div>
                            <div className="relative min-w-[200px] ml-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Search in this folder..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-400 text-slate-800" />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-500">Month:</span>
                                <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 cursor-pointer">
                                    <option value="All">All Months</option>
                                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-500">Year:</span>
                                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 cursor-pointer">
                                    <option value="All">All Years</option>
                                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </>
                    ) : (
                        <div className="relative min-w-[260px]">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search folders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-400 text-slate-800" />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                    {!activeFolder ? (
                        canCreate && (
                            <button type="button" onClick={() => setShowCreateFolder(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer">
                                <FolderPlus size={16} /><span>Create Folder</span>
                            </button>
                        )
                    ) : (
                        canCreate && (
                            <button type="button" onClick={() => setShowUploadRecord(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer">
                                <Plus size={16} /><span>Add PPT to {activeFolder.name}</span>
                            </button>
                        )
                    )}
                </div>
            </div>

            {!activeFolder ? (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                        <div className="flex items-center gap-2"><Folder size={18} className="text-indigo-600" /><h3 className="text-[15px] font-bold text-slate-800">Presentation Folders</h3></div>
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{filteredFolders.length} folders</span>
                    </div>

                    {foldersLoading ? (
                        <div className="flex items-center justify-center py-16"><IconLoader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                    ) : filteredFolders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center my-auto">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-indigo-600 flex items-center justify-center mb-3 border border-blue-100"><FolderPlus size={28} /></div>
                            <h4 className="text-sm font-bold text-slate-800">No folders created yet</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mb-4">Organize monthly presentations into structured folders.</p>
                            {canCreate && (
                                <button type="button" onClick={() => setShowCreateFolder(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm cursor-pointer">
                                    <FolderPlus size={16} /><span>Create First Folder</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredFolders.map((folder) => {
                                const colors = getFolderColors(folder.color);
                                return (
                                    <div key={folder.id} onClick={() => setActiveFolderId(folder.id)} className="group border border-slate-200 hover:border-indigo-200 bg-white hover:bg-slate-50 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-11 h-11 rounded-xl ${colors.iconBg} ${colors.text} flex items-center justify-center group-hover:scale-105 transition-transform`}><Folder size={22} /></div>
                                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">{folder.recordCount} PPTs</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1">{folder.name}</h4>
                                            <p className="text-[11px] text-slate-500">Created {new Date(folder.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-indigo-600 group-hover:underline flex items-center gap-1"><span>Open Folder</span><ChevronRight size={13} /></span>
                                            {canDelete && (
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "folder", id: folder.id, label: folder.name }); }} className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer" title="Delete Folder">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2"><FileText size={17} className="text-indigo-600" /><h3 className="text-[14.5px] font-bold text-slate-800">{activeFolder.name} — Presentations</h3></div>
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{filteredRecords.length} records</span>
                    </div>

                    {recordsLoading ? (
                        <div className="flex items-center justify-center py-16"><IconLoader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center my-auto">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3"><FileText size={24} /></div>
                            <h4 className="text-sm font-bold text-slate-800">No presentations in this folder</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mb-4">Upload a PowerPoint deck to get started.</p>
                            {canCreate && (
                                <button type="button" onClick={() => setShowUploadRecord(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm cursor-pointer">
                                    <Plus size={16} /><span>Upload PPT to {activeFolder.name}</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-3 px-5">Presentation Name</th>
                                        <th className="py-3 px-4">Period</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Slides</th>
                                        <th className="py-3 px-4">Added Date</th>
                                        <th className="py-3 px-5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[13px]">
                                    {filteredRecords.map((item) => {
                                        const badge = CONVERSION_BADGE[item.conversionStatus] || CONVERSION_BADGE.PENDING;
                                        const isReady = item.conversionStatus === "DONE";
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setActiveRecordId(item.id)}>
                                                <td className="py-3.5 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"><FileText size={17} /></div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.title}</div>
                                                            <div className="text-[11px] text-slate-400">{item.originalFileName}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-slate-800">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs"><Calendar size={12} />{item.month} {item.year}</span>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${badge.className}`}>
                                                        {item.conversionStatus === "PROCESSING" && <IconLoader2 className="w-3 h-3 animate-spin" />}
                                                        {item.conversionStatus === "PENDING" && <IconClockHour4 className="w-3 h-3" />}
                                                        {item.conversionStatus === "FAILED" && <IconAlertTriangle className="w-3 h-3" />}
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-slate-800">{item.slideCount} slides</td>
                                                <td className="py-3.5 px-4 text-slate-500">{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                                                <td className="py-3.5 px-5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button type="button" disabled={!isReady && item.conversionStatus !== "FAILED"} onClick={(e) => { e.stopPropagation(); setActiveRecordId(item.id); }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                                                            <Eye size={13} /><span>Open</span>
                                                        </button>
                                                        {canDelete && (
                                                            <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "record", id: item.id, folderId: activeFolder.id, label: item.title }); }} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer" title="Delete record">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <CreateFolderDialog open={showCreateFolder} onOpenChange={setShowCreateFolder} departmentId={departmentId} sectionId={sectionId} />
            {activeFolder && <UploadRecordDialog open={showUploadRecord} onOpenChange={setShowUploadRecord} folderId={activeFolder.id} />}

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {deleteTarget?.type === "folder" ? "this folder" : "this record"}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.type === "folder"
                                ? `This will permanently delete "${deleteTarget?.label}" and every presentation inside it. This action cannot be undone.`
                                : `This will permanently delete "${deleteTarget?.label}". This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeletingFolder || isDeletingRecord} className="bg-red-600 hover:bg-red-700 text-white cursor-pointer flex items-center gap-1.5">
                            {(isDeletingFolder || isDeletingRecord) ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null} Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
