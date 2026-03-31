"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Search,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  RotateCw,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { usePrivileges } from "@/hooks/usePrivileges";
import MailManagementModal from "./AddMailRequirementChanges";
import * as XLSX from "xlsx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTHS_SHORT = {
  January: "Jan",
  February: "Feb",
  March: "Mar",
  April: "Apr",
  May: "May",
  June: "Jun",
  July: "Jul",
  August: "Aug",
  September: "Sep",
  October: "Oct",
  November: "Nov",
  December: "Dec",
};

const PAGE_SIZE = 10;

const safeNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeMonth = (m) => {
  if (!m && m !== 0) return null;

  if (typeof m === "number") return MONTHS[m - 1] || null;

  const str = String(m).trim();
  if (!str) return null;

  const asNum = Number(str);
  if (Number.isFinite(asNum) && asNum >= 1 && asNum <= 12) return MONTHS[asNum - 1];

  const key3 = str.slice(0, 3).toLowerCase();
  return MONTHS.find((mm) => mm.slice(0, 3).toLowerCase() === key3) || null;
};

const makeGroupKey = (req) => {
  const sectionCode = req?.sectionCode || "";
  const lineCode = req?.lineCode || "";
  const year = req?.year || "";
  return `${sectionCode}||${lineCode}||${year}`;
};

export default function SetRequirements() {
  const { hasPrivilege } = usePrivileges();
  const canManageRequirements = hasPrivilege("setrequirement");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [departments, setDepartments] = useState([]);
  const [sections, setSections] = useState([]);
  const [filterState, setFilterState] = useState({
    section: "",
    sub_section: "",
    search: "",
    dateRange: undefined,
  });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [isMailModalOpen, setIsMailModalOpen] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axiosInstance.get("/api/departments");
        if (res.data?.success) setDepartments(res.data.data.departments || []);
      } catch (e) {
        console.error(e);
        setDepartments([]);
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    const fetchSections = async () => {
      if (!filterState.section || filterState.section === "all") {
        setSections([]);
        return;
      }

      const selected = departments.find((d) => d.name === filterState.section);
      if (!selected) return;

      try {
        const res = await axiosInstance.get(`/api/lines?sectionId=${selected.id}`);
        if (res.data?.success) setSections(res.data.data || []);
      } catch (e) {
        console.error(e);
        setSections([]);
      }
    };
    fetchSections();
  }, [filterState.section, departments]);

  const handleFilterChange = (key, value) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const groupRequirements = (list) => {
    const map = new Map();

    for (const req of list || []) {
      const key = makeGroupKey(req);

      if (!map.has(key)) {
        const monthData = {};
        const monthIds = {};

        for (const m of MONTHS) {
          monthData[m] = { salesPlan: null, prodPlan: null };
          monthIds[m] = [];
        }

        map.set(key, {
          key,
          sectionCode: req?.sectionCode || "",
          sectionName: req?.sectionName || "",
          lineCode: req?.lineCode || "",
          lineDescription: req?.lineDescription || "",
          year: req?.year || "",
          monthData,
          monthIds,
        });
      }

      const row = map.get(key);
      const month = normalizeMonth(req?.monthName);

      if (month && MONTHS.includes(month)) {
        const sp = safeNum(req?.salesPlan);
        const pp = safeNum(req?.prodPlan);

        row.monthData[month].salesPlan = sp;
        row.monthData[month].prodPlan = pp;

        if (req?.id) row.monthIds[month].push(req.id);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  };

  const fetchAllRequirements = async () => {
    setLoading(true);
    try {
      const baseParams = {
        page: 1,
        limit: 500,
        section:
          filterState.section && filterState.section !== "all"
            ? filterState.section
            : undefined,
        sub_section:
          filterState.sub_section && filterState.sub_section !== "all"
            ? filterState.sub_section
            : undefined,
        search: filterState.search || "",
        startDate: filterState.dateRange?.from
          ? filterState.dateRange.from.toISOString().split("T")[0]
          : undefined,
        endDate: filterState.dateRange?.to
          ? filterState.dateRange.to.toISOString().split("T")[0]
          : undefined,
      };

      const first = await axiosInstance.get("/api/requirements", { params: baseParams });
      const firstData = first?.data?.data?.data || [];
      const pagination = first?.data?.data?.pagination || {};
      const total = Number(pagination.totalPages || 1);

      let all = [...firstData];
      for (let p = 2; p <= total; p++) {
        const res = await axiosInstance.get("/api/requirements", {
          params: { ...baseParams, page: p },
        });
        all = all.concat(res?.data?.data?.data || []);
      }

      const grouped = groupRequirements(all);
      setRows(grouped);
      setTotalItems(grouped.length);
      setTotalPages(Math.max(1, Math.ceil(grouped.length / PAGE_SIZE)));
    } catch (e) {
      console.error(e);
      setRows([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchAllRequirements(), 400);
    return () => clearTimeout(t);
  }, [filterState.section, filterState.sub_section, filterState.search, filterState.dateRange]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    setTotalPages(tp);
    setTotalItems(rows.length);
    if (page > tp) setPage(tp);
  }, [rows, page]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return toast.error("Please select a file");
    if (!canManageRequirements) return toast.error("You don't have privilege to upload.");

    setUploading(true);
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      let headerRowIdx = -1;
      let sectionCodeIdx = -1;

      for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
        const row = jsonData[i];
        if (!row) continue;
        const stringRow = row.map((c) => String(c || "").trim().toLowerCase());
        const scIdx = stringRow.findIndex((s) => s.includes("section code"));

        if (scIdx !== -1) {
          headerRowIdx = i;
          sectionCodeIdx = scIdx;
          break;
        }
      }

      if (headerRowIdx === -1) {
        setUploading(false);
        return toast.error("Invalid file format. 'Section Code' header missing.");
      }

      const clientErrors = [];
      for (let i = headerRowIdx + 2; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const rawSectionCode = row[sectionCodeIdx] ? String(row[sectionCodeIdx]).trim() : "";
        if (rawSectionCode && rawSectionCode.toLowerCase() === "section code") continue;

        const hasData = row.some(
          (val, idx) => idx !== sectionCodeIdx && val !== null && val !== "" && val !== undefined
        );
        if (hasData && !rawSectionCode) {
          clientErrors.push(`Row ${i + 1}: Missing Section Code for data row.`);
        }
      }

      if (clientErrors.length > 0) {
        setUploading(false);
        const errorMsg =
          clientErrors.slice(0, 5).join("\n") +
          (clientErrors.length > 5 ? `\n...and ${clientErrors.length - 5} more.` : "");
        return toast.error(<div className="whitespace-pre-wrap">{errorMsg}</div>, {
          duration: 6000,
        });
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      await axiosInstance.post("/api/requirements/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Requirements uploaded successfully");
      setIsUploadOpen(false);
      setSelectedFile(null);
      await fetchAllRequirements();
    } catch (e) {
      console.error(e);
      const errMsg = e?.response?.data?.message || "Upload failed";
      toast.error(<div className="whitespace-pre-wrap">{errMsg}</div>, { duration: 8000 });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteRow = async (row) => {
    if (!row) return;
    if (!canManageRequirements) return toast.error("You don't have privilege to delete.");
    if (!confirm("Delete this entire entry (all 12 months)?")) return;

    try {
      const idsToDelete = MONTHS.flatMap((m) => row.monthIds?.[m] || []);
      if (idsToDelete.length === 0) return toast.info("No records to delete");

      await Promise.all(idsToDelete.map((id) => axiosInstance.delete(`/api/requirements/${id}`)));
      toast.success("Entry deleted");
      await fetchAllRequirements();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to delete entry");
    }
  };

  const openEditRow = (row) => {
    setCurrentRow(row);

    const copiedMonthData = {};
    for (const m of MONTHS) {
      copiedMonthData[m] = {
        salesPlan: row?.monthData?.[m]?.salesPlan ?? null,
        prodPlan: row?.monthData?.[m]?.prodPlan ?? null,
      };
    }

    setEditForm({
      ...row,
      monthData: copiedMonthData,
    });
    setEditModalOpen(true);
  };

  const handleEditMonthChange = (month, field, value) => {
    setEditForm((prev) => ({
      ...prev,
      monthData: {
        ...(prev?.monthData || {}),
        [month]: {
          ...(prev?.monthData?.[month] || { salesPlan: null, prodPlan: null }),
          [field]: value === "" ? null : value,
        },
      },
    }));
  };

  const handleSaveRowEdit = async () => {
    if (!currentRow || !editForm) return;
    if (!canManageRequirements) return toast.error("You don't have privilege to save.");

    setSavingEdit(true);
    try {
      for (const month of MONTHS) {
        const ids = currentRow.monthIds?.[month] || [];
        const newSP = safeNum(editForm?.monthData?.[month]?.salesPlan);
        const newPP = safeNum(editForm?.monthData?.[month]?.prodPlan);

        if (ids.length > 0) {
          await axiosInstance.patch(`/api/requirements/${ids[0]}`, {
            sectionCode: currentRow.sectionCode,
            sectionName: currentRow.sectionName,
            lineCode: currentRow.lineCode,
            lineDescription: currentRow.lineDescription,
            monthName: month,
            year: currentRow.year,
            salesPlan: newSP,
            prodPlan: newPP,
          });

          for (const extraId of ids.slice(1)) {
            await axiosInstance.delete(`/api/requirements/${extraId}`);
          }
        } else if (newSP !== null || newPP !== null) {
          await axiosInstance.post(`/api/requirements`, {
            sectionCode: currentRow.sectionCode,
            sectionName: currentRow.sectionName,
            lineCode: currentRow.lineCode,
            lineDescription: currentRow.lineDescription,
            monthName: month,
            year: currentRow.year,
            salesPlan: newSP,
            prodPlan: newPP,
          });
        }
      }

      toast.success("Requirement updated successfully");
      setEditModalOpen(false);
      setCurrentRow(null);
      setEditForm(null);
      await fetchAllRequirements();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to update requirement");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 min-h-screen pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Set Requirements</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage Sales & Production plans. Edit/Delete row.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="flex flex-1 lg:flex-none items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
            <Select
              value={filterState.section}
              onValueChange={(val) => handleFilterChange("section", val)}
            >
              <SelectTrigger className="w-[150px] h-9 bg-transparent border-none text-slate-700 focus:ring-0">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dep) => (
                  <SelectItem key={dep.id} value={dep.name}>
                    {dep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-5 w-[1px] bg-slate-200" />

            <Select
              value={filterState.sub_section}
              onValueChange={(val) => handleFilterChange("sub_section", val)}
              disabled={!filterState.section || filterState.section === "all"}
            >
              <SelectTrigger className="w-[170px] h-9 bg-transparent border-none text-slate-700 focus:ring-0">
                <SelectValue
                  placeholder={
                    !filterState.section || filterState.section === "all"
                      ? "Select Department First"
                      : "All Sections"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((sec) => (
                  <SelectItem key={sec.id} value={sec.name}>
                    {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-5 w-[1px] bg-slate-200" />

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`h-9 justify-start text-left font-normal ${
                    !filterState.dateRange?.from ? "text-muted-foreground" : ""
                  }`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterState.dateRange?.from ? (
                    filterState.dateRange.to ? (
                      <>
                        {filterState.dateRange.from.toLocaleDateString()} -{" "}
                        {filterState.dateRange.to.toLocaleDateString()}
                      </>
                    ) : (
                      filterState.dateRange.from.toLocaleDateString()
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={filterState.dateRange?.from}
                  selected={filterState.dateRange}
                  onSelect={(range) => handleFilterChange("dateRange", range)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400"
              onClick={() => {
                setFilterState({
                  section: "",
                  sub_section: "",
                  search: "",
                  dateRange: undefined,
                });
                setPage(1);
              }}
              title="Reset Filters"
            >
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>

          {canManageRequirements && (
            <>
              <Button
                onClick={() => setIsMailModalOpen(true)}
                variant="outline"
                className="bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm"
                title="Manage Notification Emails"
              >
                Emails
              </Button>

              <Button
                onClick={() => setIsUploadOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Upload Excel
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Requirements Database (12 Months)</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search department, section or year..."
                className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-600"
                value={filterState.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              Total: {totalItems}
            </Badge>
          </div>
        </div>

        <div
          className="overflow-x-auto"
          style={{ maxWidth: "calc(100vw - 16rem - 4rem - 3rem)" }}
        >
          <table className="text-left text-sm text-slate-500 w-full">
            <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500">
              <tr>
                <th className="px-3 py-3 sticky left-0 z-40 bg-slate-50 border-r border-slate-200" style={{ width: "140px", minWidth: "140px" }}>Section Code</th>
                <th className="px-3 py-3 sticky left-[140px] z-40 bg-slate-50 border-r border-slate-200" style={{ width: "180px", minWidth: "180px" }}>Section Name</th>
                <th className="px-3 py-3 sticky left-[320px] z-40 bg-slate-50 border-r border-slate-200" style={{ width: "140px", minWidth: "140px" }}>Line Code</th>
                <th className="px-3 py-3 sticky left-[460px] z-40 bg-slate-50 border-r-2 border-slate-300" style={{ width: "220px", minWidth: "220px" }}>Line Description</th>
                <th className="px-3 py-3 text-center" style={{ width: "70px" }}>Year</th>

                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="px-2 py-2 text-center border-l border-slate-200"
                    style={{ width: "120px", minWidth: "120px" }}
                  >
                    <div className="font-bold text-slate-700">{MONTHS_SHORT[m]}</div>
                    <div className="flex justify-between px-2 mt-1 text-[10px] text-slate-400 font-semibold">
                      <span>SP</span>
                      <span>PP</span>
                    </div>
                  </th>
                ))}

                <th className="px-3 py-3 text-right" style={{ width: "120px" }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={19} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading...
                    </div>
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-6 py-12 text-center text-slate-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.key} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 sticky left-0 z-30 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-200">
                      <div className="font-medium text-slate-900 text-xs truncate">{r.sectionCode || "-"}</div>
                    </td>

                    <td className="px-3 py-3 sticky left-[140px] z-30 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-200">
                      <span className="text-slate-700 text-xs truncate block">{r.sectionName || "-"}</span>
                    </td>

                    <td className="px-3 py-3 sticky left-[320px] z-30 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-200">
                      <span className="text-slate-700 text-xs truncate block">{r.lineCode || "-"}</span>
                    </td>

                    <td className="px-3 py-3 sticky left-[460px] z-30 bg-white group-hover:bg-slate-50 transition-colors border-r-2 border-slate-300">
                      <span className="text-slate-700 text-xs truncate block">{r.lineDescription || "-"}</span>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                        <Clock className="w-2.5 h-2.5" />
                        {r.year || "-"}
                      </div>
                    </td>

                    {MONTHS.map((m) => {
                      const sp = safeNum(r?.monthData?.[m]?.salesPlan);
                      const pp = safeNum(r?.monthData?.[m]?.prodPlan);
                      return (
                        <td key={m} className="px-2 py-3 text-center border-l border-slate-100">
                          <div className="flex justify-between items-center gap-1">
                            <span className="w-full text-center text-xs text-blue-700 font-medium">
                              {sp !== null ? sp : <span className="text-slate-300">—</span>}
                            </span>
                            <span className="text-slate-200">|</span>
                            <span className="w-full text-center text-xs text-emerald-700 font-medium">
                              {pp !== null ? pp : <span className="text-slate-300">—</span>}
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-3 py-3 text-right">
                      {canManageRequirements && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-blue-600"
                            onClick={() => openEditRow(r)}
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-red-600"
                            onClick={() => handleDeleteRow(r)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={isUploadOpen}
        onOpenChange={(o) => {
          setIsUploadOpen(o);
          if (!o) setSelectedFile(null);
        }}
      >
        <DialogContent className="sm:max-w-[600px] bg-white text-slate-900 border-slate-200 p-0 overflow-hidden shadow-xl">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center gap-3">
              <div className="h-5 w-1.5 bg-blue-600 rounded-full"></div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Upload Requirements
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 ml-4.5">
              Upload Excel file to update Sales & Production plans.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2">
            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 h-72 flex flex-col items-center justify-center relative transition-all hover:bg-slate-100 hover:border-blue-400 group">
              <Input
                type="file"
                accept=".xlsx, .xls"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleFileChange}
              />
              {selectedFile ? (
                <div className="text-center space-y-3 p-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600 shadow-sm">
                    <span className="text-2xl font-bold">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-lg text-slate-900">{selectedFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedFile(null)}>
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-5">
                  <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <div className="text-blue-600">Upload</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Upload Excel File</h3>
                    <p className="text-slate-500 text-sm mt-1">Click to browse.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setIsUploadOpen(false);
                setSelectedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editModalOpen}
        onOpenChange={(o) => {
          setEditModalOpen(o);
          if (!o) {
            setCurrentRow(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto bg-white text-slate-900 border-slate-200 p-0 shadow-xl">
          <DialogHeader className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
            <DialogTitle className="text-lg font-bold">
              Edit Requirement Entry (12 Months)
            </DialogTitle>
          </DialogHeader>

          {editForm && (
            <div className="p-6 grid gap-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Section Code</Label>
                  <Input disabled value={editForm.sectionCode || ""} />
                </div>

                <div className="space-y-2">
                  <Label>Section Name</Label>
                  <Input disabled value={editForm.sectionName || ""} />
                </div>

                <div className="space-y-2">
                  <Label>Line Code</Label>
                  <Input disabled value={editForm.lineCode || ""} />
                </div>

                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input disabled value={editForm.year || ""} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Line Description</Label>
                <Input disabled value={editForm.lineDescription || ""} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">
                  Month-wise Plans
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {MONTHS.map((m) => {
                    const spVal = editForm?.monthData?.[m]?.salesPlan ?? null;
                    const ppVal = editForm?.monthData?.[m]?.prodPlan ?? null;

                    return (
                      <div key={m} className="space-y-2 border border-slate-200 rounded-md p-3 bg-white">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block text-center border-b pb-1">
                          {m}
                        </Label>

                        <div>
                          <Label className="text-xs text-slate-600 font-medium">Sales Plan</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={spVal === null ? "" : spVal}
                            onChange={(e) =>
                              handleEditMonthChange(m, "salesPlan", e.target.value.replace(/[^0-9]/g, ""))
                            }
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-slate-600 font-medium">Prod Plan</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={ppVal === null ? "" : ppVal}
                            onChange={(e) =>
                              handleEditMonthChange(m, "prodPlan", e.target.value.replace(/[^0-9]/g, ""))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-6 pt-4 bg-slate-50 border-t border-slate-100 text-right sticky bottom-0 z-10">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)} className="mr-2">
              Cancel
            </Button>
            <Button
              onClick={handleSaveRowEdit}
              disabled={savingEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MailManagementModal
        isOpen={isMailModalOpen}
        onClose={() => setIsMailModalOpen(false)}
      />
    </div>
  );
}