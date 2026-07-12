import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    IconArrowLeft,
    IconTrash,
    IconLoader,
    IconPlus,
    IconSearch,
    IconUsers,
    IconUserCog,
    IconUserCheck,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
    useGetMachineByIdQuery,
    useAssignEmployeeMutation,
    useRemoveEmployeeMutation
} from '@/Redux/AllApi/MachineApi';
import { useGetDepartmentByIdQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetLinesByDepartmentQuery } from '@/Redux/AllApi/LineApi';
import { useGetAllUsersQuery } from '@/Redux/AllApi/UserApi';
import { useDebounce } from '@/hooks/useDebounce';
import { useLogActionMutation } from '@/Redux/AllApi/AuditApi';

const PAGE_SIZE = 30;

const LEVEL_STYLES = {
    L1: "bg-blue-100 text-blue-800 border-blue-200",
    L2: "bg-orange-100 text-orange-800 border-orange-200",
    L3: "bg-green-100 text-green-800 border-green-200",
    L4: "bg-purple-100 text-purple-800 border-purple-200",
};

const LevelBadge = ({ level }) => {
    const raw = level || "Under Monitoring";
    const style = LEVEL_STYLES[raw] || "bg-amber-100 text-amber-800 border-amber-200";
    return (
        <Badge variant="outline" className={`${style} font-medium text-[10px] px-2 py-0.5 whitespace-nowrap`}>
            {raw}
        </Badge>
    );
};

const initialsOf = (name) => (name || "?")
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

// Manages a paginated, searchable, infinitely-scrollable list backed by useGetAllUsersQuery.
// Resets to page 1 whenever the search term (or any of the extra query args) changes, and
// accumulates subsequent pages locally since RTK Query caches each page arg separately.
const useOperatorGrid = (baseParams, { skip }) => {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);
    const [page, setPage] = useState(1);
    const [items, setItems] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const [total, setTotal] = useState(0);

    const paramsKey = JSON.stringify(baseParams);

    const { data, isFetching, refetch } = useGetAllUsersQuery(
        { ...baseParams, page, limit: PAGE_SIZE, search: debouncedSearch },
        { skip }
    );

    useEffect(() => {
        setPage(1);
        setItems([]);
        setHasMore(true);
        setTotal(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, paramsKey]);

    useEffect(() => {
        const users = data?.data?.users;
        if (!users) return;
        setItems(prev => {
            if (page === 1) return users;
            // Merge fresh data for users we already hold locally (e.g. after an optimistic
            // update) instead of discarding it, and append any genuinely new users.
            const newUsersMap = new Map(users.map(u => [u.id || u._id, u]));
            const updatedPrev = prev.map(u => {
                const id = u.id || u._id;
                return newUsersMap.has(id) ? newUsersMap.get(id) : u;
            });
            const existingIds = new Set(prev.map(u => u.id || u._id));
            const trulyNew = users.filter(u => !existingIds.has(u.id || u._id));
            return [...updatedPrev, ...trulyNew];
        });
        const totalPages = data?.data?.totalPages || 1;
        setHasMore(page < totalPages);
        setTotal(data?.data?.totalUsers ?? 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, page]);

    const loadMore = () => {
        if (!hasMore || isFetching) return;
        setPage(p => p + 1);
    };

    const reset = () => {
        setPage(1);
        setItems([]);
        setHasMore(true);
        setTotal(0);
        refetch();
    };

    return {
        search,
        setSearch,
        items,
        setItems,
        isFetching,
        hasMore,
        total,
        setTotal,
        loadMore,
        reset,
    };
};

// Attaches an IntersectionObserver watching a sentinel element inside a scrollable container,
// triggering onLoadMore when the sentinel scrolls into view.
const useInfiniteScrollSentinel = (containerRef, sentinelRef, onLoadMore, active) => {
    useEffect(() => {
        const container = containerRef.current;
        const sentinel = sentinelRef.current;
        if (!container || !sentinel || !active) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) onLoadMore();
        }, { root: container, threshold: 0.1 });

        observer.observe(sentinel);
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);
};

const MachineDetail = () => {
    const { departmentId, lineId, machineId } = useParams();
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);

    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

    const rawAssignedDepts = Array.isArray(user?.departments) ? [...user.departments] : [];
    if (user?.departmentId) rawAssignedDepts.push(user.departmentId);
    const assignedDeptIds = rawAssignedDepts.map(id => String(id?.id || id?._id || id)).filter(Boolean);

    const rawAssignedSections = Array.isArray(user?.sections) ? [...user.sections] : [];
    if (user?.sectionId) rawAssignedSections.push(user.sectionId);
    const assignedSectionIds = rawAssignedSections.map(id => String(id?.id || id?._id || id)).filter(Boolean);

    const validDepartmentId = departmentId && (!isNaN(departmentId) || departmentId.includes('-'));
    const validMachineId = machineId && !isNaN(machineId);

    const { data: machineData, isLoading: isMachineLoading } = useGetMachineByIdQuery(machineId, {
        skip: !validMachineId
    });
    const { data: departmentData, isLoading: isDeptLoading } = useGetDepartmentByIdQuery(departmentId, {
        skip: !validDepartmentId
    });
    const { data: linesData } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !validDepartmentId
    });

    const [assignEmployee] = useAssignEmployeeMutation();
    const [removeEmployee] = useRemoveEmployeeMutation();
    const [logAction] = useLogActionMutation();
    const [assigningIds, setAssigningIds] = useState({});
    const [removingIds, setRemovingIds] = useState({});

    const machine = machineData?.data;
    const lineName = linesData?.data?.find(l => (l.id || l._id) == lineId)?.name || "Line";

    useEffect(() => {
        if (!machine) return;
        logAction({
            action: "VIEW_MACHINE_DETAIL",
            details: { departmentId, lineId, machineId, machineName: machine.name },
        });
    }, [departmentId, lineId, machineId, machine?.name]);

    let querySectionId;
    let shouldSkipDeptQuery = !validDepartmentId;

    if (!isAdmin) {
        const hasDeptAccess = assignedDeptIds.length === 0 || assignedDeptIds.includes(String(departmentId));
        if (!hasDeptAccess) {
            shouldSkipDeptQuery = true;
        } else if (assignedSectionIds.length > 0) {
            querySectionId = assignedSectionIds.join(",");
        }
    }

    const departmentGrid = useOperatorGrid(
        { departmentId, sectionId: querySectionId, role: "STUDENT" },
        { skip: shouldSkipDeptQuery }
    );
    const assignedGrid = useOperatorGrid(
        { stationId: machineId },
        { skip: !validMachineId }
    );

    const leftContainerRef = useRef(null);
    const leftSentinelRef = useRef(null);
    useInfiniteScrollSentinel(leftContainerRef, leftSentinelRef, departmentGrid.loadMore, departmentGrid.hasMore && !departmentGrid.isFetching);

    const rightContainerRef = useRef(null);
    const rightSentinelRef = useRef(null);
    useInfiniteScrollSentinel(rightContainerRef, rightSentinelRef, assignedGrid.loadMore, assignedGrid.hasMore && !assignedGrid.isFetching);

    const isAssignedToMachine = (operator) => {
        if (!machine) return false;
        return operator.assignments?.some(a => String(a.machineId) === String(machine.id));
    };

    const handleAssign = async (userId) => {
        setAssigningIds(prev => ({ ...prev, [userId]: true }));

        const operator = departmentGrid.items.find(u => (u.id || u._id) === userId);
        if (!operator) {
            setAssigningIds(prev => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
            return;
        }

        const newAssignment = {
            machineId: Number(machineId),
            stationName: machine.name,
            subSectionId: machine.subSectionId,
            subSectionName: machine.subSectionName || "",
            assigned_at: new Date().toISOString()
        };

        const updatedOperator = {
            ...operator,
            assignments: [...(operator.assignments || []), newAssignment]
        };

        departmentGrid.setItems(prev => prev.map(u => (u.id || u._id) === userId ? updatedOperator : u));
        assignedGrid.setItems(prev => {
            const exists = prev.some(u => (u.id || u._id) === userId);
            if (exists) return prev;
            return [updatedOperator, ...prev];
        });
        assignedGrid.setTotal(t => t + 1);

        try {
            await assignEmployee({ machineId, userId }).unwrap();
            logAction({
                action: "ASSIGN_OPERATOR_TO_STATION",
                details: { machineId, machineName: machine.name, userId, userName: operator.fullName },
            });
            toast.success("Operator assigned successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to assign operator");
            departmentGrid.setItems(prev => prev.map(u => (u.id || u._id) === userId ? operator : u));
            assignedGrid.setItems(prev => prev.filter(u => (u.id || u._id) !== userId));
            assignedGrid.setTotal(t => Math.max(0, t - 1));
        } finally {
            setAssigningIds(prev => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        }
    };

    const handleRemove = async (userId) => {
        if (!window.confirm("Are you sure you want to remove this operator from the machine?")) return;
        setRemovingIds(prev => ({ ...prev, [userId]: true }));

        const operator = assignedGrid.items.find(u => (u.id || u._id) === userId);
        let updatedOperator = null;
        if (operator) {
            updatedOperator = {
                ...operator,
                assignments: (operator.assignments || []).filter(a => String(a.machineId) !== String(machineId))
            };
        }

        assignedGrid.setItems(prev => prev.filter(u => (u.id || u._id) !== userId));
        assignedGrid.setTotal(t => Math.max(0, t - 1));
        if (updatedOperator) {
            departmentGrid.setItems(prev => prev.map(u => (u.id || u._id) === userId ? updatedOperator : u));
        }

        try {
            await removeEmployee({ machineId, userId }).unwrap();
            logAction({
                action: "REMOVE_OPERATOR_FROM_STATION",
                details: { machineId, machineName: machine.name, userId, userName: operator?.fullName },
            });
            toast.success("Operator removed successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to remove operator");
            if (operator) {
                assignedGrid.setItems(prev => {
                    const exists = prev.some(u => (u.id || u._id) === userId);
                    if (exists) return prev;
                    return [...prev, operator];
                });
                assignedGrid.setTotal(t => t + 1);
                departmentGrid.setItems(prev => prev.map(u => (u.id || u._id) === userId ? operator : u));
            }
        } finally {
            setRemovingIds(prev => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        }
    };

    if (isMachineLoading || isDeptLoading) {
        return <div className="flex justify-center items-center h-screen"><IconLoader className="animate-spin" /></div>;
    }

    if (!machine) {
        return <div className="p-8 text-center">Machine not found</div>;
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-2">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT GRID: Department Operators */}
                <Card className="shadow-sm">
                    <CardHeader className="space-y-3 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <IconUsers className="h-5 w-5 text-blue-600" />
                                    Department Operators
                                </CardTitle>
                                <CardDescription>
                                    {departmentGrid.total} operator{departmentGrid.total !== 1 ? 's' : ''} {querySectionId ? "in assigned sections" : `in ${departmentData?.data?.name || "this department"}`}
                                </CardDescription>
                            </div>
                        </div>
                        <div className="relative">
                            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search by name or Employee ID..."
                                className="pl-8"
                                value={departmentGrid.search}
                                onChange={(e) => departmentGrid.setSearch(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div ref={leftContainerRef} className="max-h-[560px] overflow-y-auto space-y-2 pr-1 -mr-1">
                            {departmentGrid.items.length === 0 && !departmentGrid.isFetching ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No operators found.</div>
                            ) : (
                                departmentGrid.items.map((op) => {
                                    const opId = op.id || op._id;
                                    const assigned = isAssignedToMachine(op);
                                    return (
                                        <div
                                            key={opId}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 transition-colors hover:bg-gray-50 hover:border-gray-200"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar className="h-9 w-9 shrink-0">
                                                    <AvatarFallback className="bg-blue-100 text-blue-800 text-xs font-semibold">
                                                        {initialsOf(op.fullName)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm truncate">{op.fullName}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        ID: {op.empId || 'N/A'} &middot; {op.deptName || '—'} &middot; {op.sectionName || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <LevelBadge level={op.primaryLevel} />
                                                <Button
                                                    size="sm"
                                                    variant={assigned ? "secondary" : "default"}
                                                    disabled={assigned || !!assigningIds[opId]}
                                                    onClick={() => handleAssign(opId)}
                                                    className="gap-1"
                                                >
                                                    {assigningIds[opId] ? (
                                                        <IconLoader className="h-4 w-4 animate-spin" />
                                                    ) : assigned ? (
                                                        <IconUserCheck className="h-4 w-4" />
                                                    ) : (
                                                        <IconPlus className="h-4 w-4" />
                                                    )}
                                                    {assigned ? "Assigned" : "Assign"}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={leftSentinelRef} className="h-2" />
                            {departmentGrid.isFetching && (
                                <div className="flex justify-center py-3">
                                    <IconLoader className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT GRID: Assigned Operators */}
                <Card className="shadow-sm">
                    <CardHeader className="space-y-3 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <IconUserCog className="h-5 w-5 text-emerald-600" />
                                    Assigned Operators
                                </CardTitle>
                                <CardDescription>
                                    {assignedGrid.total} operator{assignedGrid.total !== 1 ? 's' : ''} assigned to this machine
                                </CardDescription>
                            </div>
                        </div>
                        <div className="relative">
                            <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search assigned operators..."
                                className="pl-8"
                                value={assignedGrid.search}
                                onChange={(e) => assignedGrid.setSearch(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div ref={rightContainerRef} className="max-h-[560px] overflow-y-auto space-y-2 pr-1 -mr-1">
                            {assignedGrid.items.length === 0 && !assignedGrid.isFetching ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">No operators assigned yet.</div>
                            ) : (
                                assignedGrid.items.map((op) => {
                                    const opId = op.id || op._id;
                                    const assignment = op.assignments?.find(a => String(a.machineId) === String(machine.id));
                                    const subLevel = machine.subSectionId != null ? op.currentSkill?.[machine.subSectionId] : null;
                                    return (
                                        <div
                                            key={opId}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 transition-colors hover:bg-gray-50 hover:border-gray-200"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Avatar className="h-9 w-9 shrink-0">
                                                    <AvatarFallback className="bg-emerald-100 text-emerald-800 text-xs font-semibold">
                                                        {initialsOf(op.fullName)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm truncate">{op.fullName}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        ID: {op.empId || 'N/A'} &middot; Assigned {assignment?.assigned_at ? new Date(assignment.assigned_at).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-muted-foreground">Overall</span>
                                                        <LevelBadge level={op.primaryLevel} />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-muted-foreground">Sub-section</span>
                                                        <LevelBadge level={subLevel} />
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => handleRemove(opId)}
                                                    disabled={!!removingIds[opId]}
                                                >
                                                    {removingIds[opId] ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={rightSentinelRef} className="h-2" />
                            {assignedGrid.isFetching && (
                                <div className="flex justify-center py-3">
                                    <IconLoader className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default MachineDetail;
