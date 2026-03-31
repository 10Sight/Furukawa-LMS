import React, { useState } from 'react';
import { useGetAllDepartmentsQuery, useGetMyDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { IconExternalLink, IconUsers, IconCalendar } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const InstructorDepartments = ({ instructorId }) => {
    const [page, setPage] = useState(1);
    const navigate = useNavigate();
    const currentUser = useSelector(state => state.auth.user);
    const isCurrentUser = currentUser?._id?.toString() === instructorId?.toString();

    // Use getMyDepartments for current user, filtered query for others
    const { data: myDepartmentsData, isLoading: isMyDepartmentsLoading, error: myDepartmentsError } = useGetMyDepartmentsQuery(
        undefined,
        { skip: !isCurrentUser }
    );

    const { data: allDepartmentsData, isLoading: isAllDepartmentsLoading, error: allDepartmentsError } = useGetAllDepartmentsQuery({
        page: 1,
        limit: 1000
    }, { skip: isCurrentUser });

    // Get the appropriate data based on whether it's current user or not
    let departments = [];
    let isLoading, error, totalPages = 1;

    if (isCurrentUser) {
        departments = myDepartmentsData?.data?.departments || [];
        isLoading = isMyDepartmentsLoading;
        error = myDepartmentsError;
        totalPages = Math.ceil(departments.length / 5); // Calculate pages for client-side pagination
        // Apply client-side pagination for current user's departments
        departments = departments.slice((page - 1) * 5, page * 5);
    } else {
        // Filter departments by instructor for other users
        departments = allDepartmentsData?.data?.departments
            ? allDepartmentsData.data.departments.filter(department => {
                const rawInstructor = department.instructor;
                const departmentInstructorId =
                    rawInstructor && typeof rawInstructor === "object"
                        ? (rawInstructor._id || rawInstructor.id)
                        : rawInstructor;
                return departmentInstructorId != null
                    && instructorId != null
                    && departmentInstructorId.toString() === instructorId.toString();
            })
            : [];
        isLoading = isAllDepartmentsLoading;
        error = allDepartmentsError;
        totalPages = Math.ceil(departments.length / 5) || 1;
        departments = departments.slice((page - 1) * 5, page * 5);
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case "ACTIVE":
                return <Badge variant="success">Active</Badge>;
            case "UPCOMING":
                return <Badge variant="warning">Upcoming</Badge>;
            case "COMPLETED":
                return <Badge variant="outline">Completed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Error loading departments
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Departments</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/admin/departments?instructor=${instructorId}`)}
                >
                    View All
                </Button>
            </div>

            {departments.length > 0 ? (
                <>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Students</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {departments.map((department) => (
                                <TableRow key={department._id}>
                                    <TableCell className="font-medium">{department.name}</TableCell>
                                    <TableCell>
                                        {department.course?.title || "Unknown Course"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <IconUsers className="h-4 w-4" />
                                            <span>{department.students?.length || 0}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm">
                                            <IconCalendar className="h-4 w-4" />
                                            <span>
                                                {new Date(department.startDate).toLocaleDateString()} -{" "}
                                                {new Date(department.endDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(department.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => navigate(`/admin/departments/${department._id}`)}
                                        >
                                            <IconExternalLink className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {totalPages > 1 && (
                        <div className="flex justify-between items-center">
                            <Button
                                variant="outline"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-sm">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-8 text-muted-foreground">
                    No departments assigned to this instructor
                </div>
            )}
        </div>
    );
};

export default InstructorDepartments;
