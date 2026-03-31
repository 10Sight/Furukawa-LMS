import QRCode from "react-qr-code";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCw, User as UserIcon, CreditCard, ChevronDown, Search } from 'lucide-react';
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from 'sonner';

const LEVELS = ['L0', 'L1', 'L2', 'L3'];

const OnboardingID = () => {
    // State for each level: { L0: [], L1: [], ... }
    const [levelData, setLevelData] = useState({ L0: [], L1: [], L2: [], L3: [] });
    // State for total counts: { L0: 0, L1: 0, ... }
    const [levelCounts, setLevelCounts] = useState({ L0: 0, L1: 0, L2: 0, L3: 0 });
    // Loading state for each level or global
    const [loading, setLoading] = useState(false);

    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [filters, setFilters] = useState({
        section: "",
        sub_section: "",
        startDate: "",
        endDate: "",
        search: ""
    });

    const [sections, setSections] = useState([]);
    const [subSections, setSubSections] = useState([]);

    useEffect(() => {
        fetchSections();
    }, []);

    const fetchSections = async () => {
        try {
            const res = await axiosInstance.get('/api/departments');
            if (res.data?.success) {
                // Controller returns { departments: [], ... }
                setSections(res.data.data.departments || []);
            }
        } catch (error) {
            console.error("Failed to fetch sections", error);
            setSections([]);
        }
    };

    useEffect(() => {
        if (filters.section) {
            const selectedSection = sections.find(s => s.name === filters.section);
            if (selectedSection) {
                fetchSubSections(selectedSection.id);
            }
        } else {
            setSubSections([]);
        }
    }, [filters.section, sections]);

    const fetchSubSections = async (sectionId) => {
        try {
            const res = await axiosInstance.get(`/api/lines?sectionId=${sectionId}`);
            if (res.data?.success) {
                setSubSections(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch subsections", error);
        }
    };

    useEffect(() => {
        fetchAllLevels();
    }, [filters]);

    const fetchAllLevels = async () => {
        setLoading(true);
        try {
            const queryBase = new URLSearchParams();
            if (filters.section) queryBase.append("section", filters.section);
            if (filters.sub_section) queryBase.append("sub_section", filters.sub_section);
            if (filters.startDate) queryBase.append("startDate", filters.startDate);
            if (filters.endDate) queryBase.append("endDate", filters.endDate);
            if (filters.search) queryBase.append("search", filters.search);

            // Fetch initial 10 for all levels in parallel
            const promises = LEVELS.map(level => {
                const params = new URLSearchParams(queryBase);
                params.append("currentLevel", level); // Assuming backend expects 'currentLevel' or 'level' - standardizing on 'currentLevel' if possible, but API uses 'level' earlier. Let's try 'level' first as per previous turns, but I'll stick to 'level' as param.
                params.append("level", level);
                params.append("limit", "5");
                params.append("page", "1");
                return axiosInstance.get(`/api/users/employees?${params.toString()}`);
            });

            const results = await Promise.all(promises);

            const newLevelData = {};
            const newLevelCounts = {};

            results.forEach((res, index) => {
                const level = LEVELS[index];
                if (res.data?.success) {
                    newLevelData[level] = res.data.data.data; // The array of employees
                    newLevelCounts[level] = res.data.data.levelSummary?.[level] || 0; // Total count from summary
                } else {
                    newLevelData[level] = [];
                    newLevelCounts[level] = 0;
                }
            });

            setLevelData(newLevelData);
            setLevelCounts(newLevelCounts);
        } catch (error) {
            console.error("Error fetching employees:", error);
            toast.error("Failed to fetch employees");
        } finally {
            setLoading(false);
        }
    };

    const handleSeeMore = async (level) => {
        try {
            const currentLen = levelData[level].length;
            const nextPage = Math.floor(currentLen / 5) + 1;

            const queryBase = new URLSearchParams();
            if (filters.section) queryBase.append("section", filters.section);
            if (filters.sub_section) queryBase.append("sub_section", filters.sub_section);
            if (filters.startDate) queryBase.append("startDate", filters.startDate);
            if (filters.endDate) queryBase.append("endDate", filters.endDate);
            if (filters.search) queryBase.append("search", filters.search);

            queryBase.append("level", level);
            queryBase.append("limit", "5");
            queryBase.append("page", nextPage.toString());

            const res = await axiosInstance.get(`/api/users/employees?${queryBase.toString()}`);
            if (res.data?.success) {
                const newUsers = res.data.data.data;
                setLevelData(prev => ({
                    ...prev,
                    [level]: [...prev[level], ...newUsers]
                }));
            }
        } catch (error) {
            console.error("Error fetching more employees:", error);
            toast.error("Failed to load more employees");
        }
    };


    const handleGetCard = async (employee) => {
        try {
            setSelectedEmployee(employee);
            const res = await axiosInstance.get(`/api/users/employees/${employee.id}`);
            if (res.data?.success) {
                setSelectedEmployee(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching employee details:", error);
            toast.error("Failed to fetch employee details");
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-6">
            {/* Header / Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">Onboarding & ID</h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                        <span className="text-xs text-slate-500 pl-2 uppercase font-bold tracking-wider">Filters:</span>

                        <Select onValueChange={(v) => handleFilterChange("section", v === "ALL" ? "" : v)}>
                            <SelectTrigger className="w-[180px] h-8 bg-transparent border-none text-slate-700 focus:ring-0">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Sections</SelectItem>
                                {Array.isArray(sections) && sections.map((sec) => (
                                    <SelectItem key={sec.id} value={sec.name}>{sec.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        <Select
                            onValueChange={(v) => handleFilterChange("sub_section", v === "ALL" ? "" : v)}
                            disabled={!filters.section}
                        >
                            <SelectTrigger className="w-[180px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 disabled:opacity-50">
                                <SelectValue placeholder={!filters.section ? "Select Section First" : "All Sub Sections"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Sub Sections</SelectItem>
                                {subSections.map((sub) => (
                                    <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        <div className="flex items-center gap-2 px-2">
                            <span className="text-xs text-slate-400">Date:</span>
                            <Input
                                type="date"
                                className="h-8 w-32 bg-transparent border-none text-slate-700 text-xs p-0 focus-visible:ring-0"
                                onChange={(e) => handleFilterChange("startDate", e.target.value)}
                            />
                            <span className="text-slate-400">-</span>
                            <Input
                                type="date"
                                className="h-8 w-32 bg-transparent border-none text-slate-700 text-xs p-0 focus-visible:ring-0"
                                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                            />
                        </div>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={fetchAllLevels}>
                            <RotateCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Candidate List Section */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Search and Header Card */}
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <h2 className="text-lg font-bold text-slate-900 mb-4">Candidate Registration & Training</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search candidates..."
                                    className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-600"
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange("search", e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {loading ? (
                        <div className="text-center py-10 text-slate-500">Loading employees...</div>
                    ) : (
                        LEVELS.map(level => (
                            <Card key={level} className="bg-white border-slate-200 shadow-sm overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="bg-slate-50 p-3 border-b border-slate-100 flex justify-between items-center">
                                        <div>
                                            <h2 className="text-sm font-bold text-slate-800">Skill Level {level}</h2>
                                            <p className="text-xs text-slate-500">Total: {levelCounts[level]} Employees</p>
                                        </div>
                                        {/* Status indicator can go here */}
                                    </div>

                                    <div className="p-3 space-y-2">
                                        {levelData[level].length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-4">No employees in this level</p>
                                        ) : (
                                            levelData[level].map((emp) => (
                                                <div key={emp.id} className="bg-white hover:bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center justify-between transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white
                                                            ${level === 'L0' ? 'bg-blue-500' : level === 'L1' ? 'bg-green-500' : level === 'L2' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                                                            {emp.fullName?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-sm font-medium text-slate-900">{emp.fullName}</h3>
                                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 uppercase font-bold tracking-wider">
                                                                    {emp.isEmployee ? 'Emp' : 'Trainee'}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-500 text-[10px]">{emp.section} • {emp.sub_section}</p>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 h-7 text-xs gap-1"
                                                        onClick={() => handleGetCard(emp)}
                                                    >
                                                        <CreditCard className="w-3 h-3" />
                                                        Card
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* See More Button */}
                                    {levelCounts[level] > levelData[level].length && (
                                        <div className="p-2 border-t border-slate-100">
                                            <Button
                                                variant="ghost"
                                                className="w-full h-8 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-50"
                                                onClick={() => handleSeeMore(level)}
                                            >
                                                Show More ({levelCounts[level] - levelData[level].length} remaining)
                                                <ChevronDown className="ml-1 h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* ID Card Preview Section */}
                <div className="lg:col-span-5">
                    <Card className="bg-white border-slate-200 shadow-sm sticky top-24">
                        <CardContent className="p-6 flex flex-col items-center">
                            <h2 className="text-lg font-semibold mb-8 w-full text-slate-900 border-b border-slate-100 pb-4">ID Card Preview</h2>

                            <div className="w-full max-w-[320px] aspect-[9/16] bg-white rounded-3xl relative overflow-hidden shadow-2xl flex flex-col border border-slate-200 mx-auto">
                                {!selectedEmployee ? (
                                    // Empty / Skeleton State (Matching Reference Image)
                                    <>
                                        <div className="h-[25%] bg-zinc-400 w-full"></div>
                                        <div className="flex-1 bg-white relative flex flex-col items-center px-6">
                                            {/* Avatar Skeleton */}
                                            <div className="w-28 h-28 rounded-full bg-white p-1 -mt-14 flex items-center justify-center">
                                                <div className="w-full h-full rounded-full bg-zinc-100 border-4 border-white flex items-center justify-center">
                                                    <UserIcon className="w-10 h-10 text-zinc-300" />
                                                </div>
                                            </div>

                                            {/* Text Skeletons */}
                                            <div className="mt-4 w-32 h-6 bg-zinc-100 rounded-md"></div>
                                            <div className="mt-2 w-24 h-4 bg-zinc-100 rounded-md"></div>

                                            <div className="flex gap-2 mt-4">
                                                <div className="w-16 h-5 bg-zinc-100 rounded-full"></div>
                                                <div className="w-16 h-5 bg-zinc-100 rounded-full"></div>
                                            </div>

                                            {/* QR Skeleton */}
                                            <div className="w-48 h-48 bg-zinc-50 rounded-xl mt-8 flex items-center justify-center">
                                                <span className="text-zinc-300 text-xs font-medium tracking-wider uppercase">QR Preview</span>
                                            </div>

                                            <div className="mt-auto mb-8 w-32 h-4 bg-zinc-50 rounded-full"></div>
                                        </div>
                                    </>
                                ) : (
                                    // Active State
                                    <>
                                        <div className="h-[25%] bg-gradient-to-r from-blue-600 to-blue-500 w-full relative">

                                        </div>
                                        <div className="flex-1 bg-white relative flex flex-col items-center px-6">
                                            {/* Avatar */}
                                            <div className="w-28 h-28 rounded-full bg-white p-1 -mt-14 flex items-center justify-center z-10">
                                                <div className="w-full h-full rounded-full border-4 border-white overflow-hidden bg-zinc-100 flex items-center justify-center shadow-sm">
                                                    {selectedEmployee.avatar?.url ? (
                                                        <img src={selectedEmployee.avatar.url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <UserIcon className="w-10 h-10 text-zinc-300" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <h3 className="mt-2 text-xl font-bold text-slate-900 text-center leading-tight">
                                                {selectedEmployee.fullName}
                                            </h3>
                                            <p className="text-blue-600 text-sm font-semibold uppercase tracking-wide mt-1">
                                                {selectedEmployee.role}
                                            </p>

                                            <div className="flex gap-2 mt-4">
                                                <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-bold border border-slate-200">
                                                    #{selectedEmployee.employeeId || 'ID-MISSING'}
                                                </span>
                                                <span className="text-[10px] bg-blue-50 px-3 py-1 rounded-full text-blue-600 font-bold border border-blue-100">
                                                    Level {selectedEmployee.currentLevel || 'L0'}
                                                </span>
                                            </div>

                                            {/* Details Grid (Compact) */}
                                            <div className="w-full grid grid-cols-2 gap-2 mt-6 text-center">
                                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Section</p>
                                                    <p className="text-xs font-semibold text-slate-700 truncate">{selectedEmployee.section || '-'}</p>
                                                </div>
                                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Line</p>
                                                    <p className="text-xs font-semibold text-slate-700 truncate">{selectedEmployee.sub_section || '-'}</p>
                                                </div>
                                            </div>

                                            {/* QR Code */}
                                            <div className="mt-auto mb-8 flex flex-col items-center">
                                                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                    <QRCode
                                                        size={100}
                                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                                        value={JSON.stringify({
                                                            id: selectedEmployee.id || selectedEmployee._id,
                                                            name: selectedEmployee.fullName,
                                                            role: selectedEmployee.role,
                                                            section: selectedEmployee.section,
                                                            unit: selectedEmployee.unit
                                                        })}
                                                        viewBox={`0 0 256 256`}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-2 font-medium tracking-wide">SCAN FOR DETAILS</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
};

export default OnboardingID;
