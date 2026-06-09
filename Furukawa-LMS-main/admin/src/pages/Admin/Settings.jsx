import React from "react";
import { useSelector } from "react-redux";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IconUser, IconMail, IconSettings, IconLock } from "@tabler/icons-react";
import StudentProfile from "../Student/Profile";
import EmailConfiguration from "./EmailConfiguration";
import ChangePassword from "./ChangePassword";

export default function AdminSettings() {
    const { user } = useSelector((state) => state.auth);

    const isUnrestricted =
        user?.isAdmin ||
        user?.role === "ADMIN" ||
        user?.role === "SUPERADMIN";

    const permissions = user?.customRole?.permissions || [];

    const canChangePassword =
        isUnrestricted || permissions.includes("settings:change_password");

    const canEmailConfig =
        isUnrestricted || permissions.includes("settings:email_config");

    const visibleTabCount = 1 + (canEmailConfig ? 1 : 0) + (canChangePassword ? 1 : 0);
    const gridCols = visibleTabCount === 1 ? "grid-cols-1" : visibleTabCount === 2 ? "grid-cols-2" : "grid-cols-3";

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <IconSettings className="w-6 h-6 text-gray-700" />
                <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className={`grid w-full ${gridCols} mb-8 max-w-lg`}>
                    <TabsTrigger value="profile" className="gap-2">
                        <IconUser className="w-4 h-4" />
                        My Profile
                    </TabsTrigger>
                    {canEmailConfig && (
                        <TabsTrigger value="email-config" className="gap-2">
                            <IconMail className="w-4 h-4" />
                            Email Configuration
                        </TabsTrigger>
                    )}
                    {canChangePassword && (
                        <TabsTrigger value="change-password" className="gap-2">
                            <IconLock className="w-4 h-4" />
                            Change Password
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                    <StudentProfile />
                </TabsContent>

                {canEmailConfig && (
                    <TabsContent value="email-config" className="space-y-4">
                        <EmailConfiguration />
                    </TabsContent>
                )}

                {canChangePassword && (
                    <TabsContent value="change-password" className="space-y-4">
                        <ChangePassword />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
