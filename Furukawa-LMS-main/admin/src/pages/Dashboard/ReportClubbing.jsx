import React, { useState } from 'react';
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription 
} from "@/components/ui/card";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { Loader2, Plus, Trash2, Layers, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const ReportClubbing = () => {
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [clubName, setClubName] = useState("");
    const [selectedSections, setSelectedSections] = useState([]);

    // Queries & Mutations
    const { data: deptsData, isLoading: loadingDepts } = useGetAllDepartmentsQuery();
    const { data: sectionsData, isFetching: loadingSections } = useGetSectionsByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
    const { data: clubsData, isLoading: loadingClubs } = useGetAllClubsQuery();
    const [createClub, { isLoading: isCreating }] = useCreateClubMutation();
    const [deleteClub] = useDeleteClubMutation();
    const [updateClub] = useUpdateClubMutation();

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const clubs = clubsData?.data || [];

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

    const handleSectionToggle = (sectionId) => {
        setSelectedSections(prev => 
            prev.includes(sectionId) 
                ? prev.filter(id => id !== sectionId)
                : [...prev, sectionId]
        );
    };

    const handleCreateClub = async () => {
        if (!clubName.trim()) return toast.error("Please enter a club name");
        if (!selectedDepartment) return toast.error("Please select a department");
        if (selectedSections.length === 0) return toast.error("Please select at least one section");

        try {
            await createClub({
                name: clubName,
                departmentId: selectedDepartment,
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
                <p className="text-slate-500">Group multiple sections into a single reporting unit.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Creation Form */}
                <Card className="lg:col-span-1 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Create New Club</CardTitle>
                        <CardDescription>Select department and sections to group.</CardDescription>
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
                            <Label>Department</Label>
                            <Select value={selectedDepartment} onValueChange={(val) => {
                                setSelectedDepartment(val);
                                setSelectedSections([]);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedDepartment && (
                            <div className="space-y-4 pt-2">
                                <Label className="text-slate-600">Select Sections</Label>
                                <div className="border rounded-xl p-3 max-h-[300px] overflow-y-auto space-y-3 bg-slate-50/50">
                                    {loadingSections ? (
                                        <div className="flex items-center justify-center p-4">
                                            <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
                                        </div>
                                    ) : sections.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-4">No sections found in this department.</p>
                                    ) : sections.map(sec => (
                                        <div key={sec.id} className="flex items-center space-x-3 hover:bg-white p-2 rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer" onClick={() => handleSectionToggle(sec.id)}>
                                            <Checkbox 
                                                id={`sec-${sec.id}`}
                                                checked={selectedSections.includes(sec.id)}
                                                onCheckedChange={() => handleSectionToggle(sec.id)}
                                                onClick={(e) => e.stopPropagation()} // Prevent double trigger
                                                className="border-slate-300 data-[state=checked]:bg-blue-600"
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <label 
                                                    className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {sec.name}
                                                </label>
                                                <p className="text-xs text-slate-500">
                                                    {sec.category !== 'Not Applicable' ? `${sec.category} • ` : ''}
                                                    Count: {sec.sectionCount || 0}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-base font-semibold shadow-lg shadow-blue-100" 
                            disabled={isCreating || !clubName || !selectedDepartment || selectedSections.length === 0}
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
                                            <TableHead className="font-bold">Department</TableHead>
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
                                                <TableCell className="text-slate-600">{club.departmentName}</TableCell>
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
