import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useGetAllUsersQuery, useUpdateUserMutation } from "@/Redux/AllApi/UserApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconLoader, IconUserPlus } from "@tabler/icons-react";
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";

const CANDIDATE_PAGE_LIMIT = 10;

// Bulk-promotes selected active, non-temporary users into the Mentor role by
// setting isEmployee=1 and isMentor=1 on each -- the same effect as the "Remove
// from Mentor" action in reverse. This does not touch any user's `mentor` field
// or the Handover-Sheet-driven mentee assignment/stats shown elsewhere.
const AssignMentorDialog = ({ open, onOpenChange, onAssigned }) => {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [sectionFilter, setSectionFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch("");
      setDepartmentFilter("ALL");
      setSectionFilter("ALL");
      setPage(1);
      setSelectedUserIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    setPage(1);
    setSelectedUserIds(new Set());
  }, [search, departmentFilter, sectionFilter]);

  const { data: usersRes, isLoading: usersLoading, isFetching: usersFetching } = useGetAllUsersQuery(
    {
      page,
      limit: CANDIDATE_PAGE_LIMIT,
      search,
      includeTemporary: "false",
      departmentId: departmentFilter !== "ALL" ? departmentFilter : "",
      sectionId: sectionFilter !== "ALL" ? sectionFilter : "",
    },
    { skip: !open }
  );
  const candidates = usersRes?.data?.users || [];
  const totalPages = usersRes?.data?.totalPages || 1;

  const { data: deptRes } = useGetAllDepartmentsQuery({ page: 1, limit: 100 }, { skip: !open });
  const { data: sectionRes } = useGetSectionsByDepartmentQuery(departmentFilter, {
    skip: !open || departmentFilter === "ALL",
  });

  const departmentOptions = useMemo(() => {
    const options = [{ value: "ALL", label: "All Departments" }];
    (deptRes?.data?.departments || []).forEach((dept) => {
      options.push({ value: String(dept.id), label: dept.name });
    });
    return options;
  }, [deptRes]);

  const sectionOptions = useMemo(() => {
    const options = [{ value: "ALL", label: "All Sections" }];
    (sectionRes?.data || []).forEach((sec) => {
      options.push({ value: String(sec.id), label: sec.name });
    });
    return options;
  }, [sectionRes]);

  const handleDepartmentFilterChange = (val) => {
    setDepartmentFilter(val);
    setSectionFilter("ALL");
  };

  const [updateUser] = useUpdateUserMutation();

  const toggleUser = (id, checked, alreadyMentor) => {
    if (alreadyMentor) return;
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  };

  const selectableCandidates = candidates.filter((u) => !u.isMentor);
  const allOnPageSelected =
    selectableCandidates.length > 0 && selectableCandidates.every((u) => selectedUserIds.has(String(u._id)));

  const toggleSelectAllOnPage = (checked) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      selectableCandidates.forEach((u) => {
        if (checked) next.add(String(u._id));
        else next.delete(String(u._id));
      });
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedUserIds.size === 0) return;
    setIsAssigning(true);
    const ids = Array.from(selectedUserIds);
    const results = await Promise.allSettled(
      ids.map((id) => updateUser({ id, isEmployee: true, isMentor: true }).unwrap())
    );
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;
    setIsAssigning(false);

    if (succeeded > 0) {
      toast.success(`${succeeded} user${succeeded === 1 ? "" : "s"} assigned as Mentor`);
    }
    if (failed > 0) {
      toast.error(`Failed to assign ${failed} user${failed === 1 ? "" : "s"}`);
    }

    setSelectedUserIds(new Set());
    onAssigned?.();
    if (failed === 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Mentor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Select one or more active users to promote into the Mentor role. This sets isEmployee and
            isMentor on each selected user; it does not change any existing mentee assignments.
          </p>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <div className="flex-1 w-full md:max-w-xs">
              <SearchInput placeholder="Search by name or employee code..." value={search} onChange={setSearch} />
            </div>
            <FilterSelect
              value={departmentFilter}
              onValueChange={handleDepartmentFilterChange}
              options={departmentOptions}
              placeholder="Department"
              className="w-48"
            />
            <FilterSelect
              value={sectionFilter}
              onValueChange={setSectionFilter}
              options={sectionOptions}
              placeholder="Section"
              className="w-48"
              disabled={departmentFilter === "ALL"}
            />
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={(checked) => toggleSelectAllOnPage(!!checked)}
                      disabled={selectableCandidates.length === 0}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Emp ID</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department / Section</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <IconLoader className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                    </TableCell>
                  </TableRow>
                ) : candidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                      No matching users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  candidates.map((user) => {
                    const alreadyMentor = !!user.isMentor;
                    return (
                      <TableRow
                        key={user._id}
                        className={alreadyMentor ? "opacity-60" : "cursor-pointer"}
                        onClick={() => toggleUser(user._id, !selectedUserIds.has(String(user._id)), alreadyMentor)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedUserIds.has(String(user._id))}
                            onCheckedChange={(checked) => toggleUser(user._id, !!checked, alreadyMentor)}
                            disabled={alreadyMentor}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={user.avatar?.url} />
                              <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.fullName}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.empId || "N/A"}</TableCell>
                        <TableCell>{user.designation || "N/A"}</TableCell>
                        <TableCell>
                          {[user.department?.name, user.sectionName].filter(Boolean).join(" / ") || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === "PRESENT" ? "success" : "secondary"}>
                            {user.status || "PRESENT"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {alreadyMentor ? (
                            <Badge variant="secondary">Already a Mentor</Badge>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages || usersFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAssigning}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning || selectedUserIds.size === 0}>
            {isAssigning ? (
              <IconLoader className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <IconUserPlus className="w-4 h-4 mr-2" />
            )}
            Assign {selectedUserIds.size} User{selectedUserIds.size === 1 ? "" : "s"} as Mentor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignMentorDialog;
