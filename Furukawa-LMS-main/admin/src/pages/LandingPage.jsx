import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { LayoutGrid, BookOpen, MonitorPlay, ArrowRight } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSidebarTabs } from "@/constants/pageRegistry";
import { logout } from "@/Redux/Slice/AuthSlice";
import NotificationCenter from "@/components/common/NotificationCenter";
import LanguageSelector from "@/components/common/LanguageSelector";
import { IconSettings, IconLogout, IconUser } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";
import { usePrivileges } from "@/hooks/usePrivileges";

const LandingPage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { pathname } = useLocation();
    const { user, isLoading } = useSelector((state) => state.auth);
    const { t } = useTranslate();
    const { hasPrivilege } = usePrivileges();

    const handleLogout = () => dispatch(logout());

    const settingsPath = (() => {
        if (user?.role === 'SUPERADMIN' || user?.isAdmin) return '/admin/settings';
        if (user?.isTrainer) return '/trainer/settings';
        return '/student/settings';
    })();

    const avatarInitials = (user?.fullName || user?.userName || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const roleLabel =
        user?.role === 'INSTRUCTOR' ? 'Trainer' :
            user?.role === 'STUDENT' ? 'Operator' :
                user?.role?.toLowerCase().replace('_', ' ') || 'Admin';

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

    const accessibleCount = [hasDashboardAccess, hasLMSAccess, hasCMSAccess].filter(Boolean).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-slate-100 flex flex-col items-center justify-start md:justify-center pt-28 pb-12 px-4 sm:px-6">

            {/* Top Header */}
            <header className="fixed top-0 left-0 right-0 z-50 h-20 bg-white shadow-sm border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 overflow-visible">

                {/* Floating logo circle — flush left, bigger than header height */}
                <div className="hidden md:flex absolute left-[-37px] top-0 -translate-y-1/2 w-[264px] h-[244px] rounded-full bg-white border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.18)] items-end justify-center pb-5 z-[60]">
                    <img
                        src="/fme_transparent.png"
                        alt="FURUKAWA Logo"
                        className="w-36 h-20 object-contain"
                    />
                </div>

                {/* Left: brand label — pushed right to clear the circle on desktop */}
                <div className="flex items-center gap-3 md:ml-60">
                    <img
                        src="/fme_transparent.png"
                        alt="FURUKAWA Logo"
                        className="h-9 w-auto md:hidden object-contain"
                    />
                    <div className="h-6 w-px bg-slate-200 md:hidden" />
                    <span className="text-sm font-bold text-slate-600 tracking-[0.1em]">
                        DOJO 2.0
                    </span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 sm:gap-2">
                    <LanguageSelector />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        onClick={() => navigate(settingsPath)}
                        title={t('nav.settings')}
                    >
                        <IconSettings className="h-4 w-4" />
                    </Button>

                    <NotificationCenter />

                    {/* User Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer"
                            >
                                <Avatar className="h-9 w-9">
                                    <AvatarImage
                                        src={user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || user?.userName || 'U')}&background=2563eb&color=fff`}
                                        alt={user?.fullName || user?.userName}
                                    />
                                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm">
                                        {avatarInitials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute bg-green-500 rounded-full bottom-0 right-0 size-2.5 border-2 border-white animate-pulse" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-slate-900">
                                            {user?.fullName || user?.userName || 'User'}
                                        </p>
                                        <Badge variant="secondary" className="text-xs capitalize">
                                            {roleLabel}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500">{user?.email || ''}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-blue-50"
                                onClick={() => navigate(settingsPath)}
                            >
                                <IconSettings className="mr-2 h-4 w-4" />
                                {t('settings.accountSettings')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-red-50 text-red-600 focus:text-red-600"
                                onClick={handleLogout}
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? <div className="mr-2 animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                                    : <IconLogout className="mr-2 h-4 w-4" />
                                }
                                {isLoading ? t('auth.signingOut') : t('auth.signOut')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Header Section */}
            <div className="text-center space-y-5 mb-10 sm:mb-12 animate-fade-in mt-8 md:mt-12">
                <div className="w-56 h-24 sm:w-72 sm:h-28 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center p-4 mx-auto">
                    <img
                        src="/fme_transparent.png"
                        alt="FURUKAWA Logo"
                        className="w-full h-full object-contain"
                    />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-800 via-blue-700 to-indigo-700 bg-clip-text text-transparent">
                        {t('landing.title')}
                    </h1>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
                        DOJO 2.0
                    </p>
                    <p className="text-slate-500 text-xs sm:text-sm pt-1">
                        {t('landing.subtitle')}
                    </p>
                </div>
            </div>

            {/* Cards Container */}
            <div className={`grid gap-6 max-w-5xl w-full px-4 ${accessibleCount === 1
                ? 'grid-cols-1 max-w-sm mx-auto'
                : accessibleCount === 2
                    ? 'grid-cols-1 md:grid-cols-2 max-w-2xl'
                    : 'grid-cols-1 md:grid-cols-3'
                }`}>

                {/* Dashboard Card */}
                {hasDashboardAccess && (
                    <Card
                        className="group hover:border-blue-200 hover:shadow-[0_12px_40px_rgba(59,130,246,0.12)] hover:-translate-y-1 transition-all duration-300 cursor-pointer border-slate-100 bg-white"
                        onClick={handleDashboardClick}
                    >
                        <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4 sm:space-y-6 pt-8 sm:pt-10">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <LayoutGrid className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900">{t('landing.mpsTitle')}</h3>
                                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed px-2">
                                    {t('landing.mpsDesc')}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 text-blue-500 text-xs sm:text-sm font-medium opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200">
                                {t('landing.enterPortal')} <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* LMS Portal Card */}
                {hasLMSAccess && (
                    <Card
                        className="group hover:border-green-200 hover:shadow-[0_12px_40px_rgba(34,197,94,0.12)] hover:-translate-y-1 transition-all duration-300 cursor-pointer border-slate-100 bg-white"
                        onClick={() => handlePortalClick('LMS')}
                    >
                        <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4 sm:space-y-6 pt-8 sm:pt-10">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900">{t('landing.sdpTitle')}</h3>
                                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed px-2">
                                    {t('landing.sdpDesc')}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 text-green-500 text-xs sm:text-sm font-medium opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200">
                                {t('landing.enterPortal')} <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* CMS Portal Card */}
                {hasCMSAccess && (
                    <Card
                        className="group hover:border-purple-200 hover:shadow-[0_12px_40px_rgba(168,85,247,0.12)] hover:-translate-y-1 transition-all duration-300 cursor-pointer border-slate-100 bg-white"
                        onClick={() => handlePortalClick('CMS')}
                    >
                        <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center space-y-4 sm:space-y-6 pt-8 sm:pt-10">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <MonitorPlay className="w-6 h-6 sm:w-8 sm:h-8" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900">{t('landing.cmsTitle')}</h3>
                                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed px-2">
                                    {t('landing.cmsDesc')}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 text-purple-500 text-xs sm:text-sm font-medium opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200">
                                {t('landing.enterPortal')} <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>

            {/* Footer */}
            <div className="mt-16 text-center">
                <p className="text-slate-400 text-xs">
                    {t('landing.copyright')}
                </p>
            </div>

        </div>
    );
};

export default LandingPage;
