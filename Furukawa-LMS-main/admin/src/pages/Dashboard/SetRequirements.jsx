"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
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
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
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

const normalizeApprovalStatus = (status, isActive) => {
  const s = String(status || "").trim().toLowerCase();

  if (s === "approved") return "approved";
  if (s === "system_approved") return "system_approved";
  if (s === "rejected") return "rejected";
  if (s === "pending") return "pending";

  if (isActive === true || isActive === 1) return "approved";

  return "pending";
};

const getSalesPlanClass = (cell) => {
  const status = normalizeApprovalStatus(cell?.approvalStatus, cell?.isActive);

  if (status === "approved" || status === "system_approved") {
    return "text-blue-700";
  }

  return "text-red-600";
};

const getProdPlanClass = (cell) => {
  const status = normalizeApprovalStatus(cell?.approvalStatus, cell?.isActive);

  if (status === "approved" || status === "system_approved") {
    return "text-emerald-700";
  }

  return "text-red-600";
};

const getRowApprovalSummary = (row) => {
  const statuses = MONTHS
    .map((m) => normalizeApprovalStatus(row?.monthData?.[m]?.approvalStatus, row?.monthData?.[m]?.isActive))
    .filter(Boolean);

  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("system_approved")) return "system_approved";
  if (statuses.includes("approved")) return "approved";

  return "pending";
};

const getStatusBadge = (status) => {
  const s = normalizeApprovalStatus(status);

  if (s === "approved") {
    return {
      label: "Approved",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
    };
  }

  if (s === "system_approved") {
    return {
      label: "Approved by System",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: ShieldCheck,
    };
  }

  if (s === "rejected") {
    return {
      label: "Rejected",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: XCircle,
    };
  }

  return {
    label: "Approval Pending",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: AlertCircle,
  };
};

const MonthStatusLabel = ({ cell }) => {
  const status = normalizeApprovalStatus(cell?.approvalStatus, cell?.isActive);
  const badge = getStatusBadge(status);
  const Icon = badge.icon;

  if (cell?.salesPlan === null && cell?.prodPlan === null) return null;

  let label = badge.label;

  if (status === "approved") {
    label = cell?.approvedBy
      ? `Approved`
      : "Approved";
  }

  if (status === "system_approved") {
    label = `System Approved${cell?.approvalOwnerName ? ` (${cell.approvalOwnerName})` : ""}`;
  }

  if (status === "rejected") {
    label = cell?.rejectedBy ? "Rejected" : "Rejected";
  }

  if (status === "pending") {
    label = cell?.approvalOwnerName
      ? `Pending (${cell.approvalOwnerName})`
      : "Approval Pending";
  }

  return (
    <div
      className={`mt-1 inline-flex items-center justify-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none ${badge.className}`}
      title={label}
    >
      <Icon className="w-2.5 h-2.5 flex-shrink-0" />
      <span className="max-w-[85px] truncate">{label}</span>
    </div>
  );
};

export default function SetRequirements() {
  const { user } = useSelector((state) => state.auth);
  const { hasPrivilege } = usePrivileges();
  const canManageRequirements = hasPrivilege("setrequirement");
  const canUpload = user?.isAdmin || user?.role === 'SUPERADMIN' || canManageRequirements || user?.customRole?.permissions?.includes('mps_requirement:upload_excel');
  const canManageEmails = user?.isAdmin || user?.role === 'SUPERADMIN' || canManageRequirements || user?.customRole?.permissions?.includes('mps_requirement:add_emails');

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
      if (!selected) {
        setSections([]);
        return;
      }

      try {
        const res = await axiosInstance.get(`/api/lines?sectionId=${selected.id}`);
        if (res.data?.success) setSections(res.data.data || []);
        else setSections([]);
      } catch (e) {
        console.error(e);
        setSections([]);
      }
    };
    fetchSections();
  }, [filterState.section, departments]);

  const handleFilterChange = (key, value) => {
    setFilterState((prev) => {
      if (key === "section") {
        return {
          ...prev,
          section: value,
          sub_section: "",
        };
      }

      return { ...prev, [key]: value };
    });

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
          monthData[m] = {
            salesPlan: null,
            prodPlan: null,
            isActive: true,
            approvalStatus: "pending",
            approvalOwnerName: null,
            approvalOwnerEmail: null,
            approvedBy: null,
            approvedByEmail: null,
            approvedAt: null,
            approvalSource: null,
            rejectedBy: null,
            rejectedAt: null,
          };
          monthIds[m] = [];
        }

        map.set(key, {
          key,
          sectionCode: req?.sectionCode || "",
          sectionName: req?.sectionName || "",
          sectionCategory: req?.sectionCategory || "Not Applicable",
          lineCode: req?.lineCode || "",
          lineDescription: req?.lineDescription || "",
          year: req?.year || "",
          monthData,
          monthIds,
          isActive: true,
          approvalStatus: "pending",
          approvalOwnerName: null,
          approvalOwnerEmail: null,
        });
      }

      const row = map.get(key);
      const month = normalizeMonth(req?.monthName);

      if (month && MONTHS.includes(month)) {
        const sp = safeNum(req?.salesPlan);
        const pp = safeNum(req?.prodPlan);
        const fn01 = safeNum(req?.prodPlanFN01);
        const fn02 = safeNum(req?.prodPlanFN02);
        const isActive = req?.isActive === true || req?.is_active === true || req?.is_active === 1;
        const approvalStatus = normalizeApprovalStatus(req?.approvalStatus, isActive);

        if (row.monthIds[month].length === 0) {
          row.monthData[month] = {
            salesPlan: sp,
            prodPlan: pp,
            prodPlanFN01: fn01,
            prodPlanFN02: fn02,
            isActive,
            approvalStatus,
            approvalOwnerName: req?.approvalOwnerName || null,
            approvalOwnerEmail: req?.approvalOwnerEmail || null,
            approvedBy: req?.approvedBy || null,
            approvedByEmail: req?.approvedByEmail || null,
            approvedAt: req?.approvedAt || null,
            approvalSource: req?.approvalSource || null,
            rejectedBy: req?.rejectedBy || null,
            rejectedAt: req?.rejectedAt || null,
          };

          if (approvalStatus === "pending" || approvalStatus === "rejected") {
            row.isActive = false;
          }

          if (!row.approvalOwnerName && req?.approvalOwnerName) {
            row.approvalOwnerName = req.approvalOwnerName;
          }

          if (!row.approvalOwnerEmail && req?.approvalOwnerEmail) {
            row.approvalOwnerEmail = req.approvalOwnerEmail;
          }
        }

        if (req?.id && !row.monthIds[month].includes(req.id)) {
          row.monthIds[month].push(req.id);
        }
      }
    }

    const groupedRows = Array.from(map.values()).map((row) => ({
      ...row,
      approvalStatus: getRowApprovalSummary(row),
    }));

    return groupedRows.sort((a, b) => a.key.localeCompare(b.key));
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
    if (!canUpload) return toast.error("You don't have privilege to upload.");

    setUploading(true);
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      let headerRowIdx = -1;
      let sectionCodeIdx = -1;
      let sectionNameIdx = -1;

      for (let i = 0; i < Math.min(jsonData.length, 15); i++) {
        const row = jsonData[i];
        if (!row) continue;
        const stringRow = row.map((c) => String(c || "").trim().toLowerCase());
        const scIdx = stringRow.findIndex((s) => s.includes("section code"));
        const snIdx = stringRow.findIndex((s) => s.includes("section") && !s.includes("code"));

        if (scIdx !== -1) {
          headerRowIdx = i;
          sectionCodeIdx = scIdx;
          sectionNameIdx = snIdx;
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
        const rawSectionName = sectionNameIdx !== -1 && row[sectionNameIdx] ? String(row[sectionNameIdx]).trim() : "";

        if (rawSectionCode && rawSectionCode.toLowerCase() === "section code") continue;
        if (!rawSectionCode && !rawSectionName) continue;

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

      toast.success("Requirements uploaded successfully. Approval mail sent to section head.");
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
      const mData = row?.monthData?.[m] || {};
      const sp = safeNum(mData.salesPlan);
      const pp = safeNum(mData.prodPlan);
      const rawFn01 = safeNum(mData.prodPlanFN01);
      const rawFn02 = safeNum(mData.prodPlanFN02);

      copiedMonthData[m] = {
        salesPlan: sp,
        prodPlan: pp,
        prodPlanFN01: rawFn01 !== null ? rawFn01 : (pp !== null ? pp : null),
        prodPlanFN02: rawFn02 !== null ? rawFn02 : (pp !== null ? 0 : null),
      };
    }

    setEditForm({
      ...row,
      monthData: copiedMonthData,
    });
    setEditModalOpen(true);
  };

  const handleEditMonthChange = (month, field, value) => {
    setEditForm((prev) => {
      const currentMonthData = prev?.monthData?.[month] || { salesPlan: null, prodPlan: null, prodPlanFN01: null, prodPlanFN02: null };
      const parsedValue = value === "" ? null : Number(value);
      const updatedMonthData = {
        ...currentMonthData,
        [field]: parsedValue,
      };

      if (field === "prodPlanFN01" || field === "prodPlanFN02") {
        const fn01 = updatedMonthData.prodPlanFN01 || 0;
        const fn02 = updatedMonthData.prodPlanFN02 || 0;
        updatedMonthData.prodPlan = fn01 + fn02;
      }

      return {
        ...prev,
        monthData: {
          ...(prev?.monthData || {}),
          [month]: updatedMonthData,
        },
      };
    });
  };

  const valuesAreSame = (a, b) => {
    const n1 = safeNum(a);
    const n2 = safeNum(b);

    if (n1 === null && n2 === null) return true;
    return Number(n1 || 0) === Number(n2 || 0);
  };

  const handleSaveRowEdit = async () => {
    if (!currentRow || !editForm) return;
    if (!canManageRequirements) return toast.error("You don't have privilege to save.");

    setSavingEdit(true);

    try {
      let changedCount = 0;

      for (const month of MONTHS) {
        const ids = currentRow.monthIds?.[month] || [];

        const oldSP = currentRow?.monthData?.[month]?.salesPlan;
        const oldPP = currentRow?.monthData?.[month]?.prodPlan;
        const oldFN01 = currentRow?.monthData?.[month]?.prodPlanFN01;
        const oldFN02 = currentRow?.monthData?.[month]?.prodPlanFN02;

        const newSP = safeNum(editForm?.monthData?.[month]?.salesPlan);
        const newPP = safeNum(editForm?.monthData?.[month]?.prodPlan);
        const newFN01 = safeNum(editForm?.monthData?.[month]?.prodPlanFN01);
        const newFN02 = safeNum(editForm?.monthData?.[month]?.prodPlanFN02);

        const spChanged = !valuesAreSame(oldSP, newSP);
        const ppChanged = !valuesAreSame(oldPP, newPP);
        const fn01Changed = !valuesAreSame(oldFN01, newFN01);
        const fn02Changed = !valuesAreSame(oldFN02, newFN02);

        // IMPORTANT: unchanged month backend par nahi jayega
        if (!spChanged && !ppChanged && !fn01Changed && !fn02Changed) {
          continue;
        }

        changedCount++;

        if (ids.length > 0) {
          const patchRes = await axiosInstance.patch(`/api/requirements/${ids[0]}`, {
            sectionCode: currentRow.sectionCode,
            sectionName: currentRow.sectionName,
            lineCode: currentRow.lineCode,
            lineDescription: currentRow.lineDescription,
            monthName: month,
            year: currentRow.year,
            salesPlan: newSP,
            prodPlan: newPP,
            prodPlanFN01: newFN01,
            prodPlanFN02: newFN02,
          });

          console.log("Requirement update response:", patchRes.data);

          for (const extraId of ids.slice(1)) {
            await axiosInstance.delete(`/api/requirements/${extraId}`);
          }
        } else if (newSP !== null || newPP !== null || newFN01 !== null || newFN02 !== null) {
          await axiosInstance.post(`/api/requirements`, {
            sectionCode: currentRow.sectionCode,
            sectionName: currentRow.sectionName,
            lineCode: currentRow.lineCode,
            lineDescription: currentRow.lineDescription,
            monthName: month,
            year: currentRow.year,
            salesPlan: newSP,
            prodPlan: newPP,
            prodPlanFN01: newFN01,
            prodPlanFN02: newFN02,
          });
        }
      }

      if (changedCount === 0) {
        toast.info("No changes found.");
        return;
      }

      toast.success(
        changedCount === 1
          ? "Requirement updated successfully. Approval mail sent for changed month."
          : `${changedCount} requirements updated successfully. Approval mails sent for changed months.`
      );

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
            Manage Sales & Production plans. Pending/rejected plans stay red until approval.
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
                  className={`h-9 justify-start text-left font-normal ${!filterState.dateRange?.from ? "text-muted-foreground" : ""
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

          {canManageEmails && (
            <Button
              onClick={() => setIsMailModalOpen(true)}
              variant="outline"
              className="bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-sm"
              title="Manage Notification Emails"
            >
              Emails
            </Button>
          )}

          {canUpload && (
            <Button
              onClick={() => setIsUploadOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Excel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">Pending</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {rows.filter((r) => r.approvalStatus === "pending").length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">Approved</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {rows.filter((r) => r.approvalStatus === "approved").length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">System Approved</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {rows.filter((r) => r.approvalStatus === "system_approved").length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
          <div className="text-xs font-bold text-slate-500 uppercase">Rejected</div>
          <div className="text-2xl font-bold text-red-700 mt-1">
            {rows.filter((r) => r.approvalStatus === "rejected").length}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Requirements Database (12 Months)</h2>
            <p className="text-xs text-slate-500 mt-1">
              SP = Sales Plan, PP = Production Plan. Red means approval pending/rejected.
            </p>
          </div>

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
                <th className="px-3 py-3 text-center" style={{ width: "90px", minWidth: "90px" }}>Year</th>
                <th className="px-3 py-3 text-center border-l border-slate-200" style={{ width: "160px", minWidth: "160px" }}>Approval</th>

                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="p-0 text-center border-l border-slate-200"
                    style={{ width: "190px", minWidth: "190px" }}
                  >
                    <div className="font-bold text-slate-700 py-1.5 border-b border-slate-200 text-xs">
                      {MONTHS_SHORT[m]}
                    </div>
                    <div className="grid grid-cols-3 text-[10px] text-slate-500 font-semibold leading-normal">
                      <div className="col-span-1 border-r border-slate-200 flex flex-col justify-between py-1">
                        <div>SP</div>
                        <div className="text-[9px] text-slate-400 font-normal mt-0.5">&nbsp;</div>
                      </div>
                      <div className="col-span-2 flex flex-col py-1">
                        <div className="border-b border-slate-200 pb-0.5">PP</div>
                        <div className="grid grid-cols-2 text-[9px] text-slate-400 font-semibold pt-0.5">
                          <div className="border-r border-slate-100">FN01</div>
                          <div>FN02</div>
                        </div>
                      </div>
                    </div>
                  </th>
                ))}

                <th className="px-3 py-3 text-right" style={{ width: "120px", minWidth: "120px" }}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={20} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center gap-2 text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading...
                    </div>
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-6 py-12 text-center text-slate-400">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => {
                  const rowBadge = getStatusBadge(r.approvalStatus);
                  const RowIcon = rowBadge.icon;

                  return (
                    <tr
                      key={r.key}
                      className={`group hover:bg-slate-50 transition-colors ${r.approvalStatus === "pending" || r.approvalStatus === "rejected"
                          ? "bg-red-50/40 hover:bg-red-50"
                          : r.approvalStatus === "system_approved"
                            ? "bg-amber-50/30 hover:bg-amber-50/50"
                            : ""
                        }`}
                    >
                      <td className={`px-3 py-3 sticky left-0 z-30 group-hover:bg-slate-50 transition-colors border-r border-slate-200 ${r.approvalStatus === "pending" || r.approvalStatus === "rejected"
                          ? "bg-red-50 text-red-700 font-bold"
                          : r.approvalStatus === "system_approved"
                            ? "bg-amber-50 text-amber-700 font-bold"
                            : "bg-white"
                        }`}>
                        <div className="font-medium text-xs truncate">{r.sectionCode || "-"}</div>
                      </td>

                      <td className={`px-3 py-3 sticky left-[140px] z-30 group-hover:bg-slate-50 transition-colors border-r border-slate-200 ${r.approvalStatus === "pending" || r.approvalStatus === "rejected"
                          ? "bg-red-50 text-red-700"
                          : r.approvalStatus === "system_approved"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-white"
                        }`}>
                        <span className="text-xs truncate block font-bold">{r.sectionName || "-"}</span>
                        {r.sectionCategory && (
                          <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.5 mt-1 rounded ${r.sectionCategory.toLowerCase() === "direct"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : r.sectionCategory.toLowerCase() === "indirect"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-slate-100 text-slate-800 border border-slate-200"
                            }`}>
                            {r.sectionCategory}
                          </span>
                        )}
                      </td>

                      <td className={`px-3 py-3 sticky left-[320px] z-30 group-hover:bg-slate-50 transition-colors border-r border-slate-200 ${r.approvalStatus === "pending" || r.approvalStatus === "rejected"
                          ? "bg-red-50 text-red-700"
                          : r.approvalStatus === "system_approved"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-white"
                        }`}>
                        <span className="text-xs truncate block">{r.lineCode || "-"}</span>
                      </td>

                      <td className={`px-3 py-3 sticky left-[460px] z-30 group-hover:bg-slate-50 transition-colors border-r-2 border-slate-300 ${r.approvalStatus === "pending" || r.approvalStatus === "rejected"
                          ? "bg-red-50 text-red-700"
                          : r.approvalStatus === "system_approved"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-white"
                        }`}>
                        <span className="text-xs truncate block">{r.lineDescription || "-"}</span>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                          <Clock className="w-2.5 h-2.5" />
                          {r.year || "-"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center border-l border-slate-100">
                        <div
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${rowBadge.className}`}
                          title={
                            r.approvalStatus === "system_approved" && r.approvalOwnerName
                              ? `Approved by system for ${r.approvalOwnerName}`
                              : rowBadge.label
                          }
                        >
                          <RowIcon className="w-3 h-3" />
                          <span>
                            {r.approvalStatus === "system_approved" && r.approvalOwnerName
                              ? `System (${r.approvalOwnerName})`
                              : rowBadge.label}
                          </span>
                        </div>
                      </td>

                      {MONTHS.map((m) => {
                        const cell = r?.monthData?.[m] || {};
                        const sp = safeNum(cell?.salesPlan);
                        const pp = safeNum(cell?.prodPlan);

                        const rawFn01 = safeNum(cell?.prodPlanFN01);
                        const rawFn02 = safeNum(cell?.prodPlanFN02);
                        const fn01 = rawFn01 !== null ? rawFn01 : (pp !== null ? pp : null);
                        const fn02 = rawFn02 !== null ? rawFn02 : (pp !== null ? 0 : null);

                        const hasAnyData = sp !== null || fn01 !== null || fn02 !== null || pp !== null;
                        const computedTotalPP = (rawFn01 !== null || rawFn02 !== null)
                          ? ((rawFn01 || 0) + (rawFn02 || 0))
                          : (pp !== null ? pp : 0);

                        return (
                          <td
                            key={m}
                            className="p-0 text-center border-l border-slate-100 align-top"
                            style={{ width: "190px", minWidth: "190px" }}
                          >
                            {hasAnyData ? (
                              <div className="flex flex-col h-full justify-between">
                                <div className="grid grid-cols-3 items-center py-2 border-b border-slate-100">
                                  <div className="col-span-1 border-r border-slate-100 px-1">
                                    <span className={`text-xs font-bold block text-center ${getSalesPlanClass(cell)}`}>
                                      {sp !== null ? sp : <span className="text-slate-300">—</span>}
                                    </span>
                                  </div>

                                  <div className="col-span-1 border-r border-slate-100 px-1">
                                    <span className={`text-xs font-bold block text-center ${getProdPlanClass(cell)}`}>
                                      {fn01 !== null ? fn01 : <span className="text-slate-300">—</span>}
                                    </span>
                                  </div>

                                  <div className="col-span-1 px-1">
                                    <span className={`text-xs font-bold block text-center ${getProdPlanClass(cell)}`}>
                                      {fn02 !== null ? fn02 : <span className="text-slate-300">—</span>}
                                    </span>
                                  </div>
                                </div>

                                <div className="p-1.5 flex flex-col items-center gap-1">
                                  <div className="inline-flex items-center justify-center rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 leading-none">
                                    PP: {computedTotalPP}
                                  </div>
                                  <MonthStatusLabel cell={cell} />
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 text-slate-300 text-xs">—</div>
                            )}
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
                  );
                })
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
              Upload Excel file to update Sales & Production plans. Records will remain red until section head approval.
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                  {MONTHS.map((m) => {
                    const spVal = editForm?.monthData?.[m]?.salesPlan ?? null;
                    const ppVal = editForm?.monthData?.[m]?.prodPlan ?? null;
                    const fn01Val = editForm?.monthData?.[m]?.prodPlanFN01 ?? null;
                    const fn02Val = editForm?.monthData?.[m]?.prodPlanFN02 ?? null;

                    const computedTotalPP = (fn01Val !== null || fn02Val !== null)
                      ? ((fn01Val || 0) + (fn02Val || 0))
                      : (ppVal || 0);

                    return (
                      <div key={m} className="space-y-3 border border-slate-200 rounded-md p-3 bg-white">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider block text-center border-b pb-1">
                          {m}
                        </Label>

                        <div>
                          <Label className="text-xs text-slate-500 font-semibold block text-center mb-1">Sales Plan (SP)</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="text-center h-9 font-medium"
                            value={spVal === null ? "" : spVal}
                            onChange={(e) =>
                              handleEditMonthChange(m, "salesPlan", e.target.value.replace(/[^0-9]/g, ""))
                            }
                          />
                        </div>

                        <div className="space-y-1.5 pt-1 border-t border-slate-100">
                          <span className="text-xs font-bold text-slate-800 block text-center">Production Plan (PP)</span>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="text-[10px] text-slate-500 font-bold block text-center">FN01</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                className="text-center h-8 px-1.5 py-1 text-xs font-semibold w-full"
                                value={fn01Val === null ? "" : fn01Val}
                                onChange={(e) =>
                                  handleEditMonthChange(m, "prodPlanFN01", e.target.value.replace(/[^0-9]/g, ""))
                                }
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-[10px] text-slate-500 font-bold block text-center">FN02</Label>
                              <Input
                                type="text"
                                inputMode="numeric"
                                className="text-center h-8 px-1.5 py-1 text-xs font-semibold w-full"
                                value={fn02Val === null ? "" : fn02Val}
                                onChange={(e) =>
                                  handleEditMonthChange(m, "prodPlanFN02", e.target.value.replace(/[^0-9]/g, ""))
                                }
                              />
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 font-bold mt-2 text-center">
                            Total PP: <span className="text-slate-900 font-extrabold text-xs">{computedTotalPP}</span>
                          </div>
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