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
import { logout, profile as fetchProfile } from "@/Redux/Slice/AuthSlice";
import { toggleTheme } from "@/Redux/Slice/ThemeSlice";
import { useUpdateAvatarMutation } from "@/Redux/AllApi/UserApi";
import {
  IconLayoutDashboardFilled,
  IconLayoutSidebarRightCollapse,
  IconLogout,
  IconFolder,
  IconBooks,
  IconFileText,
  IconAward,
  IconSun,
  IconMoon,
  IconUser,
  IconMenu2,
  IconX,
  IconFileCertificate,
  IconClipboardList,
  IconDownload,
  IconSettings,
  IconMessage,
} from "@tabler/icons-react";
import { HomeIcon, Command } from "lucide-react";
import clsx from "clsx";
import axiosInstance from "@/Helper/axiosInstance";
import useTranslate from "@/hooks/useTranslate";
import LanguageSelector from "../components/common/LanguageSelector";
import { getSidebarTabs, isPathAllowedForUser } from "@/constants/pageRegistry";


export function StudentLayout() {
  const [collapsed, setCollapsed] = useState(true); // Always start collapsed
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pageName, setPageName] = useState("Dashboard");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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

  const { t, language } = useTranslate();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isLoading } = useSelector((state) => state.auth);
  const { theme, darkMode } = useSelector((state) => state.theme);

  const tabs = useMemo(() => getSidebarTabs("student", user, t), [user, t]);

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

  // Update page name based on current route and language
  useEffect(() => {
    let cancelled = false;

    const resolvePageName = async () => {
      try {
        // Special case: reports landing/summary
        if (pathname.startsWith("/student/report")) {
          if (!cancelled) setPageName("Course Report");
          return;
        }

        // If we're on a lesson detail route, fetch the lesson title instead of showing the ID
        const lessonMatch = pathname.match(/^\/student\/lesson\/([^\/?#]+)/);
        if (lessonMatch) {
          const lessonId = lessonMatch[1];
          // Optimistic generic label while fetching
          if (!cancelled) setPageName("Lesson");
          try {
            const res = await axiosInstance.get(`/api/lessons/${lessonId}`);
            const title = res?.data?.data?.title || res?.data?.data?.name;
            if (!cancelled && title) setPageName(title);
          } catch (_) {
            // Fallback to generic label if fetch fails
            if (!cancelled) setPageName("Lesson");
          }
          return;
        }

        // Default behavior: map to known tabs or prettify last segment
        const currentTab = tabs.find(tab =>
          pathname === tab.link ||
          (tab.link !== "/student" && pathname.startsWith(tab.link))
        );

        if (currentTab) {
          if (!cancelled) setPageName(currentTab.label);
        } else if (pathname === "/student") {
          if (!cancelled) setPageName(t("nav.dashboard"));
        } else {
          const routeName = pathname.split("/").pop() || "";
          if (!cancelled) setPageName(routeName.charAt(0).toUpperCase() + routeName.slice(1));
        }
      } catch {
        // Silent: keep whatever pageName was last set
      }
    };

    resolvePageName();

    // Close mobile menu when route changes
    if (isMobile) setIsMobileMenuOpen(false);

    return () => { cancelled = true; };
  }, [pathname, isMobile, language, tabs, t]);

  useEffect(() => {
    const isAllowed = isPathAllowedForUser(pathname, "student", user);
    if (isAllowed) return;

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
  }, [pathname, tabs, user, navigate]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsMobileMenuOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  const handleNavigate = (link) => {
    navigate(link);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate("/login", { replace: true });
    } catch (error) {
      navigate("/login", { replace: true });
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("To install the app:\n1. Desktop: Click the install icon in the address bar (if available) or look in the browser menu.\n2. Mobile: Tap 'Share' -> 'Add to Home Screen'.\n\n(Note: This functionality requires PWA configuration which might not be fully active in development mode)");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };


  const ToggleButton = ({ opened, onClick, ariaLabel }) => {
    if (isMobile) {
      const Icon = isMobileMenuOpen ? IconX : IconMenu2;
      return (
        <Icon
          className="w-6 h-6 transition-all cursor-pointer text-gray-600 hover:text-gray-800 md:hidden"
          onClick={onClick}
          aria-label={ariaLabel}
        />
      );
    }

    return (
      <IconLayoutSidebarRightCollapse
        className={`${opened ? "rotate-180" : "mx-auto"
          } w-5 h-5 transition-all duration-500 cursor-pointer text-gray-600 hover:text-gray-800 hidden md:block`}
        onClick={onClick}
        aria-label={ariaLabel}
      />
    );
  };

  return (
    <div className={`flex min-h-screen ${theme.mainBg}`}>
      {/* Mobile Overlay */}
      {(isMobileMenuOpen || (!collapsed && !isMobile)) && (
        <div
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 animate-in fade-in ${isMobile ? '' : 'md:hidden'
            }`}
          onClick={() => {
            if (isMobile) {
              setIsMobileMenuOpen(false);
            } else {
              toggleSidebar();
            }
          }}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`fixed top-0 left-0 h-screen ${theme.card} backdrop-blur-xl ${theme.textMain} shadow-2xl transition-all duration-300 z-50 border-r ${theme.border} ${isMobile
          ? `${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} w-64`
          : `${collapsed ? 'w-16' : 'w-64'}`
          }`}
      >
        <div className={`relative h-16 items-center flex transition-all px-4 duration-300 border-b ${theme.border} ${theme.iconBg} backdrop-blur-sm`}>
          <ToggleButton
            opened={isMobile ? isMobileMenuOpen : !collapsed}
            onClick={toggleSidebar}
            ariaLabel="Toggle sidebar"
          />
          {((!collapsed && !isMobile) || (isMobile && isMobileMenuOpen)) && (
            <img
              src="/fme_transparent.png"
              alt="Furukawa Minda"
              className="ml-4 h-8 w-auto object-contain"
            />
          )}
        </div>

        {/* Back to Menu Link (Fixed at top) */}
        {(user?.isAdmin || user?.role === 'SUPERADMIN' || user?.role === 'CUSTOM') && (
          <div className="px-2 pt-4 border-b border-gray-100/50 pb-2">
            <button
              onClick={() => handleNavigate("/")}
              className={`group relative flex items-center w-full px-3 py-3 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-[1.02] text-gray-700 hover:bg-gray-100
                          ${(collapsed && !isMobile) ? "justify-center px-2 mx-1" : ""}`}
            >
              <IconUser
                className={`shrink-0 transition-all duration-300 group-hover:scale-110 ${(collapsed && !isMobile) ? "w-6 h-6" : "w-5 h-5"}`}
              />
              {((!collapsed && !isMobile) || isMobile) && (
                <span className="ml-3 truncate transition-all duration-300">{t("nav.backToMainMenu")}</span>
              )}
            </button>
          </div>
        )}

        {/* Sidebar Navigation */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          <div className="space-y-1">
            {tabs.map((item) => {
              const isActive = pathname === item.link ||
                (item.link !== "/student" && pathname.startsWith(item.link));

              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigate(item.link)}
                  className={`group relative flex items-center w-full px-3 py-3 text-sm font-medium rounded-xl transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${isActive
                    ? "bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg shadow-green-200"
                    : "text-gray-700 hover:bg-gradient-to-r hover:from-green-50 hover:to-blue-50 hover:text-green-700 hover:shadow-md active:bg-green-100"
                    } ${(collapsed && !isMobile) ? "justify-center px-2 mx-1" : ""}`}
                >
                  {isActive && ((!collapsed && !isMobile) || isMobile) && (
                    <div className="absolute left-0 top-0 h-full w-1 bg-white rounded-r-full" />
                  )}
                  <item.icon
                    className={`shrink-0 transition-all duration-300 group-hover:scale-110 ${(collapsed && !isMobile) ? "w-6 h-6" : "w-5 h-5"
                      } ${isActive ? "text-white" : "text-gray-500 group-hover:text-green-600"}`}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  {((!collapsed && !isMobile) || (isMobile)) && (
                    <span className="ml-3 truncate transition-all duration-300 group-hover:translate-x-0.5">
                      {item.label}
                    </span>
                  )}
                  {((!collapsed && !isMobile) || (isMobile)) && (
                    <div className={`ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-green-200' : 'text-gray-400'
                      }`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Logout */}
        <div className="border-t border-gray-200 p-2">
          <button
            onClick={isLoading ? undefined : handleLogout}
            disabled={isLoading}
            className={`group flex items-center w-full px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${isLoading
              ? "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400"
              : "text-gray-700 hover:bg-red-50 hover:text-red-600 active:bg-red-100"
              } ${(collapsed && !isMobile) ? "justify-center px-2" : ""}`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent shrink-0"></div>
            ) : (
              <IconLogout className={`shrink-0 transition-colors ${(collapsed && !isMobile) ? "w-6 h-6" : "w-5 h-5"
                } text-gray-500 group-hover:text-red-600`} stroke={1.5} />
            )}
            {((!collapsed && !isMobile) || (isMobile)) && (
              <span className="ml-3 truncate transition-all duration-300">
                {isLoading ? t("auth.signingOut") : t("auth.signOut")}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ${isMobile
          ? "ml-0"
          : collapsed
            ? "ml-16"
            : "ml-64"
          }`}
      >
        {/* Header */}
        <header className={`sticky top-0 z-30 ${theme.card} border-b ${theme.border} shadow-sm`}>
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            {/* Left side - Mobile menu button and Breadcrumb */}
            <div className="flex items-center gap-4">
              {isMobile && (
                <button
                  onClick={toggleSidebar}
                  className="p-2 -ml-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
                  aria-label="Toggle navigation"
                >
                  <IconMenu2 className="w-6 h-6" />
                </button>
              )}

              <Breadcrumb className="hidden sm:block">
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <Link
                      to="/student"
                      className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <HomeIcon size={16} aria-hidden="true" />
                      <span className="sr-only">Home</span>
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className={`${theme.textMain} font-medium text-sm`}>
                      {pageName}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              {/* Mobile page title */}
              <h1 className={`text-lg font-semibold ${theme.textMain} sm:hidden`}>
                {pageName}
              </h1>
            </div>

            {/* Right side - User info and avatar */}
            <div className="flex items-center gap-2 sm:gap-3">
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

              {/* User Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-green-200 transition-all p-0">
                    <Avatar className="h-9 w-9 border-2 border-white shadow-md ring-2 ring-gray-100">
                      <AvatarImage
                        src={user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || user?.userName || 'Student')}&background=2563eb&color=fff`}
                        alt={user?.fullName || user?.userName || 'Student'}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                        {(user?.fullName || user?.userName || 'ST').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bg-green-500 rounded-full bottom-0 right-0 size-2.5 border-2 border-white animate-pulse"></div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
                  <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {user?.fullName || user?.userName || 'Student'}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {user?.role?.toLowerCase().replace('_', ' ') || 'Student'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {user?.email || 'student@sarvagaya.edu'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer hover:bg-blue-50" onClick={pickAvatar}>
                    <IconUser className="mr-2 h-4 w-4" />
                    {t("profile.changeProfilePicture")}
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
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-2.5 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
