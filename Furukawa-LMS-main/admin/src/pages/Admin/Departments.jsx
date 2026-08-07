// src/pages/Admin/Departments.jsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGetAllDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useAssignInstructorMutation,
  useAddStudentToDepartmentMutation,
  useRemoveStudentFromDepartmentMutation,
  useRemoveInstructorMutation,
  useCancelDepartmentMutation,
} from "@/Redux/AllApi/DepartmentApi";
import { useGetAllUsersQuery } from "@/Redux/AllApi/UserApi";
import { useGetCoursesQuery } from "@/Redux/AllApi/CourseApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
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
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconUsers,
  IconSchool,
  IconUserPlus,
  IconFilter,
  IconX,
  IconLoader,
  IconRefresh,
  IconExternalLink,
  IconUser,
  IconBook,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import StatCard from "@/components/common/StatCard";
import FilterBar from "@/components/common/FilterBar";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from 'react-redux';
import DepartmentStatusNotifications from "@/components/departments/DepartmentStatusNotifications";
import { useLazyExportDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";

// Cascading Department -> Section -> Line picker used to configure which target
// dept/section/line is authorized to approve this source department's Daily 5M records.
const Daily5MRoutingFields = ({
  idPrefix,
  formData,
  setFormData,
  departments,
  sections,
  isLoadingSections,
  lines,
  isLoadingLines,
}) => (
  <div className="grid gap-3">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-medium">Daily 5M Approver Routing</Label>
      {formData.daily5mApproverDeptId && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() =>
            setFormData((prev) => ({
              ...prev,
              daily5mApproverDeptId: "",
              daily5mApproverSectionId: "",
              daily5mApproverLineId: "",
            }))
          }
        >
          Clear
        </Button>
      )}
    </div>

    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-approver-dept`}>Approver Department</Label>
      <Select
        value={formData.daily5mApproverDeptId ? String(formData.daily5mApproverDeptId) : ""}
        onValueChange={(value) =>
          setFormData((prev) => ({
            ...prev,
            daily5mApproverDeptId: value ? Number(value) : "",
            daily5mApproverSectionId: "",
            daily5mApproverLineId: "",
          }))
        }
      >
        <SelectTrigger id={`${idPrefix}-approver-dept`}>
          <SelectValue placeholder="No routing (default rules apply)" />
        </SelectTrigger>
        <SelectContent>
          {departments.length > 0 ? (
            departments.map((d) => (
              <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>
                {d.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              No departments available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>

    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-approver-section`}>Approver Section (Optional)</Label>
      <Select
        value={formData.daily5mApproverSectionId ? String(formData.daily5mApproverSectionId) : ""}
        onValueChange={(value) =>
          setFormData((prev) => ({
            ...prev,
            daily5mApproverSectionId: value ? Number(value) : "",
            daily5mApproverLineId: "",
          }))
        }
        disabled={!formData.daily5mApproverDeptId}
      >
        <SelectTrigger id={`${idPrefix}-approver-section`}>
          <SelectValue placeholder={formData.daily5mApproverDeptId ? "Any section" : "Select department first"} />
        </SelectTrigger>
        <SelectContent>
          {isLoadingSections ? (
            <SelectItem value="loading" disabled>
              Loading sections...
            </SelectItem>
          ) : sections.length > 0 ? (
            sections.map((s) => (
              <SelectItem key={s.id || s._id} value={String(s.id || s._id)}>
                {s.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              No sections available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>

    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-approver-line`}>Approver Line (Optional)</Label>
      <Select
        value={formData.daily5mApproverLineId ? String(formData.daily5mApproverLineId) : ""}
        onValueChange={(value) =>
          setFormData((prev) => ({
            ...prev,
            daily5mApproverLineId: value ? Number(value) : "",
          }))
        }
        disabled={!formData.daily5mApproverSectionId}
      >
        <SelectTrigger id={`${idPrefix}-approver-line`}>
          <SelectValue placeholder={formData.daily5mApproverSectionId ? "Any line" : "Select section first"} />
        </SelectTrigger>
        <SelectContent>
          {isLoadingLines ? (
            <SelectItem value="loading" disabled>
              Loading lines...
            </SelectItem>
          ) : lines.length > 0 ? (
            lines.map((l) => (
              <SelectItem key={l.id || l._id} value={String(l.id || l._id)}>
                {l.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              No lines available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  </div>
);

// Resolves and displays a department's configured Daily 5M approver routing (dept › section › line)
// as a compact badge with a tooltip breakdown. Each row mounts its own instance so the section/line
// name lookups only fire for departments that actually have routing configured.
const Daily5MRoutingBadge = ({ department, allDepartments }) => {
  const deptId = department.daily5mApproverDeptId;
  const sectionId = department.daily5mApproverSectionId;
  const lineId = department.daily5mApproverLineId;

  const { data: sectionsData } = useGetSectionsByDepartmentQuery(deptId, { skip: !deptId || !sectionId });
  const { data: linesData } = useGetLinesBySectionQuery(sectionId, { skip: !sectionId || !lineId });

  if (!deptId) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-xs whitespace-nowrap">
        Not configured
      </Badge>
    );
  }

  const targetDeptName = allDepartments.find((d) => String(d.id || d._id) === String(deptId))?.name || `Dept #${deptId}`;
  const targetSectionName = sectionId
    ? (sectionsData?.data || []).find((s) => String(s.id || s._id) === String(sectionId))?.name
    : null;
  const targetLineName = lineId
    ? (linesData?.data || []).find((l) => String(l.id || l._id) === String(lineId))?.name
    : null;

  const parts = [targetDeptName, targetSectionName, targetLineName].filter(Boolean);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-xs cursor-default max-w-[170px] truncate block">
            {parts.join(" › ")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-0.5 text-xs">
            <span>Department: {targetDeptName}</span>
            {targetSectionName && <span>Section: {targetSectionName}</span>}
            {targetLineName && <span>Line: {targetLineName}</span>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Skill Matrix footer signatures are signed off independently by three roles (QA, Safety, Process),
// each typically owned by a different team, so — unlike Daily 5M's single routing target — routing
// is configured per role. See shared/skillMatrixRouting.js for the resolution/enforcement rule this
// UI must stay in sync with.
const SKILL_MATRIX_ROLES = [
  { key: "Qa", label: "QA" },
  { key: "Safety", label: "Safety" },
  { key: "Process", label: "Process" },
];

// Cascading Department -> Section -> Line picker for one Skill Matrix signature role's approval
// routing. Mirrors Daily5MRoutingFields but keyed by `role` (e.g. "Qa") so the same component
// renders once per role instead of needing three near-identical copies.
const SkillMatrixRoutingFields = ({
  idPrefix,
  role,
  roleLabel,
  formData,
  setFormData,
  departments,
  sections,
  isLoadingSections,
  lines,
  isLoadingLines,
}) => {
  const deptField = `skillMatrixApprover${role}DeptId`;
  const sectionField = `skillMatrixApprover${role}SectionId`;
  const lineField = `skillMatrixApprover${role}LineId`;

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{roleLabel} Approver Routing</Label>
        {formData[deptField] && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                [deptField]: "",
                [sectionField]: "",
                [lineField]: "",
              }))
            }
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-${role}-approver-dept`}>Approver Department</Label>
        <Select
          value={formData[deptField] ? String(formData[deptField]) : ""}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              [deptField]: value ? Number(value) : "",
              [sectionField]: "",
              [lineField]: "",
            }))
          }
        >
          <SelectTrigger id={`${idPrefix}-${role}-approver-dept`}>
            <SelectValue placeholder="No routing (anyone with access may sign)" />
          </SelectTrigger>
          <SelectContent>
            {departments.length > 0 ? (
              departments.map((d) => (
                <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>
                  {d.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No departments available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-${role}-approver-section`}>Approver Section (Optional)</Label>
        <Select
          value={formData[sectionField] ? String(formData[sectionField]) : ""}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              [sectionField]: value ? Number(value) : "",
              [lineField]: "",
            }))
          }
          disabled={!formData[deptField]}
        >
          <SelectTrigger id={`${idPrefix}-${role}-approver-section`}>
            <SelectValue placeholder={formData[deptField] ? "Any section" : "Select department first"} />
          </SelectTrigger>
          <SelectContent>
            {isLoadingSections ? (
              <SelectItem value="loading" disabled>
                Loading sections...
              </SelectItem>
            ) : sections.length > 0 ? (
              sections.map((s) => (
                <SelectItem key={s.id || s._id} value={String(s.id || s._id)}>
                  {s.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No sections available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-${role}-approver-line`}>Approver Line (Optional)</Label>
        <Select
          value={formData[lineField] ? String(formData[lineField]) : ""}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              [lineField]: value ? Number(value) : "",
            }))
          }
          disabled={!formData[sectionField]}
        >
          <SelectTrigger id={`${idPrefix}-${role}-approver-line`}>
            <SelectValue placeholder={formData[sectionField] ? "Any line" : "Select section first"} />
          </SelectTrigger>
          <SelectContent>
            {isLoadingLines ? (
              <SelectItem value="loading" disabled>
                Loading lines...
              </SelectItem>
            ) : lines.length > 0 ? (
              lines.map((l) => (
                <SelectItem key={l.id || l._id} value={String(l.id || l._id)}>
                  {l.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No lines available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

// Resolves and displays one Skill Matrix signature role's configured routing (dept › section › line)
// as a compact badge with a tooltip breakdown. A separate component (rather than a loop inside
// SkillMatrixRoutingBadge) so each role's section/line name lookups are independent hook instances.
const SkillMatrixRoleBadge = ({ department, allDepartments, role, roleLabel }) => {
  const deptId = department[`skillMatrixApprover${role}DeptId`];
  const sectionId = department[`skillMatrixApprover${role}SectionId`];
  const lineId = department[`skillMatrixApprover${role}LineId`];

  const { data: sectionsData } = useGetSectionsByDepartmentQuery(deptId, { skip: !deptId || !sectionId });
  const { data: linesData } = useGetLinesBySectionQuery(sectionId, { skip: !sectionId || !lineId });

  if (!deptId) {
    return (
      <Badge variant="outline" className="text-muted-foreground text-[10px] whitespace-nowrap">
        {roleLabel}: Not configured
      </Badge>
    );
  }

  const targetDeptName = allDepartments.find((d) => String(d.id || d._id) === String(deptId))?.name || `Dept #${deptId}`;
  const targetSectionName = sectionId
    ? (sectionsData?.data || []).find((s) => String(s.id || s._id) === String(sectionId))?.name
    : null;
  const targetLineName = lineId
    ? (linesData?.data || []).find((l) => String(l.id || l._id) === String(lineId))?.name
    : null;

  const parts = [targetDeptName, targetSectionName, targetLineName].filter(Boolean);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-[10px] cursor-default max-w-[170px] truncate block">
            {roleLabel}: {parts.join(" › ")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-0.5 text-xs">
            <span>{roleLabel} approver department: {targetDeptName}</span>
            {targetSectionName && <span>Section: {targetSectionName}</span>}
            {targetLineName && <span>Line: {targetLineName}</span>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const SkillMatrixRoutingBadge = ({ department, allDepartments }) => (
  <div className="flex flex-col items-start gap-1">
    {SKILL_MATRIX_ROLES.map((role) => (
      <SkillMatrixRoleBadge
        key={role.key}
        department={department}
        allDepartments={allDepartments}
        role={role.key}
        roleLabel={role.label}
      />
    ))}
  </div>
);

const Departments = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignInstructorDialogOpen, setIsAssignInstructorDialogOpen] =
    useState(false);
  const [isManageStudentsDialogOpen, setIsManageStudentsDialogOpen] =
    useState(false);
  const [isCancelDepartmentDialogOpen, setIsCancelDepartmentDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelingDepartment, setIsCancelingDepartment] = useState(false);
  const [lastToastId, setLastToastId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    uniCode: "",
    instructorId: "",
    courseId: "",
    startDate: "",
    endDate: "",
    capacity: 50,
    status: "UPCOMING",
    daily5mApproverDeptId: "",
    daily5mApproverSectionId: "",
    daily5mApproverLineId: "",
    skillMatrixApproverQaDeptId: "",
    skillMatrixApproverQaSectionId: "",
    skillMatrixApproverQaLineId: "",
    skillMatrixApproverSafetyDeptId: "",
    skillMatrixApproverSafetySectionId: "",
    skillMatrixApproverSafetyLineId: "",
    skillMatrixApproverProcessDeptId: "",
    skillMatrixApproverProcessSectionId: "",
    skillMatrixApproverProcessLineId: "",
  });
  // Which routing target the "Daily 5M Approver Routing" fields currently edit: "dept" for the
  // department-wide fields in `formData` above, or a section id to edit/override that section's
  // own routing (falls back to department-level routing when unset — see shared/daily5mRouting.js).
  const [selectedSourceSectionId, setSelectedSourceSectionId] = useState("dept");
  const [sectionRoutings, setSectionRoutings] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [cancelReason, setCancelReason] = useState("");

  const navigate = useNavigate();

  // Get current user from Redux store
  const { user } = useSelector((state) => state.auth);

  const hasPermission = (permission) => {
    if (user?.role === "SUPERADMIN" || user?.role === "ADMIN") return true;
    return user?.customRole?.permissions?.includes(permission);
  };

  const canRead = hasPermission("department:read");
  const canCreate = hasPermission("department:create");
  const canUpdate = hasPermission("department:update");
  const canDelete = hasPermission("department:delete");
  const canManageStudents = hasPermission("department:manage_students");

  // searchTerm is already debounced by SearchInput before it reaches us;
  // reset to page 1 whenever the effective search or status filter changes.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  // API Hooks
  const {
    data: departmentsData,
    isLoading,
    isFetching,
    error: departmentsError,
    refetch,
  } = useGetAllDepartmentsQuery(
    {
      page,
      limit: 30,
      search: searchTerm || "",
      status: statusFilter !== "ALL" ? statusFilter : "",
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  const isFetchingNextPage = isFetching && !isLoading;

  // After a mutation, reload from page 1 instead of re-fetching whatever page
  // the user has scrolled to — re-fetching a later page would append onto the
  // merged infinite-scroll cache again and duplicate rows.
  const reloadDepartments = () => {
    if (page === 1) {
      refetch();
    } else {
      setPage(1);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();

  // Handle auto-open edit dialog from URL params causing navigation from details page


  const {
    data: instructorsData,
    isLoading: instructorsLoading,
    error: instructorsError,
  } = useGetAllUsersQuery(
    { page: 1, limit: 100, role: "INSTRUCTOR" },
    {
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  const {
    data: studentsData,
    isLoading: studentsLoading,
    error: studentsError,
  } = useGetAllUsersQuery(
    { page: 1, limit: 200, role: "STUDENT" },
    {
      refetchOnFocus: false,
      refetchOnReconnect: false,
      skip: !isManageStudentsDialogOpen,
    }
  );

  // Add courses query
  const {
    data: coursesData,
    isLoading: coursesLoading,
    error: coursesError,
  } = useGetCoursesQuery(
    { page: 1, limit: 100 },
    {
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  // All departments (unpaginated) — used both for the table's "5M Approver" column
  // (resolving routing target names) and for the Approver Department dropdown in the
  // Create/Edit dialogs, plus the cascading section/line lookups for whatever is selected.
  const { data: allDepartmentsForRoutingData } = useGetAllDepartmentsQuery(
    { page: 1, limit: 1000 },
    { refetchOnFocus: false, refetchOnReconnect: false }
  );
  const allDepartmentsForRouting = allDepartmentsForRoutingData?.data?.departments || [];

  // Sections belonging to the department being edited — populates the "Source Section" dropdown
  // and seeds `sectionRoutings` below with whatever routing each section already has configured.
  const { data: sourceSectionsData, isFetching: isLoadingSourceSections } = useGetSectionsByDepartmentQuery(
    selectedDepartment?.id || selectedDepartment?._id,
    { skip: !isEditDialogOpen || !selectedDepartment }
  );
  const sourceSections = sourceSectionsData?.data || [];

  useEffect(() => {
    if (!isEditDialogOpen || !sourceSectionsData?.data) return;
    const initial = {};
    sourceSectionsData.data.forEach((s) => {
      const sectionId = String(s.id || s._id);
      initial[sectionId] = {
        daily5mApproverDeptId: s.daily5mApproverDeptId || "",
        daily5mApproverSectionId: s.daily5mApproverSectionId || "",
        daily5mApproverLineId: s.daily5mApproverLineId || "",
        skillMatrixApproverQaDeptId: s.skillMatrixApproverQaDeptId || "",
        skillMatrixApproverQaSectionId: s.skillMatrixApproverQaSectionId || "",
        skillMatrixApproverQaLineId: s.skillMatrixApproverQaLineId || "",
        skillMatrixApproverSafetyDeptId: s.skillMatrixApproverSafetyDeptId || "",
        skillMatrixApproverSafetySectionId: s.skillMatrixApproverSafetySectionId || "",
        skillMatrixApproverSafetyLineId: s.skillMatrixApproverSafetyLineId || "",
        skillMatrixApproverProcessDeptId: s.skillMatrixApproverProcessDeptId || "",
        skillMatrixApproverProcessSectionId: s.skillMatrixApproverProcessSectionId || "",
        skillMatrixApproverProcessLineId: s.skillMatrixApproverProcessLineId || "",
      };
    });
    setSectionRoutings(initial);
  }, [isEditDialogOpen, sourceSectionsData]);

  const EMPTY_ROUTING = {
    daily5mApproverDeptId: "", daily5mApproverSectionId: "", daily5mApproverLineId: "",
    skillMatrixApproverQaDeptId: "", skillMatrixApproverQaSectionId: "", skillMatrixApproverQaLineId: "",
    skillMatrixApproverSafetyDeptId: "", skillMatrixApproverSafetySectionId: "", skillMatrixApproverSafetyLineId: "",
    skillMatrixApproverProcessDeptId: "", skillMatrixApproverProcessSectionId: "", skillMatrixApproverProcessLineId: "",
  };

  // The Daily5MRoutingFields/SkillMatrixRoutingFields components just read/write formData's
  // *ApproverDeptId/SectionId/LineId fields; this wrapper redirects those reads/writes to either the
  // department-level `formData` fields or the selected section's entry in `sectionRoutings`, so the
  // same components work for both without changes.
  const activeRoutingValue = selectedSourceSectionId === "dept"
    ? formData
    : (sectionRoutings[selectedSourceSectionId] || EMPTY_ROUTING);

  const setActiveRoutingValue = (updater) => {
    if (selectedSourceSectionId === "dept") {
      setFormData(updater);
    } else {
      setSectionRoutings((prev) => {
        const current = prev[selectedSourceSectionId] || EMPTY_ROUTING;
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [selectedSourceSectionId]: next };
      });
    }
  };

  const { data: routingSectionsData, isFetching: isLoadingRoutingSections } = useGetSectionsByDepartmentQuery(
    activeRoutingValue.daily5mApproverDeptId,
    { skip: !activeRoutingValue.daily5mApproverDeptId }
  );
  const routingSections = routingSectionsData?.data || [];

  const { data: routingLinesData, isFetching: isLoadingRoutingLines } = useGetLinesBySectionQuery(
    activeRoutingValue.daily5mApproverSectionId,
    { skip: !activeRoutingValue.daily5mApproverSectionId }
  );
  const routingLines = routingLinesData?.data || [];

  // One cascading section/line query pair per Skill Matrix signature role — all three roles' fields
  // are shown at once (unlike Daily 5M's single set above), so each needs its own live lookup.
  const { data: routingSectionsQaData, isFetching: isLoadingRoutingSectionsQa } = useGetSectionsByDepartmentQuery(
    activeRoutingValue.skillMatrixApproverQaDeptId,
    { skip: !activeRoutingValue.skillMatrixApproverQaDeptId }
  );
  const routingSectionsQa = routingSectionsQaData?.data || [];
  const { data: routingLinesQaData, isFetching: isLoadingRoutingLinesQa } = useGetLinesBySectionQuery(
    activeRoutingValue.skillMatrixApproverQaSectionId,
    { skip: !activeRoutingValue.skillMatrixApproverQaSectionId }
  );
  const routingLinesQa = routingLinesQaData?.data || [];

  const { data: routingSectionsSafetyData, isFetching: isLoadingRoutingSectionsSafety } = useGetSectionsByDepartmentQuery(
    activeRoutingValue.skillMatrixApproverSafetyDeptId,
    { skip: !activeRoutingValue.skillMatrixApproverSafetyDeptId }
  );
  const routingSectionsSafety = routingSectionsSafetyData?.data || [];
  const { data: routingLinesSafetyData, isFetching: isLoadingRoutingLinesSafety } = useGetLinesBySectionQuery(
    activeRoutingValue.skillMatrixApproverSafetySectionId,
    { skip: !activeRoutingValue.skillMatrixApproverSafetySectionId }
  );
  const routingLinesSafety = routingLinesSafetyData?.data || [];

  const { data: routingSectionsProcessData, isFetching: isLoadingRoutingSectionsProcess } = useGetSectionsByDepartmentQuery(
    activeRoutingValue.skillMatrixApproverProcessDeptId,
    { skip: !activeRoutingValue.skillMatrixApproverProcessDeptId }
  );
  const routingSectionsProcess = routingSectionsProcessData?.data || [];
  const { data: routingLinesProcessData, isFetching: isLoadingRoutingLinesProcess } = useGetLinesBySectionQuery(
    activeRoutingValue.skillMatrixApproverProcessSectionId,
    { skip: !activeRoutingValue.skillMatrixApproverProcessSectionId }
  );
  const routingLinesProcess = routingLinesProcessData?.data || [];

  const skillMatrixRoutingQueryData = {
    Qa: { sections: routingSectionsQa, isLoadingSections: isLoadingRoutingSectionsQa, lines: routingLinesQa, isLoadingLines: isLoadingRoutingLinesQa },
    Safety: { sections: routingSectionsSafety, isLoadingSections: isLoadingRoutingSectionsSafety, lines: routingLinesSafety, isLoadingLines: isLoadingRoutingLinesSafety },
    Process: { sections: routingSectionsProcess, isLoadingSections: isLoadingRoutingSectionsProcess, lines: routingLinesProcess, isLoadingLines: isLoadingRoutingLinesProcess },
  };

  const [createDepartment] = useCreateDepartmentMutation();
  const [updateDepartment] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const [assignInstructor] = useAssignInstructorMutation();
  const [addStudentToDepartment] = useAddStudentToDepartmentMutation();
  const [removeStudentFromDepartment] = useRemoveStudentFromDepartmentMutation();
  const [removeInstructor, { isLoading: isRemovingInstructor }] =
    useRemoveInstructorMutation();
  const [cancelDepartment] = useCancelDepartmentMutation();
  const [triggerExportDepartments, { isFetching: isExportingDepartments }] = useLazyExportDepartmentsQuery();
  const [logAction] = useLogActionMutation();

  const departments = departmentsData?.data?.departments || [];

  // Handle auto-open edit dialog from URL params causing navigation from details page
  useEffect(() => {
    const editValues = searchParams.get("editDepartment");
    const assignInstructorId = searchParams.get("assignInstructor");

    if (departments && departments.length > 0) {
      if (editValues) {
        const deptToEdit = departments.find(d => (d.id || d._id) === editValues);
        if (deptToEdit) {
          openEditDialog(deptToEdit);
          // Clear param
          setSearchParams({});
        }
      } else if (assignInstructorId) {
        const deptToAssign = departments.find(d => (d.id || d._id) === assignInstructorId);
        if (deptToAssign) {
          openAssignInstructorDialog(deptToAssign);
          // Clear param
          setSearchParams({});
        }
      }
    }
  }, [searchParams, departments]);
  useEffect(() => {
    logAction({
      action: "VIEW_DEPARTMENTS_LIST",
      details: { page, searchTerm, statusFilter },
    });
  }, [page, searchTerm, statusFilter]);

  const totalPages = departmentsData?.data?.totalPages || 1;
  const totalCount = departmentsData?.data?.totalDepartments || 0;
  const instructors = instructorsData?.data?.users || [];
  const students = studentsData?.data?.users || [];
  const allCourses = coursesData?.data?.courses || [];

  // Infinite scroll: load the next batch of departments when the sentinel
  // row at the bottom of the table scrolls into view.
  const scrollSentinelRef = useRef(null);
  const isFetchingRef = useRef(isFetching);
  useEffect(() => {
    isFetchingRef.current = isFetching;
  }, [isFetching]);

  useEffect(() => {
    const node = scrollSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingRef.current && page < totalPages) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [page, totalPages]);

  // Filter options
  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "UPCOMING", label: "Upcoming" },
    { value: "ONGOING", label: "Ongoing" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "HAS_INSTRUCTOR", label: "Has Instructor" },
    { value: "NO_INSTRUCTOR", label: "No Instructor" },
  ];

  // Active filters
  const activeFilters = useMemo(() => {
    const filters = [];

    if (statusFilter !== "ALL") {
      const statusLabel = statusOptions.find(
        (opt) => opt.value === statusFilter
      )?.label;
      filters.push({ label: "Status", value: statusLabel });
    }

    if (searchTerm) {
      filters.push({ label: "Search", value: searchTerm });
    }

    return filters;
  }, [statusFilter, searchTerm, statusOptions]);

  // Apply role-based restrictions to the (already server-filtered by status/search) departments
  const filteredDepartments = useMemo(() => {
    const isRestricted = user?.role !== 'SUPERADMIN' && user?.isAdmin !== true;
    if (!isRestricted) return departments;

    // Get assigned department info
    const assignedIds = new Set();
    if (Array.isArray(user?.departments)) {
      user.departments.forEach(id => assignedIds.add(String(id)));
    }
    if (user?.departmentId) assignedIds.add(String(user.departmentId));
    if (user?.department?._id) assignedIds.add(String(user.department._id));

    const userDeptName = user?.deptName?.trim().toLowerCase();

    // ONLY FILTER if there is actually an assignment to restrict by
    // Otherwise, the user can see everything in this layout
    if (assignedIds.size === 0 && !userDeptName) return departments;

    return departments.filter(dept => {
      const dId = String(dept.id || dept._id);
      const hasIdMatch = assignedIds.has(dId);
      const hasNameMatch = userDeptName && dept.name?.trim().toLowerCase() === userDeptName;
      return hasIdMatch || hasNameMatch;
    });
  }, [departments, user]);

  // Toast helper
  const showToast = useCallback(
    (type, message) => {
      if (lastToastId) {
        toast.dismiss(lastToastId);
      }
      let toastId;
      if (type === "success") {
        toastId = toast.success(message);
      } else if (type === "error") {
        toastId = toast.error(message);
      } else {
        toastId = toast(message);
      }
      setLastToastId(toastId);
    },
    [lastToastId]
  );

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: "" });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      uniCode: "",
      instructorId: "",
      courseId: "",
      startDate: "",
      endDate: "",
      capacity: 50,
      status: "UPCOMING",
      daily5mApproverDeptId: "",
      daily5mApproverSectionId: "",
      daily5mApproverLineId: "",
      skillMatrixApproverQaDeptId: "",
      skillMatrixApproverQaSectionId: "",
      skillMatrixApproverQaLineId: "",
      skillMatrixApproverSafetyDeptId: "",
      skillMatrixApproverSafetySectionId: "",
      skillMatrixApproverSafetyLineId: "",
      skillMatrixApproverProcessDeptId: "",
      skillMatrixApproverProcessSectionId: "",
      skillMatrixApproverProcessLineId: "",
    });
    setFormErrors({});
    setSelectedStudents([]);
    setSelectedCourses([]);
    setSelectedSourceSectionId("dept");
    setSectionRoutings({});
  };

  const handleCreateDepartment = async () => {
    if (!canCreate) return;
    try {
      if (!formData.name) {
        setFormErrors({ name: "Department name is required" });
        return;
      }

      setIsSubmitting(true);
      await createDepartment({
        ...formData,
        courseIds: selectedCourses,
      }).unwrap();

      logAction({
        action: "CREATE_DEPARTMENT",
        details: {
          name: formData.name,
          uniCode: formData.uniCode,
          capacity: formData.capacity,
          status: formData.status,
          courseIds: selectedCourses,
        },
      });

      showToast("success", "Department created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      reloadDepartments();
    } catch (err) {
      showToast("error", err?.data?.message || "Failed to create department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDepartment = async () => {
    if (!canUpdate) return;
    try {
      if (!formData.name) {
        setFormErrors({ name: "Department name is required" });
        return;
      }

      setIsSubmitting(true);
      const sectionRoutingsPayload = Object.entries(sectionRoutings).map(([sectionId, routing]) => ({
        sectionId: Number(sectionId),
        daily5mApproverDeptId: routing.daily5mApproverDeptId || null,
        daily5mApproverSectionId: routing.daily5mApproverSectionId || null,
        daily5mApproverLineId: routing.daily5mApproverLineId || null,
        skillMatrixApproverQaDeptId: routing.skillMatrixApproverQaDeptId || null,
        skillMatrixApproverQaSectionId: routing.skillMatrixApproverQaSectionId || null,
        skillMatrixApproverQaLineId: routing.skillMatrixApproverQaLineId || null,
        skillMatrixApproverSafetyDeptId: routing.skillMatrixApproverSafetyDeptId || null,
        skillMatrixApproverSafetySectionId: routing.skillMatrixApproverSafetySectionId || null,
        skillMatrixApproverSafetyLineId: routing.skillMatrixApproverSafetyLineId || null,
        skillMatrixApproverProcessDeptId: routing.skillMatrixApproverProcessDeptId || null,
        skillMatrixApproverProcessSectionId: routing.skillMatrixApproverProcessSectionId || null,
        skillMatrixApproverProcessLineId: routing.skillMatrixApproverProcessLineId || null,
      }));

      await updateDepartment({
        id: selectedDepartment.id || selectedDepartment._id,
        data: {
          ...formData,
          courseIds: selectedCourses,
          sectionRoutings: sectionRoutingsPayload,
        },
      }).unwrap();

      logAction({
        action: "UPDATE_DEPARTMENT",
        details: {
          id: selectedDepartment.id || selectedDepartment._id,
          name: formData.name,
          uniCode: formData.uniCode,
          status: formData.status,
          courseIds: selectedCourses,
        },
      });

      showToast("success", "Department updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      reloadDepartments();
    } catch (err) {
      showToast("error", err?.data?.message || "Failed to update department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!canDelete) return;
    try {
      await deleteDepartment(selectedDepartment.id || selectedDepartment._id).unwrap();
      logAction({
        action: "DELETE_DEPARTMENT",
        details: {
          id: selectedDepartment.id || selectedDepartment._id,
          name: selectedDepartment.name,
        },
      });
      showToast("success", "Department deleted successfully");
      setIsDeleteDialogOpen(false);
      reloadDepartments();
    } catch (err) {
      showToast("error", err?.data?.message || "Failed to delete department");
    }
  };

  const handleAssignInstructor = async (instructorId) => {
    if (!canUpdate) return;
    try {
      await assignInstructor({
        departmentId: selectedDepartment.id || selectedDepartment._id,
        instructorId,
      }).unwrap();
      logAction({
        action: "ASSIGN_TRAINER_TO_DEPARTMENT",
        details: {
          departmentId: selectedDepartment.id || selectedDepartment._id,
          departmentName: selectedDepartment.name,
          instructorId,
        },
      });
      showToast("success", "Trainer assigned successfully");
      setIsAssignInstructorDialogOpen(false);
      reloadDepartments();
    } catch (err) {
      showToast("error", err?.data?.message || "Failed to assign trainer");
    }
  };

  const handleRemoveInstructor = async (e) => {
    e.stopPropagation();
    if (!canUpdate) return;
    try {
      await removeInstructor(selectedDepartment.id || selectedDepartment._id).unwrap();
      logAction({
        action: "REMOVE_TRAINER_FROM_DEPARTMENT",
        details: {
          departmentId: selectedDepartment.id || selectedDepartment._id,
          departmentName: selectedDepartment.name,
        },
      });
      showToast("success", "Trainer removed successfully");
      setIsAssignInstructorDialogOpen(false);
      reloadDepartments();
    } catch (err) {
      showToast("error", err?.data?.message || "Failed to remove trainer");
    }
  };

  const handleCancelDepartment = async () => {
    if (!selectedDepartment || !canUpdate) return;

    try {
      setIsCancelingDepartment(true);
      await cancelDepartment({
        id: selectedDepartment.id || selectedDepartment._id,
        reason: cancelReason
      }).unwrap();

      logAction({
        action: "CANCEL_DEPARTMENT",
        details: {
          departmentId: selectedDepartment.id || selectedDepartment._id,
          departmentName: selectedDepartment.name,
          reason: cancelReason,
        },
      });

      showToast("success", "Department cancelled successfully");
      setIsCancelDepartmentDialogOpen(false);
      setCancelReason("");
      reloadDepartments();
    } catch (err) {
      showToast("error", err?.data?.message || "Failed to cancel department");
    } finally {
      setIsCancelingDepartment(false);
    }
  };

  const handleAddStudents = async () => {
    if (!canManageStudents) return;
    // Safely extract valid IDs and filter out any undefined/nulls
    const validStudentIds = [...new Set(selectedStudents)].filter(Boolean);

    if (validStudentIds.length === 0) {
      toast.error("Please select at least one valid operator");
      return;
    }

    try {
      // Use single bulk API request
      await addStudentToDepartment({
        departmentId: selectedDepartment.id || selectedDepartment._id,
        studentIds: validStudentIds,
      }).unwrap();

      logAction({
        action: "ADD_STUDENTS_TO_DEPARTMENT",
        details: {
          departmentId: selectedDepartment.id || selectedDepartment._id,
          departmentName: selectedDepartment.name,
          studentIds: validStudentIds,
        },
      });

      showToast("success", "Students added successfully");
      setIsManageStudentsDialogOpen(false);
      setSelectedStudents([]);
      reloadDepartments();
    } catch (err) {
      console.error(err);
      showToast("error", err?.data?.message || err.message || "Failed to add students");
    }
  };

  const handleRemoveStudent = async ({ departmentId, studentId, studentName }) => {
    if (!canManageStudents) return;
    const isConfirmed = window.confirm(
      `Are you sure you want to remove ${studentName} from this department?`
    );

    if (!isConfirmed) return;

    try {
      await removeStudentFromDepartment({ departmentId, studentId }).unwrap();
      logAction({
        action: "REMOVE_STUDENT_FROM_DEPARTMENT",
        details: { departmentId, studentId, studentName },
      });
      showToast("success", "Student removed successfully");
      reloadDepartments();

      // Update local state if dialog is open
      if (selectedDepartment && (selectedDepartment.id || selectedDepartment._id) === departmentId) {
        setSelectedDepartment(prev => ({
          ...prev,
          students: prev.students.filter(s => (s.id || s._id) !== studentId)
        }));
      }
    } catch (err) {
      showToast("error", err?.data?.message || "Failed to remove student");
    }
  };

  const openEditDialog = (department) => {
    if (!canUpdate) return;
    setSelectedDepartment(department);
    setSelectedSourceSectionId("dept");
    setSectionRoutings({});
    // Handle legacy course vs courses array - Normalize to strings
    const deptCourses = department.courses && department.courses.length > 0
      ? department.courses.map(c => String(c._id || c.id))
      : (department.course ? [String(department.course._id || department.course.id)] : []);

    setFormData({
      name: department.name,
      uniCode: department.uniCode || "",
      instructorId: (department.instructor?.id || department.instructor?._id) ? String(department.instructor.id || department.instructor._id) : "",
      courseId: "", // Legacy field cleared
      startDate: department.startDate
        ? new Date(department.startDate).toISOString().split("T")[0]
        : "",
      endDate: department.endDate
        ? new Date(department.endDate).toISOString().split("T")[0]
        : "",
      capacity: department.capacity || 50,
      status: department.status || "UPCOMING",
      daily5mApproverDeptId: department.daily5mApproverDeptId || "",
      daily5mApproverSectionId: department.daily5mApproverSectionId || "",
      daily5mApproverLineId: department.daily5mApproverLineId || "",
      skillMatrixApproverQaDeptId: department.skillMatrixApproverQaDeptId || "",
      skillMatrixApproverQaSectionId: department.skillMatrixApproverQaSectionId || "",
      skillMatrixApproverQaLineId: department.skillMatrixApproverQaLineId || "",
      skillMatrixApproverSafetyDeptId: department.skillMatrixApproverSafetyDeptId || "",
      skillMatrixApproverSafetySectionId: department.skillMatrixApproverSafetySectionId || "",
      skillMatrixApproverSafetyLineId: department.skillMatrixApproverSafetyLineId || "",
      skillMatrixApproverProcessDeptId: department.skillMatrixApproverProcessDeptId || "",
      skillMatrixApproverProcessSectionId: department.skillMatrixApproverProcessSectionId || "",
      skillMatrixApproverProcessLineId: department.skillMatrixApproverProcessLineId || "",
    });
    setSelectedCourses(deptCourses);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (department) => {
    if (!canDelete) return;
    setSelectedDepartment(department);
    setIsDeleteDialogOpen(true);
  };

  const openAssignInstructorDialog = (department) => {
    if (!canUpdate) return;
    setSelectedDepartment(department);
    setIsAssignInstructorDialogOpen(true);
  };

  const openManageStudentsDialog = (department) => {
    if (!canManageStudents) return;
    setSelectedDepartment(department);
    setIsManageStudentsDialogOpen(true);
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const getInstructorInfo = (department) => {
    if (!department.instructor) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          No Trainer
        </Badge>
      );
    }

    const instructor = department.instructor;
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={instructor.avatar?.url} alt={instructor.fullName} />
          <AvatarFallback className="text-xs">
            {instructor.fullName
              ?.split(" ")
              .map((n) => n[0])
              .join("")}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">{instructor.fullName}</span>
      </div>
    );
  };

  const getStudentCount = (department) => {
    if (!department) return 0;
    return department.studentCount || department.students?.length || 0;
  };

  const getCourseInfo = (department) => {
    const courses = department.courses && department.courses.length > 0
      ? department.courses
      : (department.course ? [department.course] : []);

    if (courses.length === 0) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          No Course
        </Badge>
      );
    }

    if (courses.length === 1) {
      const courseName = courses[0].title || courses[0].name || "Unnamed Course";
      return (
        <div className="flex items-center gap-2">
          <IconBook className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{courseName}</span>
        </div>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-2">
              <IconBook className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs">
                {courses.length} Courses
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col gap-1">
              {courses.map(c => (
                <span key={c._id || Math.random()}>{c.title || c.name}</span>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleDepartmentClick = (department) => {
    // Navigate to department details or manage page
    // For now, let's open the edit dialog if no dedicated page exists
    // OR if there is a route, navigate to it.
    // Based on typical patterns:
    navigate(`${department._id}`);
  };

  const clearFilters = () => {
    setStatusFilter("ALL");
    setSearchTerm("");
    setActiveTab("all");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-10 w-40" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="p-6">
              <Skeleton className="h-6 w-full mb-4" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (departmentsError) {
    if (departmentsError.status === 401) {
      return (
        <div className="flex flex-col justify-center items-center h-64 space-y-4 p-4">
          <div className="text-red-600 text-lg font-medium">
            Authentication Required
          </div>
          <p className="text-gray-600 text-center">
            Please log in as an admin to view departments
          </p>
          <Button
            onClick={() => (window.location.href = "/login")}
            variant="outline"
          >
            Go to Login
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 p-4">
        <div className="text-red-600 text-lg font-medium">
          Error loading departments
        </div>
        <p className="text-gray-600 text-center">
          {departmentsError?.message || "Failed to fetch departments"}
        </p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <IconRefresh className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <IconX className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 max-w-md">
          You do not have permission to view the departments module. Please contact your administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Departments"
          value={user?.role === 'SUPERADMIN' ? totalCount : filteredDepartments.length}
          description="All created departments"
          icon={IconSchool}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          gradientFrom="from-blue-50"
          gradientTo="to-blue-100"
          borderColor="border-blue-200"
          textColor="text-blue-800"
          valueColor="text-blue-900"
        />

        <StatCard
          title="Assigned Sections"
          value={filteredDepartments.filter((d) => d.instructor).length}
          description="With instructors"
          icon={IconUser}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          gradientFrom="from-green-50"
          gradientTo="to-green-100"
          borderColor="border-green-200"
          textColor="text-green-800"
          valueColor="text-green-900"
        />

        <StatCard
          title="Total Operators"
          value={filteredDepartments.reduce(
            (total, department) => total + getStudentCount(department),
            0
          )}
          description="Across all departments"
          icon={IconUsers}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          gradientFrom="from-purple-50"
          gradientTo="to-purple-100"
          borderColor="border-purple-200"
          textColor="text-purple-800"
          valueColor="text-purple-900"
        />
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger
              value="all"
              onClick={() => {
                setActiveTab("all");
                setStatusFilter("ALL");
              }}
            >
              All ({filteredDepartments.length})
            </TabsTrigger>
            <TabsTrigger
              value="assigned"
              onClick={() => {
                setActiveTab("assigned");
                setStatusFilter("HAS_INSTRUCTOR");
              }}
            >
              Assigned ({departments.filter(d => d.instructor).length})
            </TabsTrigger>
            <TabsTrigger
              value="unassigned"
              onClick={() => {
                setActiveTab("unassigned");
                setStatusFilter("NO_INSTRUCTOR");
              }}
            >
              Unassigned ({departments.filter(d => !d.instructor).length})
            </TabsTrigger>
          </TabsList>

          {canCreate && (
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Create Department
            </Button>
          )}
        </div>
      </Tabs>

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <SearchInput
              placeholder="Search departments by name..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="w-full sm:w-96"
            />

            <div className="flex flex-wrap gap-2">
              <FilterSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={statusOptions}
                placeholder="Status"
                icon={IconFilter}
              />

              {(statusFilter !== "ALL" || searchTerm) && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="gap-1"
                >
                  <IconX className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isExportingDepartments}
                onClick={async () => {
                  try {
                    const { data } = await triggerExportDepartments({
                      format: 'excel',
                      search: searchTerm || '',
                      status: statusFilter !== 'ALL' ? statusFilter : ''
                    });
                    logAction({
                      action: "EXPORT_DEPARTMENTS",
                      details: { format: 'excel', search: searchTerm || '', statusFilter },
                    });
                    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `departments_${new Date().toISOString().slice(0, 10)}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch { }
                }}
              >
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isExportingDepartments}
                onClick={async () => {
                  try {
                    const { data } = await triggerExportDepartments({
                      format: 'pdf',
                      search: searchTerm || '',
                      status: statusFilter !== 'ALL' ? statusFilter : ''
                    });
                    logAction({
                      action: "EXPORT_DEPARTMENTS",
                      details: { format: 'pdf', search: searchTerm || '', statusFilter },
                    });
                    const blob = new Blob([data], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `departments_${new Date().toISOString().slice(0, 10)}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch { }
                }}
              >
                Export PDF
              </Button>
            </div>
          </div>

          <FilterBar
            filters={activeFilters}
            onClearFilters={clearFilters}
            className="mt-3"
          />
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[220px]">Department Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Operators</TableHead>
                  <TableHead>5M Approver</TableHead>
                  <TableHead>Skill Matrix Approver</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDepartments.length > 0 ? (
                  <>
                    {filteredDepartments.map((department) => (
                      <TableRow
                        key={department._id}
                        className="group hover:bg-muted/30"
                        onClick={() => handleDepartmentClick(department)}
                      >
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-full bg-blue-100">
                              <IconSchool className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {department.name}
                              </p>
                              {department.uniCode && (
                                <p className="text-xs text-muted-foreground">
                                  {department.uniCode}
                                </p>
                              )}
                            </div>
                            <IconExternalLink className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell>{getCourseInfo(department)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getInstructorInfo(department)}
                            {canUpdate && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openAssignInstructorDialog(department);
                                      }}
                                      className="h-7 w-7 p-0"
                                    >
                                      <IconPencil className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Assign trainer</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <IconUsers className="h-3 w-3" />
                              {getStudentCount(department)}
                              {department.capacity ? ` / ${department.capacity}` : ""}
                            </Badge>

                            {canManageStudents && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                  >
                                    <IconUserPlus className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openManageStudentsDialog(department);
                                    }}
                                  >
                                    <IconUserPlus className="h-4 w-4 mr-2" />
                                    Manage Operators
                                  </DropdownMenuItem>

                                  {department.students && department.students.length > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <div className="max-h-48 overflow-y-auto">
                                        {department.students.slice(0, 5).map((student) => (
                                          <DropdownMenuItem
                                            key={student._id}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleRemoveStudent({ departmentId: department._id, studentId: student._id, studentName: student.fullName });
                                            }}
                                            className="text-red-600 focus:text-red-600"
                                          >
                                            <IconTrash className="h-4 w-4 mr-2" />
                                            Remove {student.fullName}
                                          </DropdownMenuItem>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Daily5MRoutingBadge department={department} allDepartments={allDepartmentsForRouting} />
                        </TableCell>
                        <TableCell>
                          <SkillMatrixRoutingBadge department={department} allDepartments={allDepartmentsForRouting} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {new Date(department.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(department.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            {canUpdate && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditDialog(department);
                                      }}
                                      className="h-8 w-8 p-0"
                                    >
                                      <IconPencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit department</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {canUpdate && department.status !== 'CANCELLED' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDepartment(department);
                                        setIsCancelDepartmentDialogOpen(true);
                                      }}
                                      className="h-8 w-8 p-0 text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                                    >
                                      <IconX className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Cancel department</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {canDelete && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDeleteDialog(department);
                                      }}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                    >
                                      <IconTrash className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Delete department</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {page < totalPages && (
                      <TableRow ref={scrollSentinelRef}>
                        <TableCell colSpan={8} className="text-center py-4">
                          {isFetchingNextPage ? (
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <IconLoader className="h-4 w-4 animate-spin" />
                              Loading more departments...
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">&nbsp;</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <div className="flex flex-col items-center space-y-3">
                        <IconSchool className="h-12 w-12 text-muted-foreground/60" />
                        <p className="text-muted-foreground font-medium">
                          No departments found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm || statusFilter !== "ALL"
                            ? "Try adjusting your search or filters"
                            : "Create your first department to get started"}
                        </p>
                        {(searchTerm || statusFilter !== "ALL") && (
                          <Button
                            variant="outline"
                            onClick={clearFilters}
                            className="mt-2"
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Load status */}
      {filteredDepartments.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredDepartments.length} of {totalCount} departments
          {page >= totalPages && " — end of list"}
        </p>
      )}

      {/* Create Department Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} className="max-w-[90vw] md:max-w-4xl lg:max-w-5xl">
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconPlus className="h-5 w-5" />
              Create New Department
            </DialogTitle>
            <DialogDescription>
              Create a new department. You can assign an trainer later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Grid: Department Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Department Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter department name"
                    className={
                      formErrors.name ? "border-red-500 focus:border-red-500" : ""
                    }
                  />
                  {formErrors.name && (
                    <p className="text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="uniCode">UniCode (Unique)</Label>
                  <Input
                    id="uniCode"
                    name="uniCode"
                    value={formData.uniCode}
                    onChange={handleInputChange}
                    placeholder="Enter unique code"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Courses (Optional)</Label>
                <div className="space-y-3">
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && value !== "loading" && value !== "error" && value !== "none" && !selectedCourses.map(String).includes(String(value))) {
                        setSelectedCourses([...selectedCourses, String(value)]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add courses..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coursesLoading ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <IconLoader className="h-4 w-4 animate-spin" />
                            Loading courses...
                          </div>
                        </SelectItem>
                      ) : coursesError ? (
                        <SelectItem value="error" disabled>
                          Error loading courses
                        </SelectItem>
                      ) : allCourses.length > 0 ? (
                        allCourses.map((course) => (
                          <SelectItem key={course._id || course.id} value={String(course._id || course.id)}>
                            {course.title || course.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No courses available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {selectedCourses.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20">
                      {selectedCourses.map((courseId) => {
                        const course = allCourses.find((c) => String(c._id || c.id) === String(courseId));
                        return (
                          <Badge key={courseId} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1">
                            {course?.title || course?.name || "Loading..."}
                            <div
                              className="ml-1 hover:bg-red-200 rounded-full p-0.5 cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCourses(prev => prev.filter(id => id !== courseId));
                              }}
                            >
                              <IconX className="h-3 w-3 text-red-600" />
                            </div>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="instructorId">Trainer (Optional)</Label>
                  <Select
                    value={formData.instructorId ? String(formData.instructorId) : ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, instructorId: value ? Number(value) : "" })
                    }
                  >
                    <SelectTrigger id="instructorId">
                      <SelectValue placeholder="Select an trainer" />
                    </SelectTrigger>
                    <SelectContent>
                      {instructorsLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading Trainers...
                        </SelectItem>
                      ) : instructorsError ? (
                        <SelectItem value="error" disabled>
                          Error loading trainers
                        </SelectItem>
                      ) : instructors.length > 0 ? (
                        instructors.map((instructor) => (
                          <SelectItem key={instructor._id} value={String(instructor._id)}>
                            {instructor.fullName} ({instructor.email})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No trainers available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="capacity">Capacity (Optional)</Label>
                  <Input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    placeholder="Enter capacity"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date (Optional)</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-sm font-medium">Source Department</Label>
                <div className="rounded-md border bg-muted/20 p-3 space-y-1">
                  <p className="text-sm font-medium">{formData.name || "Unnamed department"}</p>
                  <p className="text-xs text-muted-foreground">{formData.uniCode || "No UniCode set"}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-sm font-medium">Source Section</Label>
                <Select value="dept" disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Department-level (all sections)" />
                  </SelectTrigger>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Section-specific routing can be configured after the department is created.
                </p>
              </div>
            </div>

            {/* Right Grid: Daily 5M Routing Fields */}
            <div className="space-y-4 border-t pt-6 md:border-t-0 md:pt-0 md:border-l md:pl-6">
              <Daily5MRoutingFields
                idPrefix="create"
                formData={formData}
                setFormData={setFormData}
                departments={allDepartmentsForRouting}
                sections={routingSections}
                isLoadingSections={isLoadingRoutingSections}
                lines={routingLines}
                isLoadingLines={isLoadingRoutingLines}
              />

              <div className="border-t pt-4 space-y-4">
                {SKILL_MATRIX_ROLES.map((role) => (
                  <SkillMatrixRoutingFields
                    key={role.key}
                    idPrefix="create"
                    role={role.key}
                    roleLabel={role.label}
                    formData={formData}
                    setFormData={setFormData}
                    departments={allDepartmentsForRouting}
                    {...skillMatrixRoutingQueryData[role.key]}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateDepartment}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <IconLoader className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creating..." : "Create Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Department Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} className="max-w-[90vw] md:max-w-4xl lg:max-w-5xl">
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconPencil className="h-5 w-5" />
              Edit Department
            </DialogTitle>
            <DialogDescription>Update department information.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Grid: Department Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Department Name *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter department name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-uniCode">UniCode</Label>
                  <Input
                    id="edit-uniCode"
                    name="uniCode"
                    value={formData.uniCode}
                    onChange={handleInputChange}
                    placeholder="Enter unique code"
                    disabled={!user?.isAdmin}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Courses</Label>
                <div className="space-y-3">
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && value !== "loading" && value !== "error" && value !== "none" && !selectedCourses.map(String).includes(String(value))) {
                        setSelectedCourses([...selectedCourses, String(value)]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add courses..." />
                    </SelectTrigger>
                    <SelectContent>
                      {coursesLoading ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <IconLoader className="h-4 w-4 animate-spin" />
                            Loading courses...
                          </div>
                        </SelectItem>
                      ) : coursesError ? (
                        <SelectItem value="error" disabled>
                          Error loading courses
                        </SelectItem>
                      ) : allCourses.length > 0 ? (
                        allCourses.map((course) => (
                          <SelectItem key={course._id || course.id} value={String(course._id || course.id)}>
                            {course.title || course.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No courses available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>

                  {selectedCourses.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/20">
                      {selectedCourses.map((courseId) => {
                        const course = allCourses.find((c) => String(c._id || c.id) === String(courseId));
                        // Fallback if course not found in list (e.g. pagination limit)
                        // In real app we might need to fetch it or rely on department data if available
                        return (
                          <Badge key={courseId} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1">
                            {course?.title || course?.name || "Unknown Course"}
                            <div
                              className="ml-1 hover:bg-red-200 rounded-full p-0.5 cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCourses(prev => prev.filter(id => id !== courseId));
                              }}
                            >
                              <IconX className="h-3 w-3 text-red-600" />
                            </div>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPCOMING">Upcoming</SelectItem>
                      <SelectItem value="ONGOING">Ongoing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-capacity">Capacity</Label>
                  <Input
                    id="edit-capacity"
                    name="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={handleInputChange}
                    placeholder="Enter capacity"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-startDate">Start Date</Label>
                  <Input
                    id="edit-startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-endDate">End Date</Label>
                  <Input
                    id="edit-endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-sm font-medium">Source Department</Label>
                <div className="rounded-md border bg-muted/20 p-3 space-y-1">
                  <p className="text-sm font-medium">{selectedDepartment?.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedDepartment?.uniCode || "No UniCode set"}</p>
                  <p className="text-xs text-muted-foreground">{getStudentCount(selectedDepartment)} operators</p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-source-section">Source Section</Label>
                <Select value={selectedSourceSectionId} onValueChange={setSelectedSourceSectionId}>
                  <SelectTrigger id="edit-source-section">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dept">Department-level (all sections)</SelectItem>
                    {isLoadingSourceSections ? (
                      <SelectItem value="loading" disabled>
                        Loading sections...
                      </SelectItem>
                    ) : sourceSections.length > 0 ? (
                      sourceSections.map((s) => (
                        <SelectItem key={s.id || s._id} value={String(s.id || s._id)}>
                          {s.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No sections in this department
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedSourceSectionId === "dept"
                    ? "Editing department-wide routing. Select a section to override it for that section only."
                    : "Editing routing for this section only. Falls back to department-level routing when left unset."}
                </p>
              </div>
            </div>

            {/* Right Grid: Daily 5M Routing Fields */}
            <div className="space-y-4 border-t pt-6 md:border-t-0 md:pt-0 md:border-l md:pl-6">
              <Daily5MRoutingFields
                idPrefix="edit"
                formData={activeRoutingValue}
                setFormData={setActiveRoutingValue}
                departments={allDepartmentsForRouting}
                sections={routingSections}
                isLoadingSections={isLoadingRoutingSections}
                lines={routingLines}
                isLoadingLines={isLoadingRoutingLines}
              />

              <div className="border-t pt-4 space-y-4">
                {SKILL_MATRIX_ROLES.map((role) => (
                  <SkillMatrixRoutingFields
                    key={role.key}
                    idPrefix="edit"
                    role={role.key}
                    roleLabel={role.label}
                    formData={activeRoutingValue}
                    setFormData={setActiveRoutingValue}
                    departments={allDepartmentsForRouting}
                    {...skillMatrixRoutingQueryData[role.key]}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateDepartment}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <IconLoader className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Updating..." : "Update Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <IconTrash className="h-5 w-5" />
              Delete Department
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the department "{selectedDepartment?.name}"?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDepartment}
              className="gap-2"
            >
              <IconTrash className="h-4 w-4" />
              Delete Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Instructor Dialog */}
      <Dialog
        open={isAssignInstructorDialogOpen}
        onOpenChange={setIsAssignInstructorDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUser className="h-5 w-5" />
              {selectedDepartment?.instructor
                ? "Reassign trainer"
                : "Assign trainer"}
            </DialogTitle>
            <DialogDescription>
              {selectedDepartment?.instructor
                ? `Change trainer for department "${selectedDepartment?.name}"`
                : `Assign an trainer to the department "${selectedDepartment?.name}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedDepartment?.instructor && (
              <div
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors mb-4 ${isRemovingInstructor
                  ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                  : "hover:bg-red-50 border-red-200"
                  }`}
                onClick={
                  isRemovingInstructor ? undefined : handleRemoveInstructor
                }
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                    {isRemovingInstructor ? (
                      <IconLoader className="h-4 w-4 animate-spin text-red-600" />
                    ) : (
                      <IconX className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-red-700">
                      {isRemovingInstructor
                        ? "Removing Trainer..."
                        : "Remove Current Trainer"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Unassign {selectedDepartment.instructor.fullName} from this
                      department
                    </p>
                  </div>
                </div>
              </div>
            )}
            {instructorsLoading ? (
              <div className="flex justify-center py-8">
                <IconLoader className="h-6 w-6 animate-spin" />
              </div>
            ) : instructorsError ? (
              <div className="text-center text-red-600 py-4">
                Error loading trainers
              </div>
            ) : instructors.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No trainers available
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {instructors.map((instructor) => (
                  <div
                    key={instructor._id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedDepartment?.instructor?._id === instructor._id
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-muted"
                      }`}
                    onClick={() => handleAssignInstructor(instructor._id)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={instructor.avatar?.url}
                          alt={instructor.fullName}
                        />
                        <AvatarFallback className="text-xs">
                          {instructor.fullName
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{instructor.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {instructor.email}
                        </p>
                      </div>
                    </div>
                    {selectedDepartment?.instructor?._id === instructor._id && (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignInstructorDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Students Dialog */}
      <Dialog
        open={isManageStudentsDialogOpen}
        onOpenChange={setIsManageStudentsDialogOpen}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUsers className="h-5 w-5" />
              Manage Operators
            </DialogTitle>
            <DialogDescription>
              Manage operators in the department "{selectedDepartment?.name}".
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="add" className="w-full flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="add">Add Operators</TabsTrigger>
              <TabsTrigger value="remove">Remove Operators</TabsTrigger>
            </TabsList>

            <TabsContent
              value="add"
              className="flex-1 overflow-hidden flex flex-col"
            >
              <div className="py-4 flex-1 overflow-hidden">
                {studentsLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <IconLoader className="h-6 w-6 animate-spin" />
                  </div>
                ) : studentsError ? (
                  <div className="text-center text-red-600 py-4">
                    Error loading operators
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No operators available
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {students
                      .filter(
                        (student) =>
                          !selectedDepartment?.students?.some(
                            (s) => s._id === student._id
                          )
                      )
                      .map((student) => {
                        const rawId = student._id || student.id;
                        if (!rawId) return null;
                        const sId = String(rawId);
                        const isSelected = selectedStudents.includes(sId);

                        return (
                          <div
                            key={sId}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                              ? "bg-blue-50 border-blue-200"
                              : "hover:bg-muted"
                              }`}
                            onClick={() => toggleStudentSelection(sId)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={student.avatar?.url}
                                  alt={student.fullName}
                                />
                                <AvatarFallback className="text-xs">
                                  {student.fullName
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {student.fullName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {student.email}
                                </p>
                              </div>
                            </div>
                            {isSelected && (
                              <Badge variant="secondary">Selected</Badge>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              <DialogFooter className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedStudents.length} operator(s) selected
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsManageStudentsDialogOpen(false);
                      setSelectedStudents([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddStudents}
                    disabled={selectedStudents.length === 0}
                    className="gap-2"
                  >
                    <IconUserPlus className="h-4 w-4" />
                    Add Selected Operators
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>

            <TabsContent
              value="remove"
              className="flex-1 overflow-hidden flex flex-col"
            >
              <div className="py-4 flex-1 overflow-hidden">
                {!selectedDepartment?.students ||
                  selectedDepartment.students.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No operators in this department
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedDepartment.students.map((student) => (
                      <div
                        key={student._id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={student.avatar?.url}
                              alt={student.fullName}
                            />
                            <AvatarFallback className="text-xs">
                              {student.fullName
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{student.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.email}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveStudent({ departmentId: selectedDepartment?._id, studentId: student._id, studentName: student.fullName })}
                          className="gap-1"
                          disabled={!selectedDepartment?._id}
                        >
                          <IconTrash className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsManageStudentsDialogOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Cancel Department Confirmation Dialog */}
      <Dialog open={isCancelDepartmentDialogOpen} onOpenChange={setIsCancelDepartmentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <IconX className="h-5 w-5" />
              Cancel Department
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the department "{selectedDepartment?.name}"?
              This will notify all enrolled operator and the Trainer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cancel-reason">Reason for Cancellation (Optional)</Label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancelling this department..."
                disabled={isCancelingDepartment}
              />
              <p className="text-sm text-muted-foreground">
                This reason will be included in notifications sent to affected users.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCancelDepartmentDialogOpen(false)}
              disabled={isCancelingDepartment}
            >
              Keep Department
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelDepartment}
              disabled={isCancelingDepartment}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {isCancelingDepartment ? (
                <IconLoader className="h-4 w-4 animate-spin" />
              ) : (
                <IconX className="h-4 w-4" />
              )}
              {isCancelingDepartment ? "Canceling..." : "Cancel Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Departments;
