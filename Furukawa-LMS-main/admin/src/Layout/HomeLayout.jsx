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
import { Separator } from "@/components/ui/separator";
import { logout } from "@/Redux/Slice/AuthSlice";
import {
  IconLayoutDashboardFilled,
  IconLayoutSidebarRightCollapse,
  IconLogout,
  IconCertificate,
  IconFolder,
  IconUsers,
  IconChartPie,
  IconUser,
  IconSettings,
  IconTemplate,
  IconClock,
  IconBell,
  IconLayersIntersect,
  IconMenu2,
  IconX,
  IconChevronRight,
  IconSearch,
  IconStars,
  IconClipboardList,
  IconDownload,
  IconRepeat,
  IconReportAnalytics,
} from "@tabler/icons-react";
import { HomeIcon, Command } from "lucide-react";
import NotificationCenter from "../components/common/NotificationCenter";
import LanguageSelector from "../components/common/LanguageSelector";
import { useUpdateAvatarMutation } from "@/Redux/AllApi/UserApi";
import { profile as fetchProfile } from "@/Redux/Slice/AuthSlice";
import axiosInstance from "@/Helper/axiosInstance";
import useTranslate from "@/hooks/useTranslate";
import { usePrivileges } from "@/hooks/usePrivileges";
import { getSidebarTabs, isPathAllowedForUser } from "@/constants/pageRegistry";


export function HomeLayout() {
  const [collapsed, setCollapsed] = useState(
    window.innerWidth >= 820 ? false : true,
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [pageName, setPageName] = useState("Dashboard");

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isLoading } = useSelector((state) => state.auth);

  const { t, language } = useTranslate();
  const { hasPrivilege } = usePrivileges();
  const [customRoleTabs, setCustomRoleTabs] = useState([]);

  useEffect(() => {
    const fetchCustomRoles = async () => {
      try {
        const res = await axiosInstance.get("/api/roles-permissions");
        const dynamicTabs = res.data.data.roles
          .filter(r => r.generateManagementPage)
          .map(r => ({
            link: `/admin/manage-role/${r.id}`,
            label: `Manage ${r.name}`,
            icon: IconUsers,
            key: `manage-role-${r.id}` // Add a stable key for filtering
          }));
        setCustomRoleTabs(dynamicTabs);
      } catch (e) {
        console.error("Failed to fetch custom roles for navigation", e);
      }
    };
    const allowed = user?.customRole?.allowedPages;
    const allowedPages = typeof allowed === 'string' ? JSON.parse(allowed || '[]') : (allowed || []);
    const isAuthorizedAdmin = user?.role === 'SUPERADMIN' || user?.isAdmin || (user?.role === 'CUSTOM' && allowedPages.includes('role-manager'));
    if (isAuthorizedAdmin) fetchCustomRoles();
  }, [user]);

  const tabs = useMemo(() => {
    const registryTabs = getSidebarTabs("admin", user, t, hasPrivilege);
    // Combine registry tabs with dynamic management pages
    return [...registryTabs, ...customRoleTabs];
  }, [user, t, hasPrivilege, customRoleTabs]);
  const { theme, darkMode } = useSelector((state) => state.theme);
  const [updateAvatar] = useUpdateAvatarMutation();
  const avatarFileRef = React.useRef(null);
  const pickAvatar = () => avatarFileRef.current?.click();
  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image");
      e.target.value = "";
      return;
    }
    const form = new FormData();
    form.append("avatar", file);
    try {
      await updateAvatar(form).unwrap();
      await dispatch(fetchProfile()).unwrap();
    } catch (err) {
      alert(err?.data?.message || "Failed to update avatar");
    } finally {
      e.target.value = "";
    }
  };

  // Update page name based on current route and language
  useEffect(() => {
    const currentTab = tabs.find(
      (tab) =>
        pathname === tab.link ||
        (tab.link !== "/admin" && (pathname === tab.link || pathname.startsWith(tab.link + "/"))),
    );

    if (currentTab) {
      setPageName(currentTab.label);
    } else if (pathname === "/admin") {
      setPageName(t("nav.dashboard"));
    } else {
      // For nested routes, you might want to extract from pathname
      const routeName = pathname.split("/").pop();
      setPageName(routeName.charAt(0).toUpperCase() + routeName.slice(1));
    }
  }, [pathname, language, tabs, t]);

  const isPathAllowed = useMemo(() => isPathAllowedForUser(pathname, "admin", user), [pathname, user]);

  useEffect(() => {
    if (isPathAllowed) {
      // Special case: If we are at the layout root but don't have dashboard permission, 
      // treat it as an unauthorized path for the sake of landing page selection.
      const isDashboardAllowed = tabs.some(tab => tab.link === "/admin");
      if (pathname === "/admin" && !isDashboardAllowed && tabs.length > 0) {
        navigate(tabs[0].link, { replace: true });
      }
      return;
    }

    const fallback = tabs[0]?.link;
    const currentPath = pathname.replace(/\/$/, '');
    const normalizedFallback = fallback?.replace(/\/$/, '');

    if (normalizedFallback && currentPath !== normalizedFallback) {
      navigate(fallback, { replace: true });
    } else if (!normalizedFallback) {
      // If no allowed pages found in this layout, go back to landing
      // BUT only if we aren't already coming FROM there to avoid a loop
      if (currentPath !== '') {
        navigate("/", { replace: true });
      }
    }
  }, [isPathAllowed, pathname, tabs, navigate]);

  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Auto-collapse on mobile, auto-expand on desktop
      if (mobile) {
        setCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setCollapsed(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isPathAllowed && pathname === "/admin") {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert(
        "To install the app:\n1. Desktop: Click the install icon in the address bar (if available) or look in the browser menu.\n2. Mobile: Tap 'Share' -> 'Add to Home Screen'.\n\n(Note: This functionality requires PWA configuration which might not be fully active in development mode)",
      );
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
  };

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate("/login", { replace: true });
    } catch (error) {
      // Even if logout fails, redirect to login (toast handled by Redux)
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
      {/* Mobile overlay */}
      {!collapsed && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-10 md:hidden animate-in fade-in duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed top-0 left-0 h-screen ${theme.card} backdrop-blur-xl ${theme.border} border-r ${theme.textMain} shadow-2xl transition-all duration-300 z-20 flex flex-col
                ${collapsed ? "w-16" : "w-64"} 
                ${isMobile && !collapsed ? "shadow-3xl border-r-2" : ""}`}
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
            <img
              src="/fme_transparent.png"
              alt="Marelli Motherson"
              className="ml-4 h-8 w-auto object-contain"
            />
          )}
        </div>

        {/* Back to Menu Link (Fixed at top) */}
        {(user?.isAdmin || user?.role === 'SUPERADMIN' || user?.role === 'CUSTOM') && (
          <div className="px-3 pt-4 border-b border-gray-100/50 pb-2">
            <div
              className={`group relative flex items-center cursor-pointer w-full overflow-hidden h-12 rounded-xl transition-all duration-300 hover:scale-[1.02] text-gray-600 hover:bg-gray-100
                          ${collapsed ? "justify-center mx-1" : "items-center px-4"}`}
              onClick={() => navigate("/")}
            >
              <IconUser
                className={`${collapsed ? "w-5 h-5" : "min-w-5 min-h-5"}`}
              />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium">{t("nav.backToMainMenu")}</span>
              )}
            </div>
          </div>
        )}

        {/* Sidebar Tabs */}
        <div className="px-3 flex-1 py-6 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 min-h-0">
          {tabs.map((item) => {
            const isActive =
              pathname === item.link ||
              (item.link === "/admin" && pathname === "/admin") ||
              (item.link !== "/admin" && (pathname === item.link || pathname.startsWith(item.link + "/")));

            return (
              <div
                className={`group relative flex items-center cursor-pointer w-full overflow-hidden h-12 rounded-xl transition-all duration-300 hover:scale-[1.02] shrink-0
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
                {!collapsed && (
                  <div
                    className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? "text-blue-200" : "text-gray-400"
                      }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}

        </div>

        {/* Logout */}
        <div className="w-full px-3 pb-6 pt-2 border-t border-gray-100 shrink-0">
          <div
            className={`group p-3 flex items-center rounded-xl w-full transition-all duration-300 ${isLoading
              ? "opacity-50 cursor-not-allowed bg-gray-100"
              : "hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-600 cursor-pointer hover:shadow-md"
              } ${collapsed ? "justify-center mx-1" : "px-4"}`}
            onClick={isLoading ? undefined : handleLogout}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
            ) : (
              <IconLogout
                className="min-w-5 min-h-5 transition-transform group-hover:scale-110"
                stroke={1.5}
              />
            )}
            {!collapsed && (
              <span className="ml-3 text-sm font-medium transition-all group-hover:translate-x-0.5">
                {isLoading ? t("auth.loggingOut") : t("auth.logout")}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ${collapsed ? "ml-16" : "ml-64"
          } ${["/admin/skill-matrix", "/admin/multi-skilling", "/admin/departments"].some(p => pathname.startsWith(p)) ? "min-w-0" : ""}`}
      >
        {/* Header */}
        <header
          className={`px-4 sm:px-6 ${theme.card} backdrop-blur-lg shadow-sm border-b ${theme.border} flex h-16 items-center justify-between gap-2 sm:gap-4 fixed right-0 top-0 z-30 transition-all duration-300 ${collapsed ? "w-[calc(100%-4rem)]" : "w-[calc(100%-16rem)]"
            }`}
        >
          {/* Mobile menu button */}
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors md:hidden"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            )}

            {/* Breadcrumb */}
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <Link
                    to="/admin"
                    className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <HomeIcon size={18} aria-hidden="true" />
                    <span className="sr-only">Home</span>
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className={`${theme.textMain} font-medium`}>
                    {pageName}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            {/* Mobile page title */}
            <h1 className={`font-semibold ${theme.textMain} text-lg sm:hidden`}>
              {pageName}
            </h1>
          </div>

          {/* Right side (Search, Notifications & Avatar) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Selector */}
            <LanguageSelector />

            {/* Install App Button - Desktop & Mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:flex hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
              onClick={handleInstallClick}
              title="Install App"
            >
              <IconDownload className="h-4 w-4" />
            </Button>

            {/* Settings Button */}
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
              onClick={() => navigate("/admin/settings")}
              title="Account Settings"
            >
              <IconSettings className="h-4 w-4" />
            </Button>

            <NotificationCenter />

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-blue-200 transition-all"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={
                        user?.avatar?.url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || user?.userName || "Admin User")}&background=2563eb&color=fff`
                      }
                      alt={user?.fullName || user?.userName || "Admin User"}
                    />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                      {(user?.fullName || user?.userName || "AU")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bg-green-500 rounded-full bottom-0 right-0 size-2.5 border-2 border-white animate-pulse"></div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onAvatarChange}
                />
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.fullName || user?.userName || "Admin User"}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {(user?.role === "INSTRUCTOR"
                          ? "Trainer"
                          : user?.role === "STUDENT"
                            ? "Operator"
                            : user?.role?.toLowerCase().replace("_", " ")) ||
                          "Admin"}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {user?.email || "admin@sarvagaya.edu"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-blue-50"
                  onClick={pickAvatar}
                >
                  <IconUser className="mr-2 h-4 w-4" />
                  {t("profile.changeProfilePicture")}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer hover:bg-blue-50">
                  <IconSettings className="mr-2 h-4 w-4" />
                  {t("settings.accountSettings")}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer hover:bg-blue-50">
                  <IconSettings className="mr-2 h-4 w-4" />
                  {t("settings.accountSettings")}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer hover:bg-blue-50">
                  <Command className="mr-2 h-4 w-4" />
                  {t("ui.keyboardShortcuts")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer hover:bg-red-50 text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="mr-2 animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  ) : (
                    <IconLogout className="mr-2 h-4 w-4" />
                  )}
                  {isLoading ? t("auth.signingOut") : t("auth.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="pt-20 pb-6 px-4 sm:px-6 min-h-screen">
          <div
            className={`${theme.card} backdrop-blur-sm rounded-xl shadow-sm border ${theme.border} p-4 sm:p-6 transition-all duration-300 hover:shadow-md`}
          >
            {/* Prevent flash of dashboard if root access is not permitted */}
            {pathname === "/admin" && !tabs.some(t => t.link === "/admin") && tabs.length > 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
