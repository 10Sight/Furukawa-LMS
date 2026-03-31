import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateUserMutation } from "@/Redux/AllApi/UserApi";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconArrowLeft, IconLoader, IconUserShield } from "@tabler/icons-react";

const CreateAdmin = () => {
    const navigate = useNavigate();
    const [createUser, { isLoading }] = useCreateUserMutation();

    const [formData, setFormData] = useState({
        fullName: "",
        userName: "",
        email: "",
        phoneNumber: "",
        password: "",
        unit: "",
        role: "ADMIN"
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.email || !formData.password || !formData.unit || !formData.userName) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            await createUser(formData).unwrap();
            toast.success("Admin user created successfully");
            navigate("/superadmin/all-users");
        } catch (error) {
            console.error("Failed to create admin:", error);
            toast.error(error?.data?.message || "Failed to create admin user");
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="p-0 hover:bg-transparent h-auto">
                    <IconArrowLeft className="w-6 h-6 text-gray-600" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Create Admin User</h1>
                    <p className="text-gray-500">Add a new administrator to the system</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <IconUserShield className="w-5 h-5 text-purple-600" />
                        Admin Details
                    </CardTitle>
                    <CardDescription>
                        Enter the information for the new admin. They will have administrative privileges.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name *</Label>
                                <Input
                                    id="fullName"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="e.g. John Doe"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="userName">Username *</Label>
                                <Input
                                    id="userName"
                                    name="userName"
                                    value={formData.userName}
                                    onChange={handleChange}
                                    placeholder="e.g. johndoe"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address *</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="e.g. john@example.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phoneNumber">Phone Number</Label>
                                <Input
                                    id="phoneNumber"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    placeholder="e.g. +1234567890"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password *</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="unit">Unit *</Label>
                                <Select value={formData.unit} onValueChange={(val) => handleSelectChange("unit", val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UNIT_1">Unit 1</SelectItem>
                                        <SelectItem value="UNIT_2">Unit 2</SelectItem>
                                        <SelectItem value="UNIT_3">Unit 3</SelectItem>
                                        <SelectItem value="UNIT_4">Unit 4</SelectItem>
                                        <SelectItem value="UNIT_5">Unit 5</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800 flex gap-2 items-start">
                                <IconUserShield className="w-5 h-5 shrink-0" />
                                <div>
                                    <p className="font-semibold">Access Level: Admin</p>
                                    <p>This user will have full administrative access to their assigned unit, including managing courses, instructors, and students, but cannot manage system settings or other admins.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white" disabled={isLoading}>
                                {isLoading && <IconLoader className="w-4 h-4 mr-2 animate-spin" />}
                                Create Admin Account
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default CreateAdmin;
