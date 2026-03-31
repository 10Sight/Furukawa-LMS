import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconUser, IconMail, IconSettings } from "@tabler/icons-react";
import StudentProfile from "../Student/Profile";
import EmailConfiguration from "./EmailConfiguration";

export default function AdminSettings() {
    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <IconSettings className="w-6 h-6 text-gray-700" />
                <h1 className="text-2xl font-bold text-gray-800">System Settings</h1>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8 max-w-md">
                    <TabsTrigger value="profile" className="gap-2">
                        <IconUser className="w-4 h-4" />
                        My Profile
                    </TabsTrigger>
                    <TabsTrigger value="email-config" className="gap-2">
                        <IconMail className="w-4 h-4" />
                        Email Configuration
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                    <StudentProfile />
                </TabsContent>

                <TabsContent value="email-config" className="space-y-4">
                    <EmailConfiguration />
                </TabsContent>
            </Tabs>
        </div>
    );
}
