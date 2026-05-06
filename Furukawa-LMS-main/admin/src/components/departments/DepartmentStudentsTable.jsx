// src/components/departments/DepartmentStudentsTable.jsx
import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconSearch,
  IconUserPlus,
  IconDotsVertical,
  IconMail,
  IconPhone,
  IconUser,
  IconEye,
  IconX,
  IconTrendingUp,
  IconFilter,
  IconRefresh,
  IconLoader,
  IconCheck,
  IconUserMinus,
  IconChevronLeft,
  IconChevronRight
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useGetDepartmentProgressQuery, useAddStudentToDepartmentMutation, useRemoveStudentFromDepartmentMutation } from "@/Redux/AllApi/DepartmentApi";
import { useGetAllUsersQuery } from "@/Redux/AllApi/UserApi";
import { toast } from "sonner";

const DepartmentStudentsTable = ({ departmentId, departmentName, onRefetch }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [addStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const navigate = useNavigate();

  // Mutation hooks
  const [addStudentToDepartment, { isLoading: isAddingStudent }] = useAddStudentToDepartmentMutation();
  const [removeStudentFromDepartment, { isLoading: isRemovingStudent }] = useRemoveStudentFromDepartmentMutation();

  // Fetch department progress data with pagination
  const {
    data: progressData,
    isLoading: progressLoading,
    isFetching: progressFetching,
    error: progressError,
    refetch: refetchProgress,
  } = useGetDepartmentProgressQuery({
    departmentId,
    page,
    limit,
    search: searchTerm
  }, {
    refetchOnMountOrArgChange: true,
  });

  // Fetch available students for adding
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useGetAllUsersQuery(
    {
      isEmployee: true,
      excludeCustomRoles: true,
      excludeTrainers: true,
      limit: 1000,
      search: studentSearchTerm
    },
    { skip: !addStudentDialogOpen, refetchOnMountOrArgChange: true }
  );

  const departmentProgress = progressData?.data?.departmentProgress || [];
  const totalTrainees = progressData?.data?.total || 0;
  const totalPages = progressData?.data?.totalPages || 0;
  
  const students = departmentProgress.map(p => ({
    ...p.student,
    status: p.student.status || 'ACTIVE' // Fallback
  }));

  const currentStudentIds = departmentProgress.map(p => String(p.student._id));

  const availableStudents = usersData?.data?.users || [];
  
  // Use the count from the department object or a separate query if needed, 
  // but for now we'll just check against the current page of students 
  // (which is slightly limited but better than nothing). 
  // Better: The backend could return the list of ALL student IDs in the department.
  const studentsNotInDepartment = availableStudents.filter(
    student => {
      const sId = student._id || student.id;
      if (!sId) return false;
      return !currentStudentIds.includes(String(sId));
    }
  );
  
  // Filtering is now mostly handled server-side via searchTerm, 
  // but we still apply local filters for status/progress if they are not yet server-side
  const filteredStudents = students.filter((student) => {
    // Status filter (local for now, could be server-side)
    const matchesStatus = statusFilter === "all" || student.status === statusFilter;

    // Progress filter (local)
    if (progressFilter !== "all") {
      const studentProg = departmentProgress.find(p => p.student._id === student._id);
      const progressPercentage = studentProg?.progressPercentage || 0;

      if (progressFilter === "not-started" && progressPercentage > 0) return false;
      if (progressFilter === "in-progress" && (progressPercentage === 0 || progressPercentage >= 100)) return false;
      if (progressFilter === "completed" && progressPercentage < 100) return false;
    }

    return matchesStatus;
  });

  // Reset page when search or filters change
  React.useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, progressFilter]);

  // Get student status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      ACTIVE: { variant: "default", color: "text-green-700" },
      SUSPENDED: { variant: "destructive", color: "text-red-700" },
      PENDING: { variant: "secondary", color: "text-amber-700" },
      BANNED: { variant: "destructive", color: "text-red-700" },
    };

    const config = statusConfig[status] || { variant: "secondary", color: "text-gray-700" };

    return (
      <Badge variant={config.variant} className={config.color}>
        {status}
      </Badge>
    );
  };

  // Handle adding students to department
  const handleAddStudents = async () => {
    // Remove falsy + duplicate IDs
    const validStudentIds = [...new Set(selectedStudents)].filter(Boolean);

    if (validStudentIds.length === 0) {
      toast.error("Please select at least one valid trainee");
      return;
    }
    try {
      // Call API sequentially or in parallel? Parallel is fine.
      const responses = await Promise.all(
        validStudentIds.map(studentId =>
          addStudentToDepartment({ departmentId, studentId }).unwrap()
        )
      );

      // Take the message from the last response or a generic one
      const lastMsg = responses[responses.length - 1]?.message || "Trainees added successfully";
      toast.success(lastMsg);
      refetchProgress();

      setAddStudentDialogOpen(false);
      setSelectedStudents([]);
      setStudentSearchTerm("");

      onRefetch?.(); // cleaner optional call
    } catch (error) {
      console.error("Error adding trainees:", error);
      toast.error(error?.data?.message || "Failed to add trainees to department");
    }
  };


  // Handle removing student from department
  const handleRemoveStudent = async (studentId, studentName) => {
    try {
      await removeStudentFromDepartment({ departmentId, studentId }).unwrap();
      toast.success(`${studentName} removed from department successfully`);

      // Refetch department data
      refetchProgress();
      if (onRefetch) {
        onRefetch();
      }
    } catch (error) {
      toast.error(error?.data?.message || "Failed to remove trainee from department");
      console.error("Error removing trainee:", error);
    }
  };

  // Toggle student selection for adding
  const toggleStudentSelection = (studentId) => {
    if (!studentId) {
      console.error("Helper: Attempted to toggle undefined student ID");
      return;
    }
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  if (!students || students.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUser className="h-5 w-5" />
            Trainees
          </CardTitle>
          <CardDescription>
            No trainees enrolled in this department yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <IconUserPlus className="h-4 w-4" />
                  Add Trainees (v2)
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Trainees to Department</DialogTitle>
                  <DialogDescription>
                    Select trainees to add to {departmentName}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search trainees..."
                      className="pl-8"
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    {usersLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center space-x-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-1 flex-1">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : studentsNotInDepartment.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {studentsNotInDepartment.map(student => {
                          // Prioritize _id and ensure it's a string
                          const rawId = student._id || student.id;
                          if (!rawId) return null;
                          const sId = String(rawId);

                          return (
                            <div
                              key={sId}
                              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${selectedStudents.includes(sId) ? 'bg-blue-50 border border-blue-200' : ''
                                }`}
                              onClick={() => toggleStudentSelection(sId)}
                            >
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedStudents.includes(sId)
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-300'
                                }`}>
                                {selectedStudents.includes(sId) && (
                                  <IconCheck className="h-3 w-3" />
                                )}
                              </div>
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={student.avatar?.url} />
                                <AvatarFallback>
                                  {student.fullName?.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-medium">{student.fullName}</p>
                                <p className="text-sm text-muted-foreground">{student.email}</p>
                              </div>
                              <Badge variant="outline">{student.status}</Badge>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <IconUser className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No available trainees found</p>
                      </div>
                    )}
                  </div>

                  {selectedStudents.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {selectedStudents.length} trainee(s) selected
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddStudentDialogOpen(false);
                      setSelectedStudents([]);
                      setStudentSearchTerm("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddStudents}
                    disabled={selectedStudents.length === 0 || isAddingStudent}
                  >
                    {isAddingStudent && <IconLoader className="h-4 w-4 mr-2 animate-spin" />}
                    Add {selectedStudents.length > 0 ? `${selectedStudents.length} ` : ''}Trainee(s)
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconUser className="h-5 w-5" />
                Trainees ({students.length})
              </CardTitle>
              <CardDescription>
                Trainees enrolled in {departmentName} with progress tracking
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refetchProgress}
                disabled={progressLoading}
                className="gap-2"
              >
                <IconRefresh className={`h-4 w-4 ${progressLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={addStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <IconUserPlus className="h-4 w-4" />
                    Add Trainees
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Trainees to Department</DialogTitle>
                    <DialogDescription>
                      Select trainees to add to {departmentName}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="relative">
                      <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search trainees..."
                        className="pl-8"
                        value={studentSearchTerm}
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                      {usersLoading ? (
                        <div className="p-4 space-y-3">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center space-x-3">
                              <Skeleton className="h-10 w-10 rounded-full" />
                              <div className="space-y-1 flex-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-48" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : studentsNotInDepartment.length > 0 ? (
                        <div className="p-2 space-y-1">
                          {studentsNotInDepartment.map(student => {
                            const rawId = student._id || student.id;
                            if (!rawId) return null;
                            const sId = String(rawId);

                            return (
                              <div
                                key={sId}
                                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${selectedStudents.includes(sId) ? 'bg-blue-50 border border-blue-200' : ''
                                  }`}
                                onClick={() => toggleStudentSelection(sId)}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedStudents.includes(sId)
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-gray-300'
                                  }`}>
                                  {selectedStudents.includes(sId) && (
                                    <IconCheck className="h-3 w-3" />
                                  )}
                                </div>
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={student.avatar?.url} />
                                  <AvatarFallback>
                                    {student.fullName?.split(' ').map(n => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-medium">{student.fullName}</p>
                                  <p className="text-sm text-muted-foreground">{student.email}</p>
                                </div>
                                <Badge variant="outline">{student.status}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <IconUser className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No available trainees found</p>
                        </div>
                      )}
                    </div>

                    {selectedStudents.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {selectedStudents.length} trainee(s) selected
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAddStudentDialogOpen(false);
                        setSelectedStudents([]);
                        setStudentSearchTerm("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddStudents}
                      disabled={selectedStudents.length === 0 || isAddingStudent}
                    >
                      {isAddingStudent && <IconLoader className="h-4 w-4 mr-2 animate-spin" />}
                      Add {selectedStudents.length > 0 ? `${selectedStudents.length} ` : ''}Trainee(s)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search trainees by name or email..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={progressFilter} onValueChange={setProgressFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Progress" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Progress</SelectItem>
                <SelectItem value="not-started">Not Started</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {progressError ? (
          <Alert className="mb-4">
            <AlertDescription className="flex items-center gap-2">
              <IconX className="h-4 w-4" />
              Failed to load progress data. Some features may be limited.
            </AlertDescription>
          </Alert>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trainee</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => {
              const studentProgress = departmentProgress.find(p => p.student._id === student._id);
              const progressPercentage = studentProgress?.progressPercentage || 0;
              const completedModules = studentProgress?.completedModules || 0;
              const totalModules = studentProgress?.totalModules || 0;
              const lastActivity = studentProgress?.lastActivity;

              return (
                <TableRow key={student._id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2">
                        <AvatarImage
                          src={student.avatar?.url}
                          alt={student.fullName}
                        />
                        <AvatarFallback className="bg-blue-100 text-blue-800 font-medium">
                          {student.fullName
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-sm text-muted-foreground">@{student.userName || (student.email ? student.email.split('@')[0] : 'user')}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <IconMail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-48">{student.email}</span>
                      </div>
                      {student.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <IconPhone className="h-3 w-3 text-muted-foreground" />
                          <span>{student.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {progressLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-2 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ) : (
                      <div className="space-y-2 min-w-28">
                        <div className="flex items-center gap-2">
                          <Progress value={progressPercentage} className="h-2 flex-1" />
                          <span className="text-xs font-medium text-muted-foreground">
                            {progressPercentage}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <IconTrendingUp className="h-3 w-3" />
                          {completedModules} / {totalModules} modules
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(student.status)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {lastActivity ? (
                        <div>
                          <div>{new Date(lastActivity).toLocaleDateString()}</div>
                          <div className="text-xs">{new Date(lastActivity).toLocaleTimeString()}</div>
                        </div>
                      ) : (
                        <span className="text-xs">No activity</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/employees/${student._id}`)}
                        className="gap-1"
                      >
                        <IconEye className="h-4 w-4" />
                        View
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <IconDotsVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/admin/employees/${student._id}`)}
                          >
                            <IconEye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              // Handle send message logic
                            }}
                          >
                            <IconMail className="h-4 w-4 mr-2" />
                            Send Message
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-red-600"
                              >
                                <IconUserMinus className="h-4 w-4 mr-2" />
                                Remove from Department
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {student.fullName} from this department?
                                  This will remove their access to the department course content and progress.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveStudent(student._id, student.fullName)}
                                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                  disabled={isRemovingStudent}
                                >
                                  {isRemovingStudent && <IconLoader className="h-4 w-4 mr-2 animate-spin" />}
                                  Remove Trainee
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Showing page {page} of {totalPages} ({totalTrainees} total trainees)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || progressFetching}
              >
                <IconChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || progressFetching}
              >
                Next
                <IconChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {filteredStudents.length === 0 && !progressLoading && (
          <div className="text-center py-8 space-y-2">
            <IconUser className="h-12 w-12 text-muted-foreground mx-auto" />
            <div className="text-muted-foreground">
              {searchTerm || statusFilter !== "all" || progressFilter !== "all"
                ? "No trainees match your current filters"
                : "No trainees found"
              }
            </div>
            {(searchTerm || statusFilter !== "all" || progressFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setProgressFilter("all");
                }}
                className="gap-2"
              >
                <IconRefresh className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Summary Stats */}
        {!progressLoading && totalTrainees > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{totalTrainees}</div>
              <div className="text-xs text-muted-foreground">Total Trainees</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {departmentProgress.filter(p => p.progressPercentage > 0).length}
              </div>
              <div className="text-xs text-muted-foreground">Active Learners</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">
                {departmentProgress.filter(p => p.progressPercentage >= 100).length}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {Math.round(
                  departmentProgress.reduce((sum, p) => sum + p.progressPercentage, 0) / departmentProgress.length
                )}%
              </div>
              <div className="text-xs text-muted-foreground">Avg Progress</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DepartmentStudentsTable;