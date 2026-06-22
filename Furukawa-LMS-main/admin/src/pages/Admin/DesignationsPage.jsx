import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useGetDesignationsWithCountsQuery } from "@/Redux/AllApi/UserApi";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { IconSearch, IconId, IconUsers, IconChevronRight, IconLoader } from "@tabler/icons-react";

const DesignationsPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const { data: response, isLoading, isError } = useGetDesignationsWithCountsQuery();
    const designations = response?.data || [];

    const filtered = useMemo(() => {
        if (!search.trim()) return designations;
        const q = search.toLowerCase();
        return designations.filter(d => d.designation.toLowerCase().includes(q));
    }, [designations, search]);

    const handleRowClick = (designation) => {
        navigate(`/admin/designations/${encodeURIComponent(designation)}`);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <IconId size={24} className="text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Designations</h1>
                    <p className="text-sm text-gray-500">
                        Browse all user designations and their operator counts
                    </p>
                </div>
            </div>

            {/* Summary cards */}
            {!isLoading && !isError && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:w-1/2">
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Total Designations</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{designations.length}</p>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Total Operators</p>
                        <p className="text-3xl font-bold text-blue-600 mt-1">
                            {designations.reduce((sum, d) => sum + (d.totalCount || 0), 0)}
                        </p>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Active Operators</p>
                        <p className="text-3xl font-bold text-green-600 mt-1">
                            {designations.reduce((sum, d) => sum + (d.activeCount || 0), 0)}
                        </p>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative w-full max-w-sm">
                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                    className="pl-9"
                    placeholder="Search designations..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                            <TableHead className="w-12 text-center font-semibold">#</TableHead>
                            <TableHead className="font-semibold">Designation</TableHead>
                            <TableHead className="text-center font-semibold">Active Operators</TableHead>
                            <TableHead className="text-center font-semibold">Total Operators</TableHead>
                            <TableHead className="w-10" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <IconLoader size={28} className="animate-spin" />
                                        <span className="text-sm">Loading designations...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {isError && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-16 text-red-500 text-sm">
                                    Failed to load designations. Please try again.
                                </TableCell>
                            </TableRow>
                        )}

                        {!isLoading && !isError && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <IconUsers size={32} />
                                        <span className="text-sm">
                                            {search ? "No designations match your search." : "No designations found."}
                                        </span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {!isLoading && !isError && filtered.map((row, idx) => (
                            <TableRow
                                key={row.designation}
                                className="cursor-pointer hover:bg-blue-50 transition-colors"
                                onClick={() => handleRowClick(row.designation)}
                            >
                                <TableCell className="text-center text-gray-400 text-sm">{idx + 1}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-100 rounded-md">
                                            <IconId size={14} className="text-blue-600" />
                                        </div>
                                        <span className="font-medium text-gray-800">{row.designation}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                        {row.activeCount ?? 0}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        {row.totalCount ?? 0}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-gray-400">
                                    <IconChevronRight size={16} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default DesignationsPage;
