import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { IconArrowLeft, IconTrash, IconLoader, IconPlus } from "@tabler/icons-react";
import UserAutocomplete from '@/components/common/UserAutocomplete';
import { toast } from "sonner";
import {
    useGetMachineByIdQuery,
    useGetMachineEmployeesQuery,
    useAssignEmployeeMutation,
    useRemoveEmployeeMutation
} from '@/Redux/AllApi/MachineApi';
import { useGetDepartmentByIdQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetLinesByDepartmentQuery } from '@/Redux/AllApi/LineApi';

const MachineDetail = () => {
    const { departmentId, lineId, machineId } = useParams();
    const navigate = useNavigate();
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Fetch Data
    const { data: machineData, isLoading: isMachineLoading } = useGetMachineByIdQuery(machineId, {
        skip: !machineId || isNaN(machineId)
    });
    const { data: employeesData, isLoading: isEmployeesLoading } = useGetMachineEmployeesQuery(machineId, {
        skip: !machineId || isNaN(machineId)
    });
    const { data: departmentData, isLoading: isDeptLoading } = useGetDepartmentByIdQuery(departmentId, {
        skip: !departmentId || (isNaN(departmentId) && !departmentId.includes('-')) // Allow slugs if needed, but not "undefined"
    });
    // We optionally fetch line data just for breadcrumbs/context if needed, but machine details should contain line ID
    const { data: linesData } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !departmentId || (isNaN(departmentId) && !departmentId.includes('-'))
    });

    const [assignEmployee, { isLoading: isAssigning }] = useAssignEmployeeMutation();
    const [removeEmployee, { isLoading: isRemoving }] = useRemoveEmployeeMutation();

    const machine = machineData?.data;
    const employees = employeesData?.data || [];
    // Accessing students from department data. Adjust based on actual API response structure.
    // Usually departmentData.data.students or similar. 
    // If getDepartmentById returns populated students, we use that.
    const departmentStudents = departmentData?.data?.students || [];
    // Note: If students are not in departmentData, we might need a separate call. 
    // Assuming they are there based on typical "Get Department" implementations in this project context.

    // Filter potential students (those not already assigned)
    const potentialStudents = useMemo(() => {
        if (!departmentStudents || !employees) return [];
        const assignedIds = new Set(employees.map(e => e.id || e._id));
        return departmentStudents.filter(s => !assignedIds.has(s.id || s._id));
    }, [departmentStudents, employees]);

    const lineName = linesData?.data?.find(l => (l.id || l._id) == lineId)?.name || "Line";

    const handleAssign = async () => {
        if (!selectedStudent?.id) {
            toast.error("Please select an operator");
            return;
        }

        try {
            await assignEmployee({ machineId, userId: selectedStudent.id }).unwrap();
            toast.success("Operator assigned successfully");
            setSelectedStudent(null);
        } catch (error) {
            toast.error(error.data?.message || "Failed to assign operator");
        }
    };

    const handleRemove = async (userId) => {
        if (!userId) {
            toast.error("Invalid user ID");
            return;
        }
        if (!window.confirm("Are you sure you want to remove this operator from the machine?")) return;

        try {
            await removeEmployee({ machineId, userId }).unwrap();
            toast.success("Operator removed successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to remove operator");
        }
    };

    if (isMachineLoading || isEmployeesLoading || isDeptLoading) {
        return <div className="flex justify-center items-center h-screen"><IconLoader className="animate-spin" /></div>;
    }

    if (!machine) {
        return <div className="p-8 text-center">Machine not found</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <IconArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{machine.name}</h1>
                    <p className="text-sm text-gray-500">
                        {departmentData?.data?.name || "Department"} &gt; {lineName} &gt; {machine.name}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Machine Info / Actions */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Add Operator</CardTitle>
                        <CardDescription>Assign an operator from {departmentData?.data?.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Search Operator</label>
                            <UserAutocomplete
                                departmentId={departmentId}
                                value={selectedStudent?.fullName || ""}
                                onChange={(user) => setSelectedStudent(user)}
                                placeholder="Search by name or Employee ID..."
                            />
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleAssign}
                            disabled={!selectedStudent?.id || isAssigning}
                        >
                            {isAssigning ? <IconLoader className="animate-spin h-4 w-4 mr-2" /> : <IconPlus className="h-4 w-4 mr-2" />}
                            Assign Operator
                        </Button>
                    </CardContent>
                </Card>

                {/* Assigned Employees List */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Assigned Employees</CardTitle>
                        <CardDescription>
                            {employees.length} operator{employees.length !== 1 ? 's' : ''} assigned to this machine
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {employees.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No employees assigned yet.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Operator</TableHead>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Assigned At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map((emp) => (
                                        <TableRow key={emp.id || emp._id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {/* Avatar could go here */}
                                                    {emp.fullName}
                                                </div>
                                            </TableCell>
                                            <TableCell>{emp.empId}</TableCell>
                                            <TableCell>
                                                {emp.assigned_at ? new Date(emp.assigned_at).toLocaleDateString() : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => handleRemove(emp.id || emp._id)}
                                                    disabled={isRemoving}
                                                >
                                                    {isRemoving ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default MachineDetail;
