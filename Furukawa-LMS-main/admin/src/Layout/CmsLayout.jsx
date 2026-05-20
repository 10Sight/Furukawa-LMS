import React, { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { logout } from "@/Redux/Slice/AuthSlice";
import { toggleTheme } from "@/Redux/Slice/ThemeSlice";
import {
    IconLayoutDashboardFilled,
    IconLayoutSidebarRightCollapse,
    IconLogout,
    IconUser,
    IconSettings,
    IconDownload,
    IconMoon,
    IconSun,
    IconTable,
} from "@tabler/icons-react";
import { HomeIcon, Command } from "lucide-react";
import NotificationCenter from "../components/common/NotificationCenter";
import LanguageSelector from "../components/common/LanguageSelector";
import { useUpdateAvatarMutation } from "@/Redux/AllApi/UserApi";
import { profile as fetchProfile } from "@/Redux/Slice/AuthSlice";
import useTranslate from "@/hooks/useTranslate";
import { getSidebarTabs, isPathAllowedForUser } from "@/constants/pageRegistry";

// Different tabs for CMS Layout - User can customize these later

export function CmsLayout() {
    const [collapsed, setCollapsed] = useState(
        window.innerWidth >= 820 ? false : true
    );
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [pageName, setPageName] = useState("CMS Dashboard");

    const { t, language } = useTranslate();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user, isLoading } = useSelector((state) => state.auth);
    const { theme, darkMode } = useSelector((state) => state.theme);

    const tabs = useMemo(() => getSidebarTabs("cms", user, t), [user, t]);
    const [updateAvatar] = useUpdateAvatarMutation();
    const avatarFileRef = React.useRef(null);
    const pickAvatar = () => avatarFileRef.current?.click();
    const onAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Please select an image'); e.target.value = ''; return; }
        const form = new FormData(); form.append('avatar', file);
        try { await updateAvatar(form).unwrap(); await dispatch(fetchProfile()).unwrap(); }
        catch (err) { alert(err?.data?.message || 'Failed to update avatar'); }
        finally { e.target.value = ''; }
    };

    const isPathAllowed = useMemo(() => isPathAllowedForUser(pathname, "cms", user), [pathname, user]);

    useEffect(() => {
        if (isLoading) return; // Prevent redirect while loading user data

        if (isPathAllowed) {
            const currentTab = tabs.find(tab =>
                pathname === tab.link ||
                (tab.link !== "/cms" && pathname.startsWith(tab.link))
            );

            if (currentTab) {
                setPageName(currentTab.label);
            } else if (pathname === "/cms") {
                setPageName("CMS Dashboard");
            } else {
                const routeName = pathname.split("/").pop();
                setPageName(routeName.charAt(0).toUpperCase() + routeName.slice(1));
            }
        } else {
            const fallback = tabs[0]?.link;
            const currentPath = pathname.replace(/\/$/, '');
            const normalizedFallback = fallback?.replace(/\/$/, '');

            if (normalizedFallback && currentPath !== normalizedFallback) {
                navigate(fallback, { replace: true });
            } else if (!normalizedFallback) {
                // If no pages are allowed in THIS layout, go back to main landing
                // BUT only if we aren't already coming FROM there to avoid a loop
                if (currentPath !== '') {
                    navigate("/", { replace: true });
                }
            }
        }
    }, [pathname, language, tabs, isPathAllowed, navigate, isLoading]);

    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setCollapsed(true);
            } else if (window.innerWidth >= 1024) {
                setCollapsed(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!isPathAllowed && pathname === "/cms") {
        return <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>;
    }

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            alert("To install the app:\n1. Desktop: Click the install icon in the address bar.\n2. Mobile: Tap 'Share' -> 'Add to Home Screen'.");
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setDeferredPrompt(null);
    };

    const toggleSidebar = () => setCollapsed((prev) => !prev);

    const handleLogout = async () => {
        try {
            await dispatch(logout()).unwrap();
            navigate("/login", { replace: true });
        } catch (error) {
            navigate("/login", { replace: true });
        }
    };

    const ToggleButton = ({ opened, onClick, ariaLabel }) => {
        return (
            <IconLayoutSidebarRightCollapse
                className={`${opened ? "rotate-180" : "mx-auto"
                    } min-w-5 min-h-5 duration-500 transition-all cursor-pointer text-gray-600 hover:text-gray-800`}
                onClick={onClick}
                aria-label={ariaLabel}
            />
        );
    };

    return (
        <div className={`flex min-h-screen ${theme.mainBg}`}>
            {!collapsed && isMobile && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-10 md:hidden animate-in fade-in duration-300"
                    onClick={toggleSidebar}
                />
            )}

            {/* CMS SIDEBAR */}
            <nav
                className={`fixed top-0 left-0 h-screen ${theme.card} backdrop-blur-xl ${theme.border} border-r ${theme.textMain} shadow-2xl transition-all duration-300 z-20
                ${collapsed ? "w-16" : "w-64"} 
                ${isMobile && !collapsed ? 'shadow-3xl border-r-2' : ''}`}
            >
                <div
                    className={`relative h-16 items-center flex transition-all p-4 duration-300 z-50 border-b ${theme.border} ${theme.iconBg}`}
                >
                    <ToggleButton
                        opened={!collapsed}
                        onClick={toggleSidebar}
                        ariaLabel="Toggle sidebar"
                    />
                    {!collapsed && (
                        <span className="ml-4 font-bold text-xl">CMS Panel</span>
                    )}
                </div>

                {/* Back to Menu Link (Fixed at top) */}
                {(user?.isAdmin || user?.role === 'SUPERADMIN' || user?.role === 'CUSTOM') && (
                    <div className="px-3 pt-4 border-b border-gray-100/50 pb-2">
                        <div
                            className={`group relative flex items-center cursor-pointer w-full overflow-hidden h-12 rounded-xl transition-all duration-300 hover:scale-[1.02] text-gray-600 hover:bg-gray-100
                    ${collapsed ? "justify-center mx-1" : "items-center px-4"}`}
                            onClick={() => navigate('/')}
                        >
                            <IconUser className={`${collapsed ? "w-5 h-5" : "min-w-5 min-h-5"}`} />
                            {!collapsed && <span className="ml-3 text-sm font-medium">Back to Main Menu</span>}
                        </div>
                    </div>
                )}

                <div className="px-3 flex flex-col w-full py-6 space-y-1 overflow-y-auto max-h-[calc(100vh-14rem)] scrollbar-thin scrollbar-thumb-gray-300">
                    {tabs.map((item) => {
                        const isActive = pathname === item.link || (item.link !== "/cms" && pathname.startsWith(item.link));
                        return (
                            <div
                                className={`group relative flex items-center cursor-pointer w-full overflow-hidden h-12 rounded-xl transition-all duration-300 hover:scale-[1.02]
                ${isActive
                                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200"
                                        : "text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 hover:shadow-md"
                                    }
                ${collapsed ? "justify-center mx-1" : "items-center px-4"}`}
                                key={item.label}
                                onClick={() => {
                                    navigate(item.link);
                                    if (isMobile) setCollapsed(true);
                                }}
                            >
                                {isActive && !collapsed && (
                                    <div className="absolute left-0 top-0 h-full w-1 bg-white rounded-r-full" />
                                )}
                                <item.icon
                                    className={`${collapsed ? "w-5 h-5" : "min-w-5 min-h-5"
                                        } transition-transform group-hover:scale-110`}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                />
                                {!collapsed && (
                                    <span className="ml-3 text-sm font-medium transition-all group-hover:translate-x-0.5">
                                        {item.label}
                                    </span>
                                )}
                            </div>
                        );
                    })}



                </div>

                <div className="absolute bottom-6 w-full px-3">
                    <div
                        className={`group p-3 flex items-center rounded-xl w-full transition-all duration-300 ${isLoading
                            ? "opacity-50 cursor-not-allowed bg-gray-100"
                            : "hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-600 cursor-pointer hover:shadow-md"
                            } ${collapsed ? "justify-center mx-1" : "px-4"
                            }`}
                        onClick={isLoading ? undefined : handleLogout}
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                        ) : (
                            <IconLogout className="min-w-5 min-h-5 transition-transform group-hover:scale-110" stroke={1.5} />
                        )}
                        {!collapsed && (
                            <span className="ml-3 text-sm font-medium transition-all group-hover:translate-x-0.5">
                                {isLoading ? t("auth.loggingOut") : t("auth.logout")}
                            </span>
                        )}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div
                className={`flex-1 transition-all duration-300 ${collapsed ? "ml-16" : "ml-64"
                    }`}
            >
                <header
                    className={`px-4 sm:px-6 ${theme.card} backdrop-blur-lg shadow-sm border-b ${theme.border} flex h-16 items-center justify-between gap-2 sm:gap-4 fixed right-0 top-0 z-30 transition-all duration-300 ${collapsed ? "w-[calc(100%-4rem)]" : "w-[calc(100%-16rem)]"
                        }`}
                >
                    <div className="flex items-center gap-3">
                        {isMobile && (
                            <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-gray-100 transition-colors md:hidden">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </button>
                        )}
                        <h1 className={`font-semibold ${theme.textMain} text-lg`}>{pageName}</h1>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <LanguageSelector />
                        <Button variant="ghost" size="icon" onClick={() => dispatch(toggleTheme())}>
                            {darkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
                        </Button>
                        <NotificationCenter />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user?.avatar?.url} />
                                        <AvatarFallback>{(user?.fullName || 'U').charAt(0)}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleLogout}>{t("auth.signOut")}</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <div className="pt-20 pb-6 px-2 sm:px-4 min-h-screen">
                    <div className={`${theme.card} backdrop-blur-sm rounded-xl shadow-sm border ${theme.border} p-2 sm:p-4`}>
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    );
}
