import React, { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/common/ui/tabs.jsx";
import { IconFileText, IconFolder, IconLock, IconAlertCircle } from "@tabler/icons-react";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";
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

function SectionTabsView({ departmentId, sections, sectionsLoading }) {
    const authUser = useSelector((state) => state.auth.user);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeSectionId = searchParams.get("section") || "";

    useEffect(() => {
        if (sections.length === 0) return;
        const validIds = sections.map((sec) => String(sec.id || sec._id));
        if (!activeSectionId || !validIds.includes(activeSectionId)) {
            const next = new URLSearchParams(searchParams);
            next.set("section", validIds[0]);
            setSearchParams(next, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sections, activeSectionId]);

    if (sectionsLoading) {
        return <div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
    }

    if (sections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="p-4 bg-white rounded-full shadow-sm mb-3"><IconAlertCircle className="w-8 h-8 text-slate-400" /></div>
                <h4 className="text-sm font-semibold text-slate-700">No Sections Found</h4>
                <p className="text-xs text-slate-500 max-w-xs text-center mt-1">This department has no sections configured yet.</p>
            </div>
        );
    }

    return (
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
                {sections.map((sec) => {
                    const secId = String(sec.id || sec._id);
                    return (
                        <TabsTrigger key={secId} value={secId} title={sec.name} className="text-xs font-semibold px-3 py-1.5 rounded-md text-slate-600 cursor-pointer transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
                            {sec.name}
                        </TabsTrigger>
                    );
                })}
            </TabsList>
            {sections.map((sec) => {
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
    );
}

export default function MonthlyMeetingReport() {
    const authUser = useSelector((state) => state.auth.user);
    const canReadMonthlyReport = hasPermission(authUser, "monthly_report:read");
    const { data: deptsData, isLoading, error } = useGetAllDepartmentsQuery({ limit: 500 }, { skip: !canReadMonthlyReport });
    const departments = useMemo(() => deptsData?.data?.departments || [], [deptsData]);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeDeptId = searchParams.get("dept") || "";

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

    const { data: sectionsData, isLoading: sectionsLoading } = useGetSectionsByDepartmentQuery(activeDeptId, { skip: !activeDeptId });
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
                    <TabsList className="flex flex-col items-stretch gap-1 justify-start bg-slate-100/70 p-1.5 rounded-xl w-full md:w-56 shrink-0 h-auto">
                        {departments.map((d) => {
                            const deptId = String(d.id || d._id);
                            return (
                                <TabsTrigger key={deptId} value={deptId} title={d.name} className="flex-none w-full justify-start text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 whitespace-normal cursor-pointer transition-all hover:bg-white/70 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">
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
                                    <SectionTabsView departmentId={deptId} sections={sections} sectionsLoading={sectionsLoading && activeDeptId === deptId} />
                                </TabsContent>
                            );
                        })}
                    </div>
                </Tabs>
            )}
        </div>
    );
}
