import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { LayoutGrid, BookOpen, MonitorPlay, Calendar, ArrowRight } from 'lucide-react';
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
import { toggleTheme } from "@/Redux/Slice/ThemeSlice";
import NotificationCenter from "@/components/common/NotificationCenter";
import LanguageSelector from "@/components/common/LanguageSelector";
import { IconSettings, IconLogout, IconMoon, IconSun } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";
import { usePrivileges } from "@/hooks/usePrivileges";

// Accent palettes per portal card — kept out of the shared theme object since
// each card needs its own hue in both light and dark mode.
const ACCENTS = {
    blue: {
        border: 'hover:border-blue-300', borderDark: 'hover:border-blue-800',
        glow: 'rgba(59,130,246,0.18)', wash: 'from-blue-500/5',
        iconBg: 'bg-blue-50', iconBgDark: 'bg-blue-950/50',
        iconFg: 'text-blue-600', iconFgDark: 'text-blue-400',
        link: 'text-blue-500', linkDark: 'text-blue-400',
    },
    green: {
        border: 'hover:border-green-300', borderDark: 'hover:border-green-800',
        glow: 'rgba(34,197,94,0.18)', wash: 'from-green-500/5',
        iconBg: 'bg-green-50', iconBgDark: 'bg-green-950/50',
        iconFg: 'text-green-600', iconFgDark: 'text-green-400',
        link: 'text-green-500', linkDark: 'text-green-400',
    },
    purple: {
        border: 'hover:border-purple-300', borderDark: 'hover:border-purple-800',
        glow: 'rgba(168,85,247,0.18)', wash: 'from-purple-500/5',
        iconBg: 'bg-purple-50', iconBgDark: 'bg-purple-950/50',
        iconFg: 'text-purple-600', iconFgDark: 'text-purple-400',
        link: 'text-purple-500', linkDark: 'text-purple-400',
    },
    amber: {
        border: 'hover:border-amber-300', borderDark: 'hover:border-amber-800',
        glow: 'rgba(244,63,94,0.18)', wash: 'from-amber-500/5 to-rose-500/5',
        iconBg: 'bg-amber-50', iconBgDark: 'bg-amber-950/50',
        iconFg: 'text-amber-600', iconFgDark: 'text-amber-400',
        link: 'text-rose-500', linkDark: 'text-rose-400',
    },
};

const PortalCard = ({ accent, darkMode, icon, title, desc, onClick, ctaLabel }) => {
    const a = ACCENTS[accent];
    const Icon = icon;
    return (
        <Card
            className={`group relative overflow-hidden active:scale-[0.98] sm:hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl ${darkMode ? `border-slate-800 bg-slate-900/60 ${a.borderDark}` : `border-slate-100 bg-white/70 ${a.border}`}`}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 30px ${a.glow}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
            onClick={onClick}
        >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${a.wash} to-transparent transition-opacity duration-300 pointer-events-none`} />
            <CardContent className="relative p-3 sm:p-4 md:p-5 flex flex-col items-center text-center space-y-1.5 sm:space-y-2.5 md:space-y-3 pt-3.5 sm:pt-5 md:pt-6">
                <div className={`w-9 h-9 sm:w-11 sm:h-11 md:w-13 md:h-13 rounded-xl sm:rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shrink-0 ${darkMode ? `${a.iconBgDark} ${a.iconFgDark}` : `${a.iconBg} ${a.iconFg}`}`}>
                    <Icon className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 md:w-6.5 md:h-6.5" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 w-full">
                    <h3 className={`text-xs sm:text-sm md:text-base font-bold truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h3>
                    <p className={`text-[10px] sm:text-xs leading-snug line-clamp-2 px-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {desc}
                    </p>
                </div>
                <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 -translate-x-0 sm:-translate-x-1 sm:group-hover:translate-x-0 transition-all duration-200 pt-0.5 ${darkMode ? a.linkDark : a.link}`}>
                    {ctaLabel} <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
            </CardContent>
        </Card>
    );
};

const LandingPage = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { pathname } = useLocation();
    const { user, isLoading } = useSelector((state) => state.auth);
    const { darkMode } = useSelector((state) => state.theme);
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
    const dailyMeetingTabs = React.useMemo(() => getSidebarTabs("daily-meeting", user, t, hasPrivilege), [user, t, hasPrivilege]);

    const hasDashboardAccess = dashboardTabs.length > 0;
    const hasLMSAccess = lmsTabs.length > 0;
    const hasCMSAccess = cmsTabs.length > 0;
    const hasDailyMeetingAccess = dailyMeetingTabs.length > 0;

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
        if (portalName === 'DAILY_MEETING') {
            const target = dailyMeetingTabs[0]?.link || '/daily-meeting';
            navigate(target);
            return;
        }
    };

    const accessibleCount = [hasDashboardAccess, hasLMSAccess, hasCMSAccess, hasDailyMeetingAccess].filter(Boolean).length;

    const gridColsClass =
        accessibleCount === 1 ? 'grid-cols-1 max-w-xs sm:max-w-sm mx-auto w-full' :
            accessibleCount === 2 ? 'grid-cols-2 max-w-sm sm:max-w-xl lg:max-w-2xl mx-auto w-full' :
                accessibleCount === 3 ? 'grid-cols-1 sm:grid-cols-3 max-w-xs sm:max-w-3xl lg:max-w-4xl mx-auto w-full' :
                    'grid-cols-2 lg:grid-cols-4 max-w-md sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full';

    return (
        <div className={`h-screen max-h-[100dvh] w-full flex flex-col justify-between pt-14 sm:pt-16 pb-2 sm:pb-3 px-3 sm:px-6 overflow-hidden select-none transition-colors duration-300 bg-gradient-to-br ${darkMode ? 'bg-slate-950 from-slate-950 via-indigo-950/30 to-slate-900' : 'bg-slate-50 from-blue-100 via-indigo-50 to-slate-100'}`}>

            {/* Top Header */}
            <header className={`fixed top-0 left-0 right-0 z-50 h-14 sm:h-16 backdrop-blur-lg shadow-sm border-b flex items-center justify-between px-3 sm:px-6 overflow-visible transition-colors duration-300 ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-100'}`}>

                {/* Floating logo circle — desktop only (lg and up) to avoid breaking tablet & mobile viewports */}
                <div className={`hidden lg:flex absolute left-[-24px] xl:left-[-30px] top-0 -translate-y-1/2 w-[180px] xl:w-[210px] h-[160px] xl:h-[190px] rounded-full border shadow-[0_10px_30px_rgba(0,0,0,0.15)] items-end justify-center pb-3 xl:pb-4 z-[60] transition-colors duration-300 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <img
                        src="/fme_transparent.png"
                        alt="FURUKAWA Logo"
                        className="w-28 xl:w-32 h-12 xl:h-14 object-contain"
                    />
                </div>

                {/* Left: brand label & mobile logo */}
                <div className="flex items-center gap-2 sm:gap-2.5 lg:ml-44 xl:ml-52">
                    <img
                        src="/fme_transparent.png"
                        alt="FURUKAWA Logo"
                        className="h-6 sm:h-7 w-auto lg:hidden object-contain"
                    />
                    <div className={`h-4 sm:h-5 w-px lg:hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    <span className={`text-xs sm:text-sm font-bold tracking-[0.1em] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        DOJO 2.0
                    </span>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-0.5 sm:gap-1.5">
                    <LanguageSelector />

                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 sm:h-8.5 sm:w-8.5 cursor-pointer ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                        onClick={() => dispatch(toggleTheme())}
                        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {darkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 sm:h-8.5 sm:w-8.5 cursor-pointer ${darkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
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
                                className={`relative h-8 w-8 sm:h-9 sm:w-9 rounded-full transition-all cursor-pointer p-0 ${darkMode ? 'hover:ring-2 hover:ring-blue-900' : 'hover:ring-2 hover:ring-blue-200'}`}
                            >
                                <Avatar className="h-7.5 w-7.5 sm:h-8 sm:w-8">
                                    <AvatarImage
                                        src={user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || user?.userName || 'U')}&background=2563eb&color=fff`}
                                        alt={user?.fullName || user?.userName}
                                    />
                                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[11px] sm:text-xs">
                                        {avatarInitials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={`absolute bg-green-500 rounded-full bottom-0 right-0 size-2 border-2 animate-pulse ${darkMode ? 'border-slate-900' : 'border-white'}`} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 sm:w-60 p-1.5" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal py-1">
                                <div className="flex flex-col space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                            {user?.fullName || user?.userName || 'User'}
                                        </p>
                                        <Badge variant="secondary" className="text-[9px] sm:text-[10px] capitalize shrink-0 py-0 px-1.5">
                                            {roleLabel}
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email || ''}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-blue-50 text-xs sm:text-sm py-1.5"
                                onClick={() => navigate(settingsPath)}
                            >
                                <IconSettings className="mr-2 h-3.5 w-3.5" />
                                {t('settings.accountSettings')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-red-50 text-red-600 focus:text-red-600 text-xs sm:text-sm py-1.5"
                                onClick={handleLogout}
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? <div className="mr-2 animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-600" />
                                    : <IconLogout className="mr-2 h-3.5 w-3.5" />
                                }
                                {isLoading ? t('auth.signingOut') : t('auth.signOut')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Main Content Area — flex auto center to guarantee full fit without scrolling */}
            <main className="flex-1 min-h-0 flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-2 sm:px-4 py-1 sm:py-2">

                {/* Hero / Header Section */}
                <div className="text-center space-y-1.5 sm:space-y-2 md:space-y-2.5 mb-2.5 sm:mb-4 md:mb-5 animate-fade-in w-full shrink-0">
                    <div className={`w-32 h-14 sm:w-40 sm:h-16 md:w-48 md:h-18 rounded-xl shadow-sm border flex items-center justify-center p-2 sm:p-2.5 mx-auto transition-colors duration-300 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <img
                            src="/fme_transparent.png"
                            alt="FURUKAWA Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <div className="space-y-0.5 sm:space-y-1 px-2">
                        <h1 className={`text-base sm:text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r bg-clip-text text-transparent ${darkMode ? 'from-slate-100 via-blue-400 to-indigo-400' : 'from-slate-800 via-blue-700 to-indigo-700'}`}>
                            {t('landing.title')}
                        </h1>
                        <p className={`text-[9px] sm:text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            DOJO 2.0
                        </p>
                        <p className={`text-[11px] sm:text-xs md:text-sm max-w-md mx-auto px-2 line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {t('landing.subtitle')}
                        </p>
                    </div>
                </div>

                {/* Cards Container */}
                <div className={`grid gap-2.5 sm:gap-3.5 md:gap-4 w-full px-1 sm:px-3 ${gridColsClass}`}>

                    {hasDashboardAccess && (
                        <PortalCard
                            accent="blue"
                            darkMode={darkMode}
                            icon={LayoutGrid}
                            title={t('landing.mpsTitle')}
                            desc={t('landing.mpsDesc')}
                            ctaLabel={t('landing.enterPortal')}
                            onClick={handleDashboardClick}
                        />
                    )}

                    {hasLMSAccess && (
                        <PortalCard
                            accent="green"
                            darkMode={darkMode}
                            icon={BookOpen}
                            title={t('landing.sdpTitle')}
                            desc={t('landing.sdpDesc')}
                            ctaLabel={t('landing.enterPortal')}
                            onClick={() => handlePortalClick('LMS')}
                        />
                    )}

                    {hasCMSAccess && (
                        <PortalCard
                            accent="purple"
                            darkMode={darkMode}
                            icon={MonitorPlay}
                            title={t('landing.cmsTitle')}
                            desc={t('landing.cmsDesc')}
                            ctaLabel={t('landing.enterPortal')}
                            onClick={() => handlePortalClick('CMS')}
                        />
                    )}

                    {hasDailyMeetingAccess && (
                        <PortalCard
                            accent="amber"
                            darkMode={darkMode}
                            icon={Calendar}
                            title={t('landing.dailyMeetingTitle')}
                            desc={t('landing.dailyMeetingDesc')}
                            ctaLabel={t('landing.enterPortal')}
                            onClick={() => handlePortalClick('DAILY_MEETING')}
                        />
                    )}

                </div>
            </main>

            {/* Footer */}
            <footer className="w-full shrink-0 py-1 sm:py-1.5 text-center">
                <p className={`text-[10px] sm:text-[11px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t('landing.copyright')}
                </p>
            </footer>

        </div>
    );
};

export default LandingPage;
