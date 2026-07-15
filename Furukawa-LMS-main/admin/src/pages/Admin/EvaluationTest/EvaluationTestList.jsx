import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
    useGetEvaluationTestsQuery,
    useDeleteEvaluationTestMutation
} from "@/Redux/AllApi/EvaluationTestApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    Table, 
    TableHeader, 
    TableRow, 
    TableHead, 
    TableBody, 
    TableCell 
} from "@/components/ui/table";
import { 
    IconPlus, 
    IconSearch, 
    IconTrash, 
    IconEdit, 
    IconPrinter, 
    IconClipboardCheck,
    IconLoader
} from "@tabler/icons-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EvaluationTestMonitoring from "./EvaluationTestMonitoring";

const EvaluationTestList = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const subTabParam = searchParams.get("subTab");
    const [activeSubTab, setActiveSubTab] = useState(subTabParam || "evaluationTest");
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState(null);

    useEffect(() => {
        setActiveSubTab(subTabParam || "evaluationTest");
    }, [subTabParam]);

    const handleSubTabChange = (value) => {
        setActiveSubTab(value);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("subTab", value);
            return params;
        });
    };

    // Permission checking
    const currentUser = useSelector((state) => state.auth.user);
    const hasPermission = (permission) => {
        if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
        return currentUser?.customRole?.permissions?.includes(permission);
    };
    const canCreate = hasPermission("dojo_evaluation_test:create");

    const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN" || currentUser?.isAdmin;

    const assignedDepartments = useMemo(() => {
        const ids = [];
        if (Array.isArray(currentUser?.departments)) {
            currentUser.departments.forEach((d) => {
                const id = d && typeof d === "object" ? (d.id || d._id) : d;
                if (id) ids.push(String(id));
            });
        }
        if (currentUser?.departmentId) ids.push(String(currentUser.departmentId));
        return [...new Set(ids)];
    }, [currentUser]);

    const isUserRestricted = !isAdmin && assignedDepartments.length > 0;
    const isDeptSelectDisabled = isUserRestricted && assignedDepartments.length === 1;

    const [selectedDepartment, setSelectedDepartment] = useState(() => (isUserRestricted ? assignedDepartments[0] : "all"));

    useEffect(() => {
        if (isUserRestricted && !assignedDepartments.includes(selectedDepartment)) {
            setSelectedDepartment(assignedDepartments[0]);
        }
    }, [isUserRestricted, assignedDepartments, selectedDepartment]);

    // RTK Query hooks
    const { data: response, isLoading, isError, refetch } = useGetEvaluationTestsQuery(
        selectedDepartment !== "all" ? { departmentId: selectedDepartment } : undefined
    );
    const [deleteEvaluationTest, { isLoading: isDeleting }] = useDeleteEvaluationTestMutation();
    const { data: departmentsData } = useGetAllDepartmentsQuery({ limit: 1000 });
    const departments = departmentsData?.data?.departments || [];
    const assignableDepartments = useMemo(() => {
        if (!isUserRestricted) return departments;
        return departments.filter((d) => assignedDepartments.includes(String(d.id)));
    }, [departments, assignedDepartments, isUserRestricted]);

    const testPapers = response?.data || [];

    // Filter tests by search term
    const filteredPapers = testPapers.filter(paper => 
        paper.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDeleteClick = (id) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteEvaluationTest(deleteId).unwrap();
            setDeleteId(null);
            refetch();
        } catch (error) {
            console.error("Failed to delete evaluation test", error);
            alert("Error deleting DOJO evaluation test template.");
        }
    };

    return (
        <Tabs value={activeSubTab} onValueChange={handleSubTabChange} className="w-full space-y-6 animate-in fade-in duration-300">
            <TabsList className="bg-slate-100 p-1 rounded-xl h-11 w-fit">
                <TabsTrigger value="evaluationTest" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Evaluation Test Templates
                </TabsTrigger>
                <TabsTrigger value="evaluationTestMonitoring" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Evaluation Test Monitoring
                </TabsTrigger>
            </TabsList>

            <TabsContent value="evaluationTest" className="space-y-6">
                {/* Page Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            <IconClipboardCheck className="text-blue-600 h-7 w-7" />
                            DOJO Evaluation Tests
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Build and manage custom practical DOJO evaluation test papers with dynamic checking items and result structures.
                        </p>
                    </div>
                    {canCreate && (
                        <Button 
                            onClick={() => navigate("/admin/add-evaluation-test")}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-200 flex items-center gap-2 transition-all duration-300 transform hover:scale-[1.02]"
                        >
                            <IconPlus className="h-4 w-4" />
                            Create DOJO Evaluation Test
                        </Button>
                    )}
                </div>

                {/* List and Search Card */}
                <Card className="border border-gray-150/60 shadow-sm rounded-xl">
                    <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-lg font-semibold text-gray-800">Test Papers List</CardTitle>
                                <CardDescription>View, edit, print, or delete practical DOJO evaluation templates.</CardDescription>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={isDeptSelectDisabled}>
                                    <SelectTrigger className="w-full sm:w-52 h-9 text-xs border-gray-200 rounded-lg">
                                        <SelectValue placeholder="All Departments" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {!isUserRestricted && (
                                            <SelectItem value="all">All Departments</SelectItem>
                                        )}
                                        {assignableDepartments.map((d) => (
                                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="relative w-full md:w-80">
                                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                        type="text"
                                        placeholder="Search by test paper title..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2 border border-gray-200 focus:ring-2 focus:ring-blue-100 rounded-lg text-sm transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 sm:px-6 pb-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
                                <IconLoader className="animate-spin text-blue-600 h-8 w-8" />
                                <span className="text-sm font-medium">Fetching DOJO evaluation sheets...</span>
                            </div>
                        ) : isError ? (
                            <div className="text-center py-16 text-red-500 bg-red-50/50 rounded-xl m-6">
                                <p className="font-semibold text-lg">Error loading DOJO evaluation tests</p>
                                <p className="text-sm mt-1 text-red-400">Please make sure the server is running and try again.</p>
                                <Button onClick={() => refetch()} className="mt-4 bg-red-100 hover:bg-red-200 text-red-700 font-medium">
                                    Retry
                                </Button>
                            </div>
                        ) : filteredPapers.length === 0 ? (
                            <div className="text-center py-20 text-gray-500 border-2 border-dashed border-gray-100 rounded-xl m-6">
                                <IconClipboardCheck className="mx-auto text-gray-300 h-16 w-16 stroke-1 mb-4" />
                                <p className="font-semibold text-lg text-gray-700">No DOJO evaluation tests found</p>
                                <p className="text-sm mt-1 text-gray-400 max-w-sm mx-auto">
                                    {searchTerm ? "Adjust your search filters or clear the text to find existing sheets." : "Create your very first DOJO evaluation sheet template with our visual form builder."}
                                </p>
                                {!searchTerm && canCreate && (
                                    <Button 
                                        onClick={() => navigate("/admin/add-evaluation-test")} 
                                        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                    >
                                        Get Started
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-gray-100">
                                <Table>
                                    <TableHeader className="bg-gray-50/70">
                                        <TableRow>
                                            <TableHead className="w-12 text-center text-xs font-semibold text-gray-600 uppercase">S.No</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-600 uppercase">Test Paper Main Title</TableHead>
                                            <TableHead className="text-center text-xs font-semibold text-gray-600 uppercase">Perform Date Columns</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-600 uppercase">Department</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-600 uppercase">Created By</TableHead>
                                            <TableHead className="text-xs font-semibold text-gray-600 uppercase">Created Date</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-gray-600 uppercase pr-6">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredPapers.map((paper, index) => (
                                            <TableRow key={paper.id} className="hover:bg-gray-50/50 transition-colors">
                                                <TableCell className="text-center font-medium text-gray-500">{index + 1}</TableCell>
                                                <TableCell className="font-semibold text-gray-800">
                                                    <button
                                                        onClick={() => navigate(`/admin/evaluation-test/${paper.id}/operators`, { state: { from: location.pathname + location.search } })}
                                                        className="text-blue-600 hover:text-blue-800 hover:underline text-left font-semibold focus:outline-none transition-all"
                                                    >
                                                        {paper.title}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full">
                                                        {paper.performDateCount} Columns
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-600">
                                                    {paper.departmentName || "All Departments"}
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-600">{paper.createdBy || "Admin"}</TableCell>
                                                <TableCell className="text-sm text-gray-500">
                                                    {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString("en-IN", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric"
                                                    }) : "N/A"}
                                                </TableCell>
                                                <TableCell className="text-right pr-6 space-x-1.5">
                                                    {canCreate && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => navigate(`/admin/edit-evaluation-test/${paper.id}`)}
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50/70"
                                                            title="Edit Test Paper"
                                                        >
                                                            <IconEdit className="h-4.5 w-4.5" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => navigate(`/admin/edit-evaluation-test/${paper.id}?mode=print`)}
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50/70"
                                                        title="View & Print Test Paper"
                                                    >
                                                        <IconPrinter className="h-4.5 w-4.5" />
                                                    </Button>
                                                    {canCreate && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteClick(paper.id)}
                                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50/70"
                                                            title="Delete Test Paper"
                                                        >
                                                            <IconTrash className="h-4.5 w-4.5" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Delete Confirmation Dialog */}
                <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold text-gray-900">Delete DOJO Evaluation Test</DialogTitle>
                            <DialogDescription className="text-sm text-gray-500 mt-2">
                                Are you absolutely sure you want to delete this DOJO evaluation test template? This action cannot be undone and will permanently remove it from the system.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button 
                                variant="outline" 
                                onClick={() => setDeleteId(null)}
                                disabled={isDeleting}
                                className="border-gray-200"
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="destructive" 
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="bg-red-600 hover:bg-red-700 font-semibold"
                            >
                                {isDeleting ? "Deleting..." : "Delete Permanently"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </TabsContent>

            <TabsContent value="evaluationTestMonitoring">
                <EvaluationTestMonitoring />
            </TabsContent>
        </Tabs>
    );
};

export default EvaluationTestList;
