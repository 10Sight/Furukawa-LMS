import React, { useMemo, useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent
} from "@/components/ui/accordion";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { Switch } from "@/components/ui/switch";
import {
    useCreateClubMutation,
    useGetAllClubsQuery,
    useDeleteClubMutation,
    useUpdateClubMutation
} from '@/Redux/AllApi/ReportClubApi';
import { Loader2, Plus, Trash2, Layers, Eye, EyeOff, Search, X } from 'lucide-react';
import { toast } from 'sonner';

const ReportClubbing = () => {
    const [clubName, setClubName] = useState("");
    const [selectedSections, setSelectedSections] = useState([]);
    const [search, setSearch] = useState("");

    // Queries & Mutations
    const { data: deptsData, isLoading: loadingDepts } = useGetAllDepartmentsQuery();
    const departments = deptsData?.data?.departments || [];
    const allDeptIds = useMemo(() => departments.map(d => d.id).join(','), [departments]);

    const { data: sectionsData, isFetching: loadingSections } = useGetSectionsByDepartmentQuery(allDeptIds, { skip: !allDeptIds });
    const { data: clubsData, isLoading: loadingClubs } = useGetAllClubsQuery();
    const [createClub, { isLoading: isCreating }] = useCreateClubMutation();
    const [deleteClub] = useDeleteClubMutation();
    const [updateClub] = useUpdateClubMutation();

    const allSections = sectionsData?.data || [];
    const clubs = clubsData?.data || [];

    const departmentNameById = useMemo(() => {
        const map = new Map();
        departments.forEach(d => map.set(String(d.id), d.name));
        return map;
    }, [departments]);

    const sectionsByDepartment = useMemo(() => {
        const query = search.trim().toLowerCase();
        const filtered = query
            ? allSections.filter(s => s.name.toLowerCase().includes(query))
            : allSections;
        const grouped = new Map();
        filtered.forEach(sec => {
            const key = String(sec.departmentId);
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(sec);
        });
        return grouped;
    }, [allSections, search]);

    const selectedSectionDetails = useMemo(() => {
        return selectedSections
            .map(id => allSections.find(s => String(s.id) === String(id)))
            .filter(Boolean);
    }, [selectedSections, allSections]);

    const handleSectionToggle = (sectionId) => {
        setSelectedSections(prev =>
            prev.includes(sectionId)
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const handleToggleReportVisibility = async (club) => {
        try {
            await updateClub({
                id: club.id,
                showInReport: !club.showInReport
            }).unwrap();
            toast.success(`${club.name} visibility updated`);
        } catch (error) {
            toast.error("Failed to update visibility");
        }
    };

    const handleCreateClub = async () => {
        if (!clubName.trim()) return toast.error("Please enter a club name");
        if (selectedSections.length === 0) return toast.error("Please select at least one section");

        try {
            await createClub({
                name: clubName,
                sectionIds: selectedSections
            }).unwrap();

            toast.success("Report club created successfully");
            setClubName("");
            setSelectedSections([]);
        } catch (error) {
            toast.error(error?.data?.message || "Failed to create club");
        }
    };

    const handleDeleteClub = async (id) => {
        if (!window.confirm("Are you sure you want to delete this club?")) return;
        try {
            await deleteClub(id).unwrap();
            toast.success("Club deleted");
        } catch (error) {
            toast.error("Failed to delete club");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Report Clubbing</h1>
                <p className="text-slate-500">Group sections from one or more departments into a single reporting unit.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Creation Form */}
                <Card className="lg:col-span-1 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Create New Club</CardTitle>
                        <CardDescription>Pick sections from any department(s) to group.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Club Name</Label>
                            <Input
                                placeholder="e.g. Assembly Group A"
                                value={clubName}
                                onChange={(e) => setClubName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Search Sections</Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search across all departments..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-600">Departments &amp; Sections</Label>
                            <div className="border rounded-xl max-h-[320px] overflow-y-auto bg-slate-50/50">
                                {loadingDepts || loadingSections ? (
                                    <div className="flex items-center justify-center p-6">
                                        <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
                                    </div>
                                ) : departments.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-4">No departments found.</p>
                                ) : (
                                    <Accordion type="multiple" className="px-2">
                                        {departments.map(dept => {
                                            const deptSections = sectionsByDepartment.get(String(dept.id)) || [];
                                            if (search.trim() && deptSections.length === 0) return null;
                                            const selectedInDept = deptSections.filter(s => selectedSections.includes(s.id)).length;
                                            return (
                                                <AccordionItem key={dept.id} value={String(dept.id)}>
                                                    <AccordionTrigger className="text-sm py-3">
                                                        <span className="flex items-center gap-2">
                                                            {dept.name}
                                                            {selectedInDept > 0 && (
                                                                <Badge variant="info">{selectedInDept} selected</Badge>
                                                            )}
                                                        </span>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        {deptSections.length === 0 ? (
                                                            <p className="text-xs text-slate-400 px-1">No sections found.</p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {deptSections.map(sec => (
                                                                    <div
                                                                        key={sec.id}
                                                                        className="flex items-center space-x-3 hover:bg-white p-2 rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                                                                        onClick={() => handleSectionToggle(sec.id)}
                                                                    >
                                                                        <Checkbox
                                                                            id={`sec-${sec.id}`}
                                                                            checked={selectedSections.includes(sec.id)}
                                                                            onCheckedChange={() => handleSectionToggle(sec.id)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="border-slate-300 data-[state=checked]:bg-blue-600"
                                                                        />
                                                                        <div className="grid gap-1.5 leading-none">
                                                                            <label className="text-sm font-semibold leading-none cursor-pointer">
                                                                                {sec.name}
                                                                            </label>
                                                                            <p className="text-xs text-slate-500">
                                                                                {sec.category && sec.category !== 'Not Applicable' ? `${sec.category} • ` : ''}
                                                                                Count: {sec.sectionCount || 0}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </AccordionContent>
                                                </AccordionItem>
                                            );
                                        })}
                                    </Accordion>
                                )}
                            </div>
                        </div>

                        {selectedSectionDetails.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-slate-600">Selected ({selectedSectionDetails.length})</Label>
                                <div className="flex flex-wrap gap-1.5 border rounded-xl p-2 bg-slate-50/50 max-h-[120px] overflow-y-auto">
                                    {selectedSectionDetails.map(sec => (
                                        <span
                                            key={sec.id}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100"
                                        >
                                            {sec.name}
                                            <span className="text-blue-400 font-normal">
                                                ({departmentNameById.get(String(sec.departmentId)) || 'Unknown'})
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleSectionToggle(sec.id)}
                                                className="hover:text-red-600"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-base font-semibold shadow-lg shadow-blue-100"
                            disabled={isCreating || !clubName || selectedSections.length === 0}
                            onClick={handleCreateClub}
                        >
                            {isCreating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            Create Club
                        </Button>
                    </CardContent>
                </Card>

                {/* Existing Clubs List */}
                <Card className="lg:col-span-2 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Existing Clubs</CardTitle>
                        <CardDescription>Currently active section groupings.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingClubs ? (
                            <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
                        ) : clubs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <div className="bg-slate-50 p-6 rounded-full mb-4">
                                    <Layers size={48} className="opacity-20" />
                                </div>
                                <p className="text-lg font-medium text-slate-500">No clubs created yet.</p>
                                <p className="text-sm">Group sections to see them listed here.</p>
                            </div>
                        ) : (
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow>
                                            <TableHead className="font-bold">Club Name</TableHead>
                                            <TableHead className="font-bold">Department(s)</TableHead>
                                            <TableHead className="font-bold">Sections Included</TableHead>
                                            <TableHead className="font-bold text-center">Trainee Count</TableHead>
                                            <TableHead className="font-bold text-center">Report Status</TableHead>
                                            <TableHead className="w-[80px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clubs.map((club) => (
                                            <TableRow key={club.id} className="hover:bg-slate-50/30 transition-colors">
                                                <TableCell className="font-bold text-slate-800">{club.name}</TableCell>
                                                <TableCell className="text-slate-600">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(club.departmentName || 'N/A').split(', ').map((deptName, i) => (
                                                            <Badge key={i} variant="secondary">{deptName}</Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {club.sections?.map(s => (
                                                            <span key={s.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 shadow-sm">
                                                                {s.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-black text-blue-600 text-lg">
                                                    {club.totalSectionCount}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Switch
                                                            checked={club.showInReport}
                                                            onCheckedChange={() => handleToggleReportVisibility(club)}
                                                        />
                                                        {club.showInReport ? (
                                                            <Eye size={16} className="text-green-600" />
                                                        ) : (
                                                            <EyeOff size={16} className="text-slate-400" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        onClick={() => handleDeleteClub(club.id)}
                                                    >
                                                        <Trash2 size={18} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ReportClubbing;
