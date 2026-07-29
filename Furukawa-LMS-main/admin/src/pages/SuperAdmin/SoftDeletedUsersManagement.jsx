import React, { useMemo, useState } from "react";
import {
  IconTrash,
  IconRestore,
  IconFilter,
  IconFilterOff,
  IconRefresh,
  IconAlertTriangle,
  IconUserOff,
  IconBuilding,
  IconLayoutGrid,
  IconRoute,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
} from "@tabler/icons-react";
import {
  useGetSoftDeletedUsersQuery,
  useRestoreUserMutation,
  usePermanentDeleteUserMutation,
} from "@/Redux/AllApi/SuperAdminApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import SearchInput from "@/components/common/SearchInput";
import MultiSelectFilter from "@/components/common/MultiSelectFilter";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const STATUS_BADGE_VARIANT = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  BANNED: "destructive",
  PENDING: "info",
};

const EMPTY_FILTERS = {
  departmentId: "",
  sectionId: "",
  lineId: "",
  deletedDateFrom: "",
  deletedDateTo: "",
};

const SoftDeletedUsersManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const [pendingAction, setPendingAction] = useState(null); // { type: 'restore' | 'permanentDelete', ids: string[] }
  const [isProcessing, setIsProcessing] = useState(false);

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const {
    data: deletedUsersData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetSoftDeletedUsersQuery({
    page: currentPage,
    limit: 20,
    sortBy: "updatedAt",
    order: "desc",
    search: searchTerm,
    deletedDateFrom: filters.deletedDateFrom,
    deletedDateTo: filters.deletedDateTo,
    departmentId: filters.departmentId,
    sectionId: filters.sectionId,
    lineId: filters.lineId,
  });

  const [restoreUser] = useRestoreUserMutation();
  const [permanentDeleteUser] = usePermanentDeleteUserMutation();

  const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
  const departmentOptions = useMemo(
    () => (departmentsData?.data?.departments || []).map((d) => ({ id: String(d.id || d._id), name: d.name })),
    [departmentsData]
  );

  const { data: sectionsData } = useGetSectionsByDepartmentQuery(filters.departmentId, { skip: !filters.departmentId });
  const sectionOptions = useMemo(
    () => (sectionsData?.data || []).map((s) => ({ id: String(s.id), name: s.name })),
    [sectionsData]
  );

  const { data: linesData } = useGetLinesBySectionQuery(filters.sectionId, { skip: !filters.sectionId });
  const lineOptions = useMemo(
    () => (linesData?.data || []).map((l) => ({ id: String(l.id), name: l.name })),
    [linesData]
  );

  const deletedUsers = deletedUsersData?.data?.users || [];
  const totalUsers = deletedUsersData?.data?.totalUsers ?? deletedUsers.length;
  const totalPages = deletedUsersData?.data?.totalPages || 1;

  const hasActiveFilters =
    !!searchTerm || Object.values(filters).some(Boolean);

  const resetFilters = () => {
    setSearchTerm("");
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  };

  const updateFilters = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setCurrentPage(1);
  };

  const openConfirm = (type, ids) => setPendingAction({ type, ids });

  const handleConfirm = async () => {
    if (!pendingAction) return;
    const { type, ids } = pendingAction;
    const mutate = type === "restore" ? restoreUser : permanentDeleteUser;

    setIsProcessing(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => mutate(id).unwrap()));
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;

      if (succeeded > 0) {
        toast.success(
          type === "restore"
            ? `Restored ${succeeded} user${succeeded > 1 ? "s" : ""} successfully`
            : `Permanently deleted ${succeeded} user${succeeded > 1 ? "s" : ""}`
        );
      }
      if (failed > 0) {
        toast.error(`Failed to ${type === "restore" ? "restore" : "permanently delete"} ${failed} user${failed > 1 ? "s" : ""}`);
      }

      setSelectedUsers((prev) => prev.filter((id) => !ids.includes(id)));
      refetch();
    } finally {
      setIsProcessing(false);
      setPendingAction(null);
    }
  };

  const toggleSelectAll = (checked) => {
    setSelectedUsers(checked ? deletedUsers.map((u) => u._id) : []);
  };

  const toggleSelectUser = (id, checked) => {
    setSelectedUsers((prev) => (checked ? [...prev, id] : prev.filter((v) => v !== id)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Deleted Users</h1>
            {!isLoading && (
              <Badge variant="secondary" className="text-sm font-medium">
                {totalUsers} total
              </Badge>
            )}
          </div>
          <p className="text-gray-600 mt-1 text-sm">
            Restore soft-deleted accounts or permanently remove them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <IconFilter className="w-4 h-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <IconRefresh className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <IconAlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-yellow-800">Important Notice</h3>
          <p className="text-sm text-yellow-700 mt-0.5">
            These users have been soft-deleted and are hidden from regular views. Restore an account to
            reactivate it, or permanently delete it to remove it — and all its data — for good.
          </p>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="xl:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Search
                </label>
                <SearchInput
                  placeholder="Name, username, email, or ID..."
                  value={searchTerm}
                  onChange={(val) => {
                    setSearchTerm(val);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <MultiSelectFilter
                  placeholder="All Departments"
                  options={departmentOptions}
                  selectedValues={filters.departmentId ? filters.departmentId.split(",").filter(Boolean) : []}
                  onChange={(vals) => updateFilters({ departmentId: vals.join(","), sectionId: "", lineId: "" })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Section
                </label>
                <MultiSelectFilter
                  placeholder="All Sections"
                  options={sectionOptions}
                  selectedValues={filters.sectionId ? filters.sectionId.split(",").filter(Boolean) : []}
                  onChange={(vals) => updateFilters({ sectionId: vals.join(","), lineId: "" })}
                  disabled={!filters.departmentId}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Line
                </label>
                <MultiSelectFilter
                  placeholder="All Lines"
                  options={lineOptions}
                  selectedValues={filters.lineId ? filters.lineId.split(",").filter(Boolean) : []}
                  onChange={(vals) => updateFilters({ lineId: vals.join(",") })}
                  disabled={!filters.sectionId}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Deleted From
                </label>
                <Input
                  type="date"
                  value={filters.deletedDateFrom}
                  onChange={(e) => updateFilters({ deletedDateFrom: e.target.value })}
                  className="h-9"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Deleted To
                </label>
                <Input
                  type="date"
                  value={filters.deletedDateTo}
                  onChange={(e) => updateFilters({ deletedDateTo: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500">
                  <IconFilterOff className="w-4 h-4" />
                  Reset filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk actions bar */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">
            {selectedUsers.length} user{selectedUsers.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openConfirm("restore", selectedUsers)}>
              <IconRestore className="w-4 h-4" />
              Restore
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openConfirm("permanentDelete", selectedUsers)}>
              <IconTrash className="w-4 h-4" />
              Permanently Delete
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === deletedUsers.length && deletedUsers.length > 0}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Previous Status</TableHead>
              <TableHead>Deleted On</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-red-600">
                  Error loading deleted users: {error?.data?.message || error?.message}
                </TableCell>
              </TableRow>
            ) : deletedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-14">
                  <div className="flex flex-col items-center text-center">
                    <IconUserOff className="w-10 h-10 text-gray-300 mb-3" />
                    <h3 className="text-base font-medium text-gray-900">No deleted users found</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {hasActiveFilters ? "Try adjusting or clearing your filters." : "There are no soft-deleted users to manage."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              deletedUsers.map((user) => (
                <TableRow key={user._id} className="hover:bg-gray-50">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user._id)}
                      onChange={(e) => toggleSelectUser(user._id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          className="h-9 w-9 rounded-full object-cover opacity-60"
                          src={user.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=9ca3af&color=fff`}
                          alt={user.fullName}
                        />
                        <div className="absolute inset-0 bg-gray-500/20 rounded-full flex items-center justify-center">
                          <IconTrash className="w-3 h-3 text-gray-700" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-700 truncate">{user.fullName}</div>
                        <div className="text-xs text-gray-500 truncate">@{user.userName}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-700">{user.email || "—"}</div>
                    <div className="text-xs text-gray-500">{user.phoneNumber || ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      {user.deptName && (
                        <div className="flex items-center gap-1"><IconBuilding className="w-3.5 h-3.5 text-gray-400" />{user.deptName}</div>
                      )}
                      {user.sectionName && (
                        <div className="flex items-center gap-1"><IconLayoutGrid className="w-3.5 h-3.5 text-gray-400" />{user.sectionName}</div>
                      )}
                      {user.lineName && (
                        <div className="flex items-center gap-1"><IconRoute className="w-3.5 h-3.5 text-gray-400" />{user.lineName}</div>
                      )}
                      {!user.deptName && !user.sectionName && !user.lineName && <span className="text-gray-400">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[user.status] || "secondary"}>{user.status || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-900">{new Date(user.updatedAt).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500">{new Date(user.updatedAt).toLocaleTimeString()}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => openConfirm("restore", [user._id])}
                        className="text-green-600 hover:text-green-800 transition-colors"
                        title="Restore User"
                      >
                        <IconRestore className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openConfirm("permanentDelete", [user._id])}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Permanently Delete"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {!isLoading && deletedUsers.length > 0 && (
          <div className="px-5 py-3.5 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} &middot; {totalUsers} deleted user{totalUsers !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <IconChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <IconChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="w-5 h-5 text-yellow-600" />
              Confirm Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "restore"
                ? `Are you sure you want to restore ${pendingAction?.ids?.length} user(s)? They will be able to log in again.`
                : `Are you sure you want to permanently delete ${pendingAction?.ids?.length} user(s)? This action cannot be undone and will remove all associated data.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={isProcessing}
              className={pendingAction?.type === "permanentDelete" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isProcessing && <IconLoader2 className="w-4 h-4 animate-spin" />}
              {pendingAction?.type === "restore" ? "Restore" : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SoftDeletedUsersManagement;
