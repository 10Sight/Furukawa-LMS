import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/common/ui/card.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/common/ui/tabs.jsx";
import { Switch } from "@/components/forms/primitives/switch.jsx";
import { Checkbox } from "@/components/forms/primitives/checkbox.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/common/ui/popover.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import {
    IconFileText, IconFolder, IconLock, IconAlertCircle, IconSettings,
    IconChevronDown, IconChevronUp, IconLoader2, IconEye
} from "@tabler/icons-react";
import {
    useGetMonthlyReportDepartmentsQuery, useGetMonthlyReportSectionsQuery,
    useGetMonthlyReportConfigQuery, useSaveMonthlyReportConfigMutation
} from "@/services/api/MonthlyMeetingReportApi.js";
import { toast } from "sonner";
import { cn } from "@/utils/classNames.js";
import FoldersAndRecordsPanel from "@/pages/meetings/components/monthly-report/FoldersAndRecordsPanel.jsx";

// Mirrors server/utils/monthlyReportAccess.util.js — kept in sync so the UI
// hides actions the backend would reject anyway (a UX convenience only; the
// server independently re-checks every write).
const isMonthlyReportAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);

const hasPermission = (user, permission) => {
    if (isMonthlyReportAdmin(user)) return true;
    return !!user?.customRole?.permissions?.includes(permission);
};

const isUserAssignedToDeptAndSec = (user, departmentId, sectionId) => {
    if (isMonthlyReportAdmin(user)) return true;

    const userSectionIds = new Set([
        user?.sectionId != null ? String(user.sectionId) : null,
        ...(Array.isArray(user?.sections) ? user.sections.map(String) : [])
    ].filter(Boolean));
    const userDeptIds = new Set([
        user?.departmentId != null ? String(user.departmentId) : null,
        ...(Array.isArray(user?.departments) ? user.departments.map(String) : [])
    ].filter(Boolean));

    return userSectionIds.has(String(sectionId)) && userDeptIds.has(String(departmentId));
};

function AdminConfigPanel({ departmentId, sections, allSectionsLoading }) {
    const { data: configData, isLoading: configLoading } = useGetMonthlyReportConfigQuery(departmentId);
    const [saveConfig, { isLoading: isSaving }] = useSaveMonthlyReportConfigMutation();

    const [shutter, setShutter] = useState(false);
    const [selectedSections, setSelectedSections] = useState([]);
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        if (configData?.data) {
            setShutter(!!configData.data.shutter);
            setSelectedSections((configData.data.sections || []).map(String));
        }
    }, [configData]);

    const handleSave = async () => {
        try {
            await saveConfig({
                departmentId,
                shutter,
                sections: selectedSections
            }).unwrap();
            toast.success("Monthly Meeting Report settings saved successfully!");
        } catch {
            toast.error("Failed to save settings. Please try again.");
        }
    };

    const handleToggleSection = (sectionId, checked) => {
        if (checked) {
            setSelectedSections(prev => [...prev, sectionId]);
        } else {
            setSelectedSections(prev => prev.filter(id => id !== sectionId));
        }
    };

    if (configLoading || allSectionsLoading) {
        return (
            <div className="flex items-center gap-2 text-slate-500 py-6 text-sm">
                <IconLoader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Loading settings...
            </div>
        );
    }

    return (
        <Card className="border-slate-200 shadow-sm bg-slate-50/50 mb-6">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <IconSettings className="w-5 h-5 text-indigo-600" />
                    <CardTitle className="text-base font-semibold">Settings Configuration (Admin)</CardTitle>
                </div>
                <CardDescription>Customize section visibility for other roles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-100">
                    <div className="space-y-0.5">
                        <Label htmlFor={`shutter-${departmentId}`} className="text-sm font-semibold text-slate-900 cursor-pointer">
                            Enable Section Shutter
                        </Label>
                        <p className="text-xs text-slate-500 max-w-md">
                            When enabled, all sections will be shown automatically. If disabled, only chosen sections below will be visible.
                        </p>
                    </div>
                    <Switch
                        id={`shutter-${departmentId}`}
                        checked={shutter}
                        onCheckedChange={(val) => {
                            setShutter(val);
                            if (val) setSelectedSections([]);
                        }}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Allowed Sections</Label>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                disabled={shutter}
                                className="w-full sm:w-80 h-10 justify-between text-left font-normal border-slate-200 hover:bg-slate-50 bg-white"
                            >
                                <span className="truncate text-slate-700">
                                    {shutter
                                        ? "All Sections (Shutter Enabled)"
                                        : selectedSections.length > 0
                                            ? `${selectedSections.length} Section(s) Selected`
                                            : "Select Sections..."}
                                </span>
                                <IconChevronDown className="h-4 w-4 opacity-50 shrink-0" stroke={2.5} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-2 bg-white border border-slate-200 shadow-md rounded-xl z-50" align="start">
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                {sections.length === 0 ? (
                                    <div className="text-xs text-slate-400 p-2 text-center">No sections configured in this department</div>
                                ) : (
                                    sections.map((sec) => {
                                        const secId = String(sec.id || sec._id);
                                        const isChecked = selectedSections.includes(secId);
                                        return (
                                            <div key={secId} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                                <Checkbox
                                                    id={`sec-${departmentId}-${secId}`}
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => handleToggleSection(secId, !!checked)}
                                                />
                                                <label
                                                    htmlFor={`sec-${departmentId}-${secId}`}
                                                    className="text-xs font-medium leading-none cursor-pointer flex-1 truncate text-slate-700 select-none"
                                                >
                                                    {sec.name}
                                                </label>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5"
                    >
                        {isSaving ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null}
                        Save Configuration
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SectionTabsView({ departmentId, sections, allSectionsLoading, isPreview = false }) {
    const authUser = useSelector((state) => state.auth.user);
    const [searchParams, setSearchParams] = useSearchParams();
    const { data: configData, isLoading: configLoading } = useGetMonthlyReportConfigQuery(departmentId);

    const shutter = configData?.data ? !!configData.data.shutter : false;
    const selectedSectionsList = useMemo(() => (configData?.data?.sections || []).map(String), [configData]);

    const visibleSections = useMemo(() => {
        if (allSectionsLoading) return [];
        if (shutter) return sections;
        return sections.filter(sec => {
            const secId = String(sec.id || sec._id);
            return selectedSectionsList.includes(secId);
        });
    }, [sections, shutter, selectedSectionsList, allSectionsLoading]);

    // Active section tab lives in the URL (?section=) so a refresh re-opens the
    // same section instead of falling back to the first tab.
    const activeSectionId = searchParams.get("section") || "";

    useEffect(() => {
        if (visibleSections.length === 0) return;
        const validIds = visibleSections.map((sec) => String(sec.id || sec._id));
        if (!activeSectionId || !validIds.includes(activeSectionId)) {
            const next = new URLSearchParams(searchParams);
            next.set("section", validIds[0]);
            setSearchParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleSections, activeSectionId]);

    if (configLoading || allSectionsLoading) {
        return (
            <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (visibleSections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                    <IconAlertCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">No Sections Active</h4>
                <p className="text-xs text-slate-500 max-w-xs text-center mt-1">
                    {isPreview
                        ? "Enable the shutter or select sections in Settings Configuration to display them."
                        : "Monthly Meeting Report spaces are not currently configured for this department's sections. Please contact an Administrator."}
                </p>
                {/* The settings panel is collapsed unless asked for (?config=1), so offer it here. */}
                {isPreview && searchParams.get("config") !== "1" && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 cursor-pointer flex items-center gap-1.5"
                        onClick={() => {
                            const next = new URLSearchParams(searchParams);
                            next.set("config", "1");
                            setSearchParams(next, { replace: true });
                        }}
                    >
                        <IconSettings className="w-4 h-4" />
                        Open Settings Configuration
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {isPreview && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                    <IconEye className="w-3.5 h-3.5" />
                    Preview (What Custom Roles See)
                </div>
            )}
            <Tabs
                value={activeSectionId}
                onValueChange={(val) => {
                    const next = new URLSearchParams(searchParams);
                    next.set("section", val);
                    setSearchParams(next);
                }}
                className="w-full"
            >
                <TabsList className="flex flex-wrap gap-1.5 justify-start bg-slate-100/80 p-1.5 rounded-lg mb-4 h-auto w-fit">
                    {visibleSections.map((sec) => {
                        const secId = String(sec.id || sec._id);
                        return (
                            <TabsTrigger
                                key={secId}
                                value={secId}
                                title={sec.name}
                                className="text-xs font-semibold px-3 py-1.5 rounded-md text-slate-600 cursor-pointer transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm"
                            >
                                {sec.name}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
                {visibleSections.map((sec) => {
                    const secId = String(sec.id || sec._id);
                    const canCreate = hasPermission(authUser, "monthly_report:create") && isUserAssignedToDeptAndSec(authUser, departmentId, secId);
                    const canDelete = hasPermission(authUser, "monthly_report:delete") && isUserAssignedToDeptAndSec(authUser, departmentId, secId);
                    return (
                        <TabsContent key={secId} value={secId} className="mt-0">
                            <FoldersAndRecordsPanel departmentId={departmentId} sectionId={secId} canCreate={canCreate} canDelete={canDelete} />
                        </TabsContent>
                    );
                })}
            </Tabs>
        </div>
    );
}

export default function MonthlyMeetingReport() {
    const authUser = useSelector((state) => state.auth.user);
    const canReadMonthlyReport = hasPermission(authUser, "monthly_report:read");
    // Every department, whichever the user is assigned to: reading is open to all
    // of them, and what can be changed is decided section by section further down.
    const { data: deptsData, isLoading, error } = useGetMonthlyReportDepartmentsQuery(undefined, { skip: !canReadMonthlyReport, refetchOnMountOrArgChange: true });
    const departments = useMemo(() => deptsData?.data?.departments || [], [deptsData]);

    const isAdmin = useMemo(() => isMonthlyReportAdmin(authUser), [authUser]);

    const [searchParams, setSearchParams] = useSearchParams();

    // Active department tab lives in the URL (?dept=) so a refresh re-opens the same
    // department/section instead of restarting from the first department.
    const activeDeptId = searchParams.get("dept") || "";
    // The admin settings panel is collapsed until an admin asks for it from the
    // header, and kept in the URL (?config=1) like the rest of this page's state,
    // so it is still open after a refresh or a change of department.
    const isAdminConfigOpen = searchParams.get("config") === "1";
    const toggleAdminConfig = () => {
        const next = new URLSearchParams(searchParams);
        if (isAdminConfigOpen) next.delete("config"); else next.set("config", "1");
        setSearchParams(next, { replace: true });
    };

    useEffect(() => {
        if (departments.length === 0) return;
        const validIds = departments.map((d) => String(d.id || d._id));
        if (!activeDeptId || !validIds.includes(activeDeptId)) {
            const next = new URLSearchParams(searchParams);
            next.set("dept", validIds[0]);
            setSearchParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departments, activeDeptId]);

    const { data: sectionsData, isFetching: sectionsLoading } = useGetMonthlyReportSectionsQuery(activeDeptId, {
        skip: !activeDeptId || !canReadMonthlyReport,
        // Sections are added and renamed on another page, which doesn't refresh this list.
        refetchOnMountOrArgChange: true
    });
    const sections = useMemo(() => sectionsData?.data || [], [sectionsData]);

    return (
        <div className="space-y-6 w-full pb-20 p-2 md:p-4 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500 rounded-xl shadow-lg shadow-purple-200">
                        <IconFileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Monthly Meeting Report</h1>
                        <p className="text-sm text-slate-500 font-medium">Browse monthly PowerPoint reviews by department and section</p>
                    </div>
                </div>
                {isAdmin && departments.length > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn("cursor-pointer flex items-center gap-1.5", isAdminConfigOpen && "bg-indigo-50 border-indigo-200 text-indigo-700")}
                        aria-expanded={isAdminConfigOpen}
                        onClick={toggleAdminConfig}
                        title={isAdminConfigOpen ? "Hide the section settings" : "Choose which sections other roles see"}
                    >
                        <IconSettings className="w-4 h-4" />
                        <span>Settings Configuration</span>
                        {isAdminConfigOpen ? <IconChevronUp className="w-4 h-4 opacity-70" /> : <IconChevronDown className="w-4 h-4 opacity-70" />}
                    </Button>
                )}
            </div>

            {!canReadMonthlyReport ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5"><IconLock className="w-12 h-12 text-slate-300" /></div>
                    <h3 className="text-xl font-bold text-slate-700">Access Denied</h3>
                    <p className="text-sm text-slate-500 max-w-sm text-center mt-2 leading-relaxed">You do not have permission to view Monthly Meeting Report. Contact an administrator if you believe this is a mistake.</p>
                </div>
            ) : isLoading ? (
                <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 bg-red-50/50 rounded-3xl border border-red-100 text-red-600">
                    <p className="font-semibold">Failed to load departments</p>
                    <p className="text-sm text-red-500 mt-1">Please try refreshing the page.</p>
                </div>
            ) : departments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5"><IconFolder className="w-12 h-12 text-slate-300" /></div>
                    <h3 className="text-xl font-bold text-slate-700">No Departments Found</h3>
                    <p className="text-sm text-slate-500 max-w-sm text-center mt-2 leading-relaxed">Please create departments first to view tabs.</p>
                </div>
            ) : (
                <Tabs
                    value={activeDeptId}
                    onValueChange={(val) => {
                        const next = new URLSearchParams(searchParams);
                        next.set("dept", val);
                        next.delete("section");
                        setSearchParams(next);
                    }}
                    orientation="vertical"
                    className="w-full flex flex-col md:flex-row items-start gap-4"
                >
                    {/* On a wide screen a column down the left that stays put while the
                        page scrolls, with a scroll of its own for a long list. On a narrow
                        one, where it sits above the sections, a single row to swipe along
                        so it doesn't push them down the page. */}
                    <TabsList className={cn(
                        "flex flex-row md:flex-col items-stretch gap-1 justify-start bg-slate-100/70 p-1.5 rounded-xl w-full md:w-56 shrink-0 h-auto",
                        "overflow-x-auto md:overflow-x-hidden md:overflow-y-auto md:sticky md:top-4 md:max-h-[calc(100vh-2rem)]"
                    )}>
                        {departments.map((d) => {
                            const deptId = String(d.id || d._id);
                            return (
                                <TabsTrigger
                                    key={deptId}
                                    value={deptId}
                                    title={d.name}
                                    className="flex-none w-auto md:w-full justify-start text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 whitespace-nowrap md:whitespace-normal cursor-pointer transition-all hover:bg-white/70 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm"
                                >
                                    {d.name}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    <div className="flex-1 min-w-0 w-full">
                        {departments.map((d) => {
                            const deptId = String(d.id || d._id);
                            return (
                                <TabsContent key={deptId} value={deptId} className="space-y-6 mt-0">
                                    {isAdmin && isAdminConfigOpen && (
                                        <AdminConfigPanel
                                            departmentId={deptId}
                                            sections={sections}
                                            allSectionsLoading={sectionsLoading && activeDeptId === deptId}
                                        />
                                    )}
                                    <SectionTabsView
                                        departmentId={deptId}
                                        sections={sections}
                                        allSectionsLoading={sectionsLoading && activeDeptId === deptId}
                                        isPreview={isAdmin}
                                    />
                                </TabsContent>
                            );
                        })}
                    </div>
                </Tabs>
            )}
        </div>
    );
}
