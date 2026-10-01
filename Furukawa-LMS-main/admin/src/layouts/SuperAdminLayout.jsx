import React, { useState, useEffect, Suspense } from "react";
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
import { logout } from "@/Redux/Slice/AuthSlice";
import { toggleTheme } from "@/Redux/Slice/ThemeSlice";
import {
  IconLayoutDashboardFilled,
  IconLayoutSidebarRightCollapse,
  IconLogout,
  IconMail,
  IconArticle,
  IconClipboardList,
  IconShoppingCart,
  IconTarget,
  IconCertificate,
  IconFolder,
  IconUsers,
  IconChartPie,
  IconUser,
  IconSettings,
  IconDatabase,
  IconShield,
  IconReport,
  IconTrash,
  IconFileAnalytics,
  IconServerBolt,
  IconBulb,
  IconDownload,
  IconClock,
  IconLayersIntersect,
  IconUserPlus,
  IconSun,
  IconMoon,
  IconFileText,
} from "@tabler/icons-react";
import { HomeIcon } from "lucide-react";
import useTranslate from "@/hooks/useTranslate";
import LanguageSelector from "../components/common/LanguageSelector";

const tabs = [
  {
    category: "Overview",
    items: [
      { link: "/superadmin", labelKey: "nav.dashboard", icon: IconLayoutDashboardFilled },
    ]
  },
  {
    category: "User Management",
    items: [
      { link: "/superadmin/all-users", labelKey: "nav.allUsers", icon: IconUsers },
      { link: "/superadmin/add-admin", label: "Create Admin", icon: IconUserPlus },
      { link: "/superadmin/trainers", labelKey: "nav.instructors", icon: IconUser },
      { link: "/superadmin/employees", labelKey: "nav.students", icon: IconUsers },
      { link: "/superadmin/soft-deleted-users", labelKey: "nav.deletedUsers", icon: IconTrash },
      { link: "/superadmin/roles-permissions", labelKey: "nav.rolesPermissions", icon: IconShield },
    ]
  },
  {
    category: "Content Management",
    items: [
      { link: "/superadmin/courses", labelKey: "nav.courses", icon: IconCertificate },
      { link: "/superadmin/departments", labelKey: "nav.departments", icon: IconFolder },
      { link: "/superadmin/course-level-settings", labelKey: "nav.courseLevelSettings", icon: IconLayersIntersect },
      { link: "/superadmin/student-levels", labelKey: "nav.studentLevels", icon: IconSettings },
      { link: "/superadmin/certificates", labelKey: "nav.certificates", icon: IconCertificate },
      { link: "/superadmin/test-paper", labelKey: "nav.testPaper", icon: IconFileText },
    ]
  },
  {
    category: "System Management",
    items: [
      { link: "/superadmin/audit-logs", labelKey: "nav.auditLogs", icon: IconFileAnalytics },
      { link: "/superadmin/system-settings", labelKey: "nav.systemSettings", icon: IconSettings },
      { link: "/superadmin/analytics-reports", labelKey: "nav.analyticsReports", icon: IconReport },
      { link: "/superadmin/system-monitoring", labelKey: "nav.systemHealth", icon: IconServerBolt },
    ]
  },
  {
    category: "Advanced Operations",
    items: [
      { link: "/superadmin/data-management", labelKey: "nav.dataManagement", icon: IconDatabase },
      { link: "/superadmin/bulk-operations", labelKey: "nav.bulkOperations", icon: IconBulb },
    ]
  },
];

export function SuperAdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    // SuperAdmin layout also uses 'admin' logic for path allowed checks
    if (!user || isPathAllowedForUser(pathname, "admin", user)) return;
    navigate("/admin", { replace: true });
  }, [pathname, user, navigate]);

  const [collapsed, setCollapsed] = useState(
    window.innerWidth >= 820 ? false : true
  );
  const [pageName, setPageName] = useState("Dashboard");

  const { t, language } = useTranslate();

  const translatedTabs = tabs.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      label: item.labelKey ? t(item.labelKey) : item.label,
    })),
  }));

  const { theme, darkMode } = useSelector((state) => state.theme);

  // Update page name based on current route
  useEffect(() => {
    let foundTab = null;

    // Search through all categories and items
    for (const category of translatedTabs) {
      foundTab = category.items.find(tab =>
        pathname === tab.link ||
        (tab.link !== "/superadmin" && pathname.startsWith(tab.link))
      );
      if (foundTab) break;
    }

    if (foundTab) {
      setPageName(foundTab.label);
    } else if (pathname === "/superadmin") {
      setPageName(t("nav.dashboard"));
    } else {
      // For nested routes, extract from pathname
      const routeName = pathname.split("/").pop();
      setPageName(routeName.charAt(0).toUpperCase() + routeName.slice(1).replace("-", " "));
    }
  }, [pathname, language, translatedTabs, t]);

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
      {/* Sidebar */}
      <nav
        className={`fixed top-0 left-0 h-screen ${theme.card} backdrop-blur-xl border-r ${theme.border} ${theme.textMain} shadow-2xl transition-all duration-300 z-20 flex flex-col
                ${collapsed ? "w-16" : "w-64"} `}
      >
        <div
          className={`relative h-16 items-center flex transition-all p-4 duration-300 z-50 border-b ${theme.border} ${theme.iconBg} backdrop-blur-sm`}
        >
          <ToggleButton
            opened={!collapsed}
            onClick={toggleSidebar}
            ariaLabel="Toggle sidebar"
          />
          {!collapsed && (
            <span className="ml-4 py-1 text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {t("header.superAdmin")}
            </span>
          )}
        </div>

        {/* Sidebar Tabs */}
        <div className="px-2 flex-1 py-4 space-y-1 overflow-y-auto min-h-0">
          {translatedTabs.map((category) => (
            <div key={category.category} className="mb-4">
              {!collapsed && (
                <div className="px-2 mb-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {category.category}
                  </h3>
                </div>
              )}
              <div className="space-y-1">
                {category.items.map((item) => {
                  const isActive =
                    pathname === item.link ||
                    (item.link === "/superadmin" && pathname === "/superadmin") ||
                    (item.link !== "/superadmin" && pathname.startsWith(item.link));

                  return (
                    <div
                      className={`group relative flex items-center cursor-pointer w-full overflow-hidden h-10 rounded-xl transition-all duration-300 hover:scale-[1.02] shrink-0
                      ${isActive
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-200"
                          : "text-gray-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 hover:text-purple-700 hover:shadow-md"
                        }
                      ${collapsed ? "justify-center mx-1" : "items-center px-3"}`}
                      key={item.label}
                      onClick={() => navigate(item.link)}
                      title={collapsed ? item.label : ''}
                    >
                      {isActive && !collapsed && (
                        <div className="absolute left-0 top-0 h-full w-1 bg-white rounded-r-full" />
                      )}
                      <item.icon
                        className={`${collapsed ? "w-5 h-5" : "min-w-4 min-h-4"
                          } transition-transform group-hover:scale-110`}
                        strokeWidth={isActive ? 2.5 : 1.5}
                      />
                      {!collapsed && (
                        <span className="ml-3 text-sm font-medium transition-all group-hover:translate-x-0.5">{item.label}</span>
                      )}
                      {!collapsed && (
                        <div className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-purple-200' : 'text-gray-400'
                          }`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Logout */}
        <div className="w-full px-2 pb-4 pt-2 border-t border-gray-100 shrink-0">
          <div
            className={`p-2 flex items-center rounded-lg w-full transition-all duration-200 ${isLoading
              ? "opacity-50 cursor-not-allowed bg-gray-100"
              : "hover:bg-red-50 hover:text-red-600 cursor-pointer"
              } ${collapsed ? "justify-center" : "px-3"
              }`}
            onClick={isLoading ? undefined : handleLogout}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
            ) : (
              <IconLogout className="min-w-5 min-h-5" stroke={1.5} />
            )}
            {!collapsed && (
              <span className="ml-3 text-sm font-medium">
                {isLoading ? t("auth.loggingOut") : t("auth.logout")}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ${collapsed ? "ml-16" : "ml-64"
          }`}
      >
        {/* Header */}
        <header
          className={`px-4 sm:px-6 ${theme.card} backdrop-blur-lg shadow-sm border-b ${theme.border} flex h-16 items-center justify-between gap-2 sm:gap-4 fixed right-0 top-0 z-30 transition-all duration-300 ${collapsed ? "w-[calc(100%-4rem)]" : "w-[calc(100%-16rem)]"
            }`}
        >
          {/* Left side (Breadcrumb) */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <Link
                  to="/superadmin"
                  className="flex items-center text-purple-600 hover:text-purple-800 transition-colors"
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

          {/* Right side (Avatar) */}
          <div className="relative flex items-center gap-3">
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
              onClick={() => dispatch(toggleTheme())}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? (
                <IconSun className="h-4 w-4" />
              ) : (
                <IconMoon className="h-4 w-4" />
              )}
            </Button>

            <LanguageSelector />
            <div className="mr-2 text-right hidden lg:block">
              <p className="text-sm font-medium text-gray-800 truncate max-w-32">
                {user?.fullName || user?.userName || 'Admin User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role?.toLowerCase().replace('_', ' ') || 'Super Admin'}
              </p>
            </div>

            {/* Avatar */}
            <div className="relative">
              <input id="superadmin-avatar-input" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { alert('Please select an image'); e.target.value = ''; return; }
                const form = new FormData(); form.append('avatar', file);
                try {
                  const { useUpdateAvatarMutation } = await import('@/Redux/AllApi/UserApi'); const { profile: fetchProfile } = await import('@/Redux/Slice/AuthSlice');
                  const update = useUpdateAvatarMutation; /* placeholder to satisfy bundler */
                } catch (_) { }
              }} />
              <div className="relative size-9 sm:size-10 group">
                <img
                  src={user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || user?.userName || 'Admin User')}&background=7c3aed&color=fff`}
                  className="rounded-full size-full border-2 border-white shadow-md object-cover transition-transform group-hover:scale-105 ring-2 ring-purple-100 cursor-pointer"
                  alt="User avatar"
                  onClick={() => document.getElementById('superadmin-avatar-input').click()}
                  title="Change profile picture"
                />
                <div className="absolute bg-green-500 rounded-full bottom-0 right-0 size-2.5 sm:size-3 border-2 border-white"></div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="pt-20 pb-6 px-4 sm:px-6 min-h-screen">
          <div className={`${theme.card} backdrop-blur-sm rounded-xl shadow-sm border ${theme.border} p-4 sm:p-6 transition-all duration-300 hover:shadow-md`}>
            <Suspense fallback={
              <div className="flex items-center justify-center py-20 min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}