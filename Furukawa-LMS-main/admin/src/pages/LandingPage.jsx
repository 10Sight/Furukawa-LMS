import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { LayoutGrid, BookOpen, MonitorPlay, ArrowRight } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { getSidebarTabs } from "@/constants/pageRegistry";
import useTranslate from "@/hooks/useTranslate";
import { usePrivileges } from "@/hooks/usePrivileges";

const LandingPage = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user } = useSelector((state) => state.auth);
    const { t } = useTranslate();
    const { hasPrivilege } = usePrivileges();

    // Pre-calculate allowed tabs for each portal
    const dashboardTabs = React.useMemo(() => getSidebarTabs("dashboard", user, t, hasPrivilege), [user, t, hasPrivilege]);
    const lmsTabs = React.useMemo(() => {
        // LMS logic involves multiple potential layouts (admin, trainer, student)
        // We'll check based on user role/layout
        const layout = user?.customRole?.targetLayout?.toLowerCase() || 
                      (user?.isAdmin ? 'admin' : user?.isTrainer ? 'trainer' : 'student');
        return getSidebarTabs(layout, user, t, hasPrivilege);
    }, [user, t, hasPrivilege]);
    const cmsTabs = React.useMemo(() => getSidebarTabs("cms", user, t, hasPrivilege), [user, t, hasPrivilege]);

    const hasDashboardAccess = dashboardTabs.length > 0;
    const hasLMSAccess = lmsTabs.length > 0;
    const hasCMSAccess = cmsTabs.length > 0;

    React.useEffect(() => {
        if (!user || user.role !== 'CUSTOM') return;

        const allowed = user.customRole?.allowedPages || [];
        const allowedPages = typeof allowed === 'string' ? JSON.parse(allowed) : allowed;
        const hasLandingAccess = allowedPages.includes('landing-page');

        // If landing page is NOT allowed, redirect to workspace
        if (!hasLandingAccess) {
            const layout = user.customRole?.targetLayout?.toLowerCase();
            if (!layout) {
                navigate('/portal', { replace: true });
                return;
            }

            const target = {
                'trainer': '/trainer',
                'instructor': '/trainer',
                'student': '/student',
                'employee': '/student',
                'admin': '/admin',
                'cms': '/cms',
                'dashboard': '/dashboard',
                'custom': '/portal'
            }[layout] || '/portal';

            if (pathname !== target) {
                navigate(target, { replace: true });
            }
        }
    }, [user, navigate, pathname]);

    // Prevent standard roles from seeing landing page if unnecessary
    React.useEffect(() => {
        if (user && !user.isAdmin && user.role !== 'SUPERADMIN' && user.role !== 'CUSTOM') {
            if (user.isTrainer) navigate('/trainer', { replace: true });
            else if (user.isEmployee) navigate('/student', { replace: true });
        }
    }, [user, navigate]);

    // Allow CUSTOM roles to "authorize" for landing page temporarily 
    // This prevents the component from returning null while the redirect effect above is starting.
    const isAuthorizedForLanding = user?.isAdmin || user?.role === 'SUPERADMIN' || user?.role === 'CUSTOM';
    
    if (user && !isAuthorizedForLanding) {
        return null;
    }

    const handleDashboardClick = () => {
        const target = dashboardTabs[0]?.link || '/dashboard';
        navigate(target);
    };

    const handlePortalClick = (portalName) => {
        if (portalName === 'LMS') {
            const layout = user?.customRole?.targetLayout?.toLowerCase() || 
                          (user?.isAdmin ? 'admin' : user?.isTrainer ? 'trainer' : 'student');
            const target = lmsTabs[0]?.link || `/${layout}`;
            navigate(target);
            return;
        }
        if (portalName === 'CMS') {
            const target = cmsTabs[0]?.link || '/cms';
            navigate(target);
            return;
        }
    };

    return (
        <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-4">

            {/* Header Section */}
            <div className="text-center space-y-6 mb-12 animate-fade-in">
                <div className="w-56 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center p-4 mx-auto">
                    <img
                        src="/fme_transparent.png"
                        alt="FURUKAWA Logo"
                        className="w-full h-full object-contain"
                    />
                </div>

                <div className="space-y-2">
                    {/* <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Welcome to Furukawa
                    </h1> */}
                    <p className="text-slate-500 text-lg">
                        Select a portal to continue
                    </p>
                </div>
            </div>

            {/* Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full px-4">

                {/* Dashboard Card */}
                {hasDashboardAccess && (
                    <Card
                        className="group hover:border-blue-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 cursor-pointer border-slate-100 bg-white"
                        onClick={handleDashboardClick}
                    >
                        <CardContent className="p-8 flex flex-col items-center text-center space-y-6 pt-10">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <LayoutGrid className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900">MPS Portal</h3>
                                <p className="text-sm text-slate-500 leading-relaxed px-2">
                                    Manpower Plaining System.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* LMS Portal Card */}
                {hasLMSAccess && (
                    <Card
                        className="group hover:border-green-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 cursor-pointer border-slate-100 bg-white"
                        onClick={() => handlePortalClick('LMS')}
                    >
                        <CardContent className="p-8 flex flex-col items-center text-center space-y-6 pt-10">
                            <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <BookOpen className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900">SDP Portal</h3>
                                <p className="text-sm text-slate-500 leading-relaxed px-2">
                                    Skill Development Program.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* CMS Portal Card */}
                {hasCMSAccess && (
                    <Card
                        className="group hover:border-purple-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 cursor-pointer border-slate-100 bg-white"
                        onClick={() => handlePortalClick('CMS')}
                    >
                        <CardContent className="p-8 flex flex-col items-center text-center space-y-6 pt-10">
                            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <MonitorPlay className="w-8 h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-slate-900">CMS Portal</h3>
                                <p className="text-sm text-slate-500 leading-relaxed px-2">
                                    Check Sheet Management System.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>

            {/* Footer */}
            <div className="mt-16 text-center">
                <p className="text-slate-400 text-xs">
                    © 2024 Furukawa Minda Electric Pvt Ltd. All rights reserved.
                </p>
            </div>

        </div>
    );
};

export default LandingPage;
