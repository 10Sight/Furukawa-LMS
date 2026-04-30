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
import { logout } from "@/Redux/Slice/AuthSlice";
import { toggleTheme } from "@/Redux/Slice/ThemeSlice";
import {
  IconLayoutSidebarRightCollapse,
  IconLogout,
  IconSun,
  IconMoon,
  IconMenu2,
  IconX,
  IconFingerprint,
} from "@tabler/icons-react";
import { HomeIcon } from "lucide-react";
import useTranslate from "@/hooks/useTranslate";
import LanguageSelector from "../components/common/LanguageSelector";
import { getSidebarTabs, isPathAllowedForUser } from "@/constants/pageRegistry";

export function CustomRoleLayout() {
  const [collapsed, setCollapsed] = useState(window.innerWidth < 1024);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pageName, setPageName] = useState("Portal");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { t, language } = useTranslate();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isLoading } = useSelector((state) => state.auth);
  const { theme, darkMode } = useSelector((state) => state.theme);

  const tabs = useMemo(() => getSidebarTabs("custom", user, t), [user, t]);
  const roleColor = user?.customRole?.color || "#7c3aed";

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync page name
  useEffect(() => {
    const currentTab = tabs.find(tab => 
      pathname === tab.link || (tab.link !== "/portal" && pathname.startsWith(tab.link))
    );
    if (currentTab) {
      setPageName(currentTab.label);
    } else if (pathname === "/portal") {
      setPageName(t("nav.dashboard") || "Dashboard");
    } else {
      const parts = pathname.split("/");
      const last = parts[parts.length - 1];
      if (last) setPageName(last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " "));
    }
    if (isMobile) setIsMobileMenuOpen(false);
  }, [pathname, tabs, t, isMobile]);

  // Authorization check
  useEffect(() => {
    // We allow /portal index, or any subpage that is explicitly allowed
    const isAllowed = pathname === "/portal" || isPathAllowedForUser(pathname, "custom", user);
    
    if (isAllowed) {
        // Special case: Redirect from /portal if dashboard key is not allowed
        const isDashboardAllowed = tabs.some(tab => tab.link === "/portal");
        if (pathname === "/portal" && !isDashboardAllowed && tabs.length > 0) {
            navigate(tabs[0].link, { replace: true });
        }
        return;
    }
    
    // If not allowed, redirect to FIRST tab if it's different from current path
    if (tabs.length > 0) {
        const firstTabLink = tabs[0].link;
        if (firstTabLink !== pathname) {
            navigate(firstTabLink, { replace: true });
        }
    } else {
        // Only redirect to / if we aren't already there (though here we are in /portal/*)
        navigate("/", { replace: true });
    }
  }, [pathname, tabs, user, navigate]);

  const toggleSidebar = () => {
    if (isMobile) setIsMobileMenuOpen(!isMobileMenuOpen);
    else setCollapsed(!collapsed);
  };

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate("/login", { replace: true });
    } catch (error) {
      navigate("/login", { replace: true });
    }
  };

  const ToggleButton = ({ opened, onClick }) => {
    const Icon = isMobile ? (isMobileMenuOpen ? IconX : IconMenu2) : IconLayoutSidebarRightCollapse;
    return (
      <Icon
        className={clsx(
          "w-5 h-5 transition-all cursor-pointer text-gray-600 hover:text-gray-900",
          !isMobile && opened && "rotate-180"
        )}
        onClick={onClick}
      />
    );
  };

  return (
    <div className={`flex min-h-screen ${theme.mainBg}`}>
      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <nav
        className={clsx(
          `fixed top-0 left-0 h-screen ${theme.card} border-r ${theme.border} transition-all duration-300 z-50 flex flex-col`,
          isMobile ? (isMobileMenuOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full") : (collapsed ? "w-20" : "w-64")
        )}
      >
        {/* Logo/Header */}
        <div className={`h-16 flex items-center px-4 border-b ${theme.border} shrink-0`}>
          <ToggleButton opened={!collapsed} onClick={toggleSidebar} />
          {(!collapsed || (isMobile && isMobileMenuOpen)) && (
            <div className="ml-3 flex items-center gap-2 overflow-hidden">
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${roleColor}15` }}>
                <IconFingerprint size={20} style={{ color: roleColor }} />
              </div>
              <span className="font-bold text-sm truncate uppercase tracking-tight" style={{ color: roleColor }}>
                {user?.customRole?.name || "Portal"}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
          {tabs.map((tab) => {
            const isActive = pathname === tab.link || (tab.link !== "/portal" && pathname.startsWith(tab.link));
            return (
              <Link
                key={tab.key || tab.link}
                to={tab.link}
                className={clsx(
                  "group relative flex items-center rounded-xl p-3 transition-all duration-200 shrink-0",
                  isActive ? "text-white shadow-lg" : "text-gray-600 hover:bg-gray-100",
                  collapsed && !isMobile ? "justify-center" : "px-4"
                )}
                style={isActive ? { background: `linear-gradient(135deg, ${roleColor}, ${roleColor}dd)` } : {}}
              >
                <tab.icon size={22} className={clsx("shrink-0 transition-transform group-hover:scale-110", isActive && "text-white")} />
                {(!collapsed || isMobile) && (
                  <span className="ml-3 text-sm font-medium truncate">{tab.label}</span>
                )}
                {isActive && (!collapsed || isMobile) && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer/Logout */}
        <div className={`p-4 border-t ${theme.border} shrink-0`}>
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className={clsx(
              "flex items-center w-full p-3 rounded-xl transition-all duration-200 text-gray-500 hover:bg-red-50 hover:text-red-600",
              collapsed && !isMobile ? "justify-center" : "px-4"
            )}
          >
            <IconLogout size={20} className="shrink-0" />
            {(!collapsed || isMobile) && <span className="ml-3 text-sm font-medium">{t("auth.logout") || "Logout"}</span>}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className={clsx("flex-1 flex flex-col min-w-0 transition-all duration-300", !isMobile && (collapsed ? "ml-20" : "ml-64"))}>
        {/* Header */}
        <header className={`h-16 flex items-center justify-between px-6 sticky top-0 z-30 ${theme.card} border-b ${theme.border} backdrop-blur-md bg-white/80`}>
          <div className="flex items-center gap-4">
             {isMobile && <ToggleButton onClick={toggleSidebar} />}
             <Breadcrumb className="hidden sm:block">
               <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link to="/portal" className="text-gray-400 hover:text-gray-600">
                      <HomeIcon size={16} />
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-semibold text-gray-900">{pageName}</BreadcrumbPage>
                  </BreadcrumbItem>
               </BreadcrumbList>
             </Breadcrumb>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => dispatch(toggleTheme())}>
              {darkMode ? <IconSun size={18} /> : <IconMoon size={18} />}
            </Button>
            <LanguageSelector />
            <div className="size-9 rounded-full border-2 border-white shadow-sm overflow-hidden ring-2 ring-gray-100">
               <img 
                 src={user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "User")}&background=f3f4f6&color=333`} 
                 alt="Avatar"
                 className="size-full object-cover"
               />
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
          <div className="w-full">
            {/* Prevent flash of dashboard if root access is not permitted */}
            {pathname === "/portal" && !tabs.some(t => t.link === "/portal") && tabs.length > 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Helper for class names
function clsx(...classes) {
  return classes.filter(Boolean).join(" ");
}
