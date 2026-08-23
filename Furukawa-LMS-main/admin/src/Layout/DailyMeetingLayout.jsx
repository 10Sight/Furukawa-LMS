import React, { Suspense, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/Redux/Slice/AuthSlice";
import { toggleTheme } from "@/Redux/Slice/ThemeSlice";
import { IconArrowLeft, IconLogout, IconMoon, IconSun } from "@tabler/icons-react";
import NotificationCenter from "@/components/common/NotificationCenter";
import LanguageSelector from "@/components/common/LanguageSelector";
import useTranslate from "@/hooks/useTranslate";
import { isPathAllowedForUser } from "@/constants/pageRegistry";

export function DailyMeetingLayout() {
    const { t } = useTranslate();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user, isLoading } = useSelector((state) => state.auth);
    const { theme, darkMode } = useSelector((state) => state.theme);

    const isPathAllowed = useMemo(
        () => isPathAllowedForUser(pathname, "daily-meeting", user),
        [pathname, user]
    );

    useEffect(() => {
        if (isLoading) return;
        if (!isPathAllowed) navigate("/", { replace: true });
    }, [isPathAllowed, isLoading, navigate]);

    const avatarInitials = (user?.fullName || user?.userName || "U")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const handleLogout = async () => {
        try {
            await dispatch(logout()).unwrap();
            navigate("/login", { replace: true });
        } catch (error) {
            navigate("/login", { replace: true });
        }
    };

    if (!isPathAllowed) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${theme.mainBg}`}>
            <header
                className={`sticky top-0 z-30 h-16 ${theme.card} backdrop-blur-lg border-b ${theme.border} shadow-sm flex items-center justify-between px-4 sm:px-6`}
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <img
                        src="/fme_transparent.png"
                        alt="FURUKAWA Logo"
                        className="h-8 w-auto object-contain"
                    />
                    <div className={`h-6 w-px ${theme.border} border-l hidden sm:block`} />
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1.5 ${theme.textSub} hover:${theme.textMain} cursor-pointer`}
                        onClick={() => navigate("/")}
                    >
                        <IconArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("nav.backToMainMenu")}</span>
                    </Button>
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                    <LanguageSelector />

                    <Button variant="ghost" size="icon" onClick={() => dispatch(toggleTheme())}>
                        {darkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
                    </Button>

                    <NotificationCenter />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full cursor-pointer">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage
                                        src={user?.avatar?.url}
                                        alt={user?.fullName || user?.userName}
                                    />
                                    <AvatarFallback className="bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm">
                                        {avatarInitials}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-medium ${theme.textMain}`}>
                                            {user?.fullName || user?.userName || "User"}
                                        </p>
                                        <Badge variant="secondary" className="text-xs capitalize">
                                            {user?.role?.toLowerCase().replace("_", " ") || "User"}
                                        </Badge>
                                    </div>
                                    <p className={`text-xs ${theme.textSub}`}>{user?.email || ""}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer hover:bg-red-50 text-red-600 focus:text-red-600"
                                onClick={handleLogout}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="mr-2 animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                                ) : (
                                    <IconLogout className="mr-2 h-4 w-4" />
                                )}
                                {isLoading ? t("auth.signingOut") : t("auth.signOut")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <main className="p-2 sm:p-4">
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center py-20 min-h-[400px]">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    }
                >
                    <Outlet />
                </Suspense>
            </main>
        </div>
    );
}
