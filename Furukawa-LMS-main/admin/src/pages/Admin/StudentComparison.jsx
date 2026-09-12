// src/pages/Admin/StudentComparison.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useLazyGetAllStudentsQuery } from "@/Redux/AllApi/InstructorApi";
import {
  useUpdateUserMutation,
  useDeleteUserMutation,
  useStartImportEmployeesMutation,
  useProcessEmployeesChunkMutation,
  useFinalizeImportEmployeesMutation,
} from "@/Redux/AllApi/UserApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSelect } from "@/components/form/FormSelect";
import ConfirmationModal from "@/components/common/ConfirmationModal";
import {
  IconArrowLeft,
  IconUpload,
  IconRefresh,
  IconLoader2,
  IconPencil,
  IconTrash,
  IconUsers,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { safeDateFormat, dateToInputFormat } from "@/utils/dateUtils";
import { getExcelRows } from "@/utils/excelUtils";

const EMP_ID_HEADER_ALIASES = ["employeeid", "employee code", "employee id", "empid", "emp id", "emp code"];

const normalizeStatus = (status) => {
  const s = status || "PRESENT";
  switch (s) {
    case "ACTIVE":
      return "PRESENT";
    case "PENDING":
      return "ON_LEAVE";
    case "SUSPENDED":
    case "BANNED":
      return "LEFT";
    default:
      return s;
  }
};

const getDeptDisplay = (student) => {
  if (student.assignments?.length > 0) {
    const names = [...new Set(student.assignments.map((a) => a.deptName).filter((n) => n && n.toLowerCase() !== "none"))];
    if (names.length) return names.join(", ");
  }
  if (student.department?.name) return student.department.name;
  if (student.deptName && student.deptName.toLowerCase() !== "none") return student.deptName;
  return "-";
};

const getSectionDisplay = (student) => {
  const assigned = [...new Set((student.assignments || []).map((a) => a.sectionName).filter(Boolean))];
  if (assigned.length) return assigned.join(", ");
  return student.sectionName || "-";
};

const StudentComparison = () => {
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth.user);
  const hasPermission = (permission) => {
    if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN" || currentUser?.isAdmin) return true;
    return !!currentUser?.customRole?.permissions?.includes(permission);
  };
  const canDelete = hasPermission("user:delete");
  const canUpdate = hasPermission("user:update");

  // Excel upload state
  const fileInputRef = useRef(null);
  const [excelData, setExcelData] = useState([]);
  const [excelFileName, setExcelFileName] = useState("");
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [excelEmpIdsSet, setExcelEmpIdsSet] = useState(new Set());
  const hasUploadedFile = excelData.length > 0;

  // Import-to-DB state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0, success: 0, failed: 0, errors: [] });

  // DB users state
  const [dbStudents, setDbStudents] = useState([]);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [dbLoadProgress, setDbLoadProgress] = useState({ loaded: 0, total: 0 });

  // Edit / delete dialogs
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    empId: "",
    departmentId: "",
    sectionId: "",
    status: "PRESENT",
    joiningDate: "",
  });

  const [triggerGetAllStudents] = useLazyGetAllStudentsQuery();
  const [updateStudent] = useUpdateUserMutation();
  const [deleteStudent] = useDeleteUserMutation();
  const [startImportEmployees] = useStartImportEmployeesMutation();
  const [processEmployeesChunk] = useProcessEmployeesChunkMutation();
  const [finalizeImportEmployees] = useFinalizeImportEmployeesMutation();

  const { data: departmentsData } = useGetAllDepartmentsQuery({}, { refetchOnFocus: false, refetchOnReconnect: false });
  const departments = departmentsData?.data?.departments || [];

  const { data: sectionsData } = useGetSectionsByDepartmentQuery(editFormData.departmentId, {
    skip: !editFormData.departmentId,
  });
  const sections = sectionsData?.data || [];

  const loadDbStudents = async () => {
    setIsLoadingDb(true);
    setDbLoadProgress({ loaded: 0, total: 0 });
    try {
      // The backend clamps `limit` to 100 regardless of what's requested,
      // so paginate through every page to fetch the full operator list.
      const PAGE_SIZE = 100;
      let allUsers = [];
      let page = 1;
      let totalUsers = Infinity;

      while (allUsers.length < totalUsers) {
        const result = await triggerGetAllStudents({ page, limit: PAGE_SIZE, includeLeft: "true" }).unwrap();
        const batch = result?.data?.users || [];
        totalUsers = result?.data?.totalUsers ?? 0;
        allUsers = [...allUsers, ...batch];
        setDbLoadProgress({ loaded: allUsers.length, total: totalUsers });

        if (batch.length === 0) break;
        page++;
      }

      setDbStudents(allUsers);
    } catch (error) {
      console.error("Failed to load database users", error);
      toast.error(error?.data?.message || "Failed to load database users");
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    loadDbStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manpower present in both the Excel sheet and the database
  const matchedUsers = useMemo(() => {
    if (!hasUploadedFile) return [];
    return dbStudents.filter((user) => {
      const empId = user.empId?.toString().trim().toLowerCase();
      return empId && excelEmpIdsSet.has(empId);
    });
  }, [dbStudents, excelEmpIdsSet, hasUploadedFile]);

  // Manpower present in the database but missing from the Excel sheet
  const missingUsers = useMemo(() => {
    if (!hasUploadedFile) return [];
    return dbStudents.filter((user) => {
      const empId = user.empId?.toString().trim().toLowerCase();
      return empId && !excelEmpIdsSet.has(empId);
    });
  }, [dbStudents, excelEmpIdsSet, hasUploadedFile]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = null;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Please select an Excel file (.xlsx or .xls)");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows = getExcelRows(worksheet, { header: 1, defval: null });

      let foundHeaderRowIndex = -1;
      for (let i = 0; i < Math.min(allRows.length, 15); i++) {
        const row = allRows[i];
        if (
          row &&
          Array.isArray(row) &&
          row.some((cell) => {
            if (!cell) return false;
            return EMP_ID_HEADER_ALIASES.includes(cell.toString().trim().toLowerCase());
          })
        ) {
          foundHeaderRowIndex = i;
          break;
        }
      }
      if (foundHeaderRowIndex === -1) foundHeaderRowIndex = 0;

      const headers = allRows[foundHeaderRowIndex].map((h) => h?.toString().trim() || "");
      const empIdKey = headers.find((h) => EMP_ID_HEADER_ALIASES.includes(h.toLowerCase()));

      const rawData = allRows.slice(foundHeaderRowIndex + 1);
      const rows = rawData
        .map((r) => {
          const obj = {};
          headers.forEach((h, idx) => {
            obj[h || `__EMPTY_${idx}`] = r[idx];
          });
          return obj;
        })
        .filter((r) => Object.values(r).some((v) => v !== null && v !== undefined && v.toString().trim() !== ""));

      if (rows.length === 0) {
        toast.error("No data found in the Excel file");
        return;
      }
      if (!empIdKey) {
        toast.error("Could not detect an Employee ID column (expected 'Employee ID', 'Employee Code' or 'EmpID')");
        return;
      }

      const empIdsSet = new Set(
        rows
          .map((r) => r[empIdKey])
          .filter(Boolean)
          .map((v) => v.toString().trim().toLowerCase())
      );

      setExcelFileName(file.name);
      setHeaderRowIndex(foundHeaderRowIndex);
      setExcelData(rows);
      setExcelEmpIdsSet(empIdsSet);
      toast.success(`Loaded ${rows.length} rows from ${file.name}`);
    } catch (error) {
      console.error("Excel parse error:", error);
      toast.error("Failed to read the Excel file");
    }
  };

  const handleImportToDb = async () => {
    if (!excelData.length || isImporting) return;
    setIsImporting(true);
    setImportProgress({ total: excelData.length, current: 0, success: 0, failed: 0, errors: [] });

    try {
      const startResult = await startImportEmployees({
        fileName: excelFileName,
        totalRows: excelData.length,
      }).unwrap();
      const logId = startResult.data.logId;

      const CHUNK_SIZE = 25;
      let current = 0, success = 0, failed = 0;
      const errors = [];

      for (let i = 0; i < excelData.length; i += CHUNK_SIZE) {
        const chunkRows = excelData.slice(i, i + CHUNK_SIZE);
        const startIndex = headerRowIndex + i + 2;

        const chunkResult = await processEmployeesChunk({ logId, rows: chunkRows, startIndex }).unwrap();
        const { results: chunkDetails = [], successCount = 0, failedCount = 0 } = chunkResult.data || {};

        current += chunkRows.length;
        success += successCount;
        failed += failedCount;
        chunkDetails
          .filter((r) => r.status === "FAILED")
          .forEach((r) => errors.push(`Row ${r.rowNumber}: ${r.error}`));

        setImportProgress({ total: excelData.length, current, success, failed, errors: [...errors] });
      }

      await finalizeImportEmployees({ logId }).unwrap();
      toast.success(`Import finished: ${success} succeeded, ${failed} failed`);
      loadDbStudents();
    } catch (error) {
      console.error("Import to DB error:", error);
      toast.error(error?.data?.message || error?.message || "Failed to import employees");
    } finally {
      setIsImporting(false);
    }
  };

  const openEditDialog = (student) => {
    const rawDepts = Array.isArray(student.departments) ? student.departments : [];
    const departmentId = rawDepts[0]
      ? String(rawDepts[0])
      : student.departmentId || student.DepartmentId || student.department?._id
        ? String(student.departmentId || student.DepartmentId || student.department?._id)
        : "";
    const rawSections = Array.isArray(student.sections) ? student.sections : [];
    const sectionId = rawSections[0] ? String(rawSections[0]) : student.sectionId ? String(student.sectionId) : "";

    setSelectedStudent(student);
    setEditFormData({
      fullName: student.fullName || "",
      empId: student.empId || "",
      departmentId,
      sectionId,
      status: normalizeStatus(student.status),
      joiningDate: dateToInputFormat(student.joiningDate),
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (student) => {
    setSelectedStudent(student);
    setIsDeleteDialogOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent || !canUpdate) return;
    if (!editFormData.fullName?.trim() || !editFormData.empId?.trim()) {
      toast.error("Name and Employee ID are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id: selectedStudent._id,
        fullName: editFormData.fullName.trim(),
        empId: editFormData.empId.trim(),
        status: editFormData.status,
        joiningDate: editFormData.joiningDate || null,
      };
      if (editFormData.departmentId) {
        payload.departments = [editFormData.departmentId];
      }
      if (editFormData.sectionId) {
        payload.sections = [editFormData.sectionId];
        payload.sectionId = editFormData.sectionId;
      }

      await updateStudent(payload).unwrap();
      toast.success("Operator updated successfully!");
      setIsEditDialogOpen(false);
      setSelectedStudent(null);
      loadDbStudents();
    } catch (error) {
      console.error("Update operator error:", error);
      toast.error(error?.data?.message || error?.message || "Failed to update operator");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent || !canDelete) return;
    setIsSubmitting(true);
    try {
      await deleteStudent(selectedStudent._id).unwrap();
      toast.success("Operator deleted successfully!");
      setIsDeleteDialogOpen(false);
      setDbStudents((prev) => prev.filter((s) => s._id !== selectedStudent._id));
      setSelectedStudent(null);
    } catch (error) {
      console.error("Delete operator error:", error);
      toast.error(error?.data?.message || error?.message || "Failed to delete operator");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2 -ml-2">
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Operator Comparison</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload an Excel sheet to compare against the operators currently in the system.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls" className="hidden" />
          <Button variant="outline" onClick={handleImportClick} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
            <IconUpload className="h-4 w-4 mr-2" />
            Upload Excel
          </Button>
          {hasUploadedFile && (
            <Button
              onClick={handleImportToDb}
              disabled={isImporting}
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
            >
              {isImporting ? (
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <IconUpload className="h-4 w-4 mr-2" />
              )}
              Import to DB
            </Button>
          )}
        </div>
      </div>

      {excelFileName && (
        <p className="text-sm text-gray-500">
          {excelFileName} — {excelData.length} rows loaded
        </p>
      )}

      {isImporting && (
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex items-center justify-between">
            <span>Importing {importProgress.current}/{importProgress.total}</span>
            <span>Success: {importProgress.success} · Failed: {importProgress.failed}</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${importProgress.total ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Grid 1: Manpower present in both Excel and Database */}
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Matched Manpower</h2>
                <p className="text-sm text-gray-500">Present in the Excel sheet and already in the database.</p>
              </div>
              {hasUploadedFile && !isLoadingDb && (
                <Badge variant="outline" className="whitespace-nowrap">
                  {matchedUsers.length} {matchedUsers.length === 1 ? "User" : "Users"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasUploadedFile ? (
              <div className="text-center py-10 text-gray-400">
                <IconUpload className="h-8 w-8 mx-auto mb-2" />
                <p>Upload an Excel sheet to see matched manpower here.</p>
              </div>
            ) : isLoadingDb ? (
              <div className="text-center py-10 text-gray-400">
                <IconLoader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p>
                  Loading database operators
                  {dbLoadProgress.total > 0 ? ` (${dbLoadProgress.loaded}/${dbLoadProgress.total})` : "..."}
                </p>
              </div>
            ) : matchedUsers.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <IconUsers className="h-8 w-8 mx-auto mb-2" />
                <p>No matching manpower found in the database.</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[520px] border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Indicator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedUsers.map((student) => (
                      <TableRow key={student._id}>
                        <TableCell className="font-medium">{student.fullName || "-"}</TableCell>
                        <TableCell>{student.empId || "-"}</TableCell>
                        <TableCell>{getDeptDisplay(student)}</TableCell>
                        <TableCell>{getSectionDisplay(student)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{normalizeStatus(student.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-50 text-green-700 border border-green-200">
                            <IconCheck className="h-3 w-3 mr-1" />
                            In Excel &amp; DB
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid 2: Manpower present in Database but missing from Excel */}
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Missing From Excel</h2>
                <p className="text-sm text-gray-500">Exist in the database but not present in the uploaded sheet.</p>
              </div>
              <div className="flex items-center gap-2">
                {hasUploadedFile && !isLoadingDb && (
                  <Badge variant="outline" className="whitespace-nowrap">
                    {missingUsers.length} {missingUsers.length === 1 ? "User" : "Users"}
                  </Badge>
                )}
                <Button variant="outline" onClick={loadDbStudents} disabled={isLoadingDb}>
                  {isLoadingDb ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconRefresh className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!hasUploadedFile ? (
              <div className="text-center py-10 text-gray-400">
                <IconUpload className="h-8 w-8 mx-auto mb-2" />
                <p>Upload an Excel sheet to see discrepancies here.</p>
              </div>
            ) : isLoadingDb ? (
              <div className="text-center py-10 text-gray-400">
                <IconLoader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p>
                  Loading database operators
                  {dbLoadProgress.total > 0 ? ` (${dbLoadProgress.loaded}/${dbLoadProgress.total})` : "..."}
                </p>
              </div>
            ) : missingUsers.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <IconUsers className="h-8 w-8 mx-auto mb-2" />
                <p>No discrepancies found.</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[520px] border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date of Joining</TableHead>
                      <TableHead>Indicator</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingUsers.map((student) => (
                      <TableRow key={student._id}>
                        <TableCell className="font-medium">{student.fullName || "-"}</TableCell>
                        <TableCell>{student.empId || "-"}</TableCell>
                        <TableCell>{getDeptDisplay(student)}</TableCell>
                        <TableCell>{getSectionDisplay(student)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{normalizeStatus(student.status)}</Badge>
                        </TableCell>
                        <TableCell>{safeDateFormat(student.joiningDate, "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <Badge className="bg-red-50 text-red-700 border border-red-200">
                            <IconX className="h-3 w-3 mr-1" />
                            Missing
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canUpdate && (
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(student)}>
                                <IconPencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600"
                                onClick={() => openDeleteDialog(student)}
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconPencil className="h-5 w-5 text-blue-600" />
              Edit Operator
            </DialogTitle>
            <DialogDescription>Update the operator's details.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cmp-fullName">Name *</Label>
              <Input
                id="cmp-fullName"
                value={editFormData.fullName}
                onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cmp-empId">Employee ID *</Label>
              <Input
                id="cmp-empId"
                value={editFormData.empId}
                onChange={(e) => setEditFormData({ ...editFormData, empId: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="cmp-department"
                label="Department"
                value={editFormData.departmentId}
                onValueChange={(value) => setEditFormData({ ...editFormData, departmentId: value, sectionId: "" })}
                options={departments.map((d) => ({ value: String(d._id || d.id), label: d.name }))}
                placeholder="Select Department"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="cmp-section"
                label="Section"
                disabled={!editFormData.departmentId}
                value={editFormData.sectionId}
                onValueChange={(value) => setEditFormData({ ...editFormData, sectionId: value })}
                options={sections.map((s) => ({ value: String(s._id || s.id), label: s.name }))}
                placeholder="Select Section"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cmp-status">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger id="cmp-status">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  <SelectItem value="LEFT">Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cmp-joiningDate">Date of Joining</Label>
              <Input
                id="cmp-joiningDate"
                type="date"
                value={editFormData.joiningDate}
                onChange={(e) => setEditFormData({ ...editFormData, joiningDate: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStudent} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteStudent}
        title="Delete Operator"
        description={`Are you sure you want to delete ${selectedStudent?.fullName || "this operator"}? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={isSubmitting}
      />
    </div>
  );
};

export default StudentComparison;
