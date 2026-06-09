import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLock, IconEye, IconEyeOff } from "@tabler/icons-react";
import { useChangePasswordMutation } from "@/Redux/AllApi/UserApi";

export default function ChangePassword() {
    const [form, setForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState("");

    const [changePassword, { isLoading }] = useChangePasswordMutation();

    const handleChange = (e) => {
        setError("");
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
            setError("All fields are required.");
            return;
        }
        if (form.newPassword.length < 6) {
            setError("New password must be at least 6 characters.");
            return;
        }
        if (form.newPassword !== form.confirmPassword) {
            setError("New password and confirm password do not match.");
            return;
        }

        try {
            await changePassword({
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
                confirmPassword: form.confirmPassword,
            }).unwrap();

            setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            alert("Password changed successfully! Please log in again.");
        } catch (err) {
            setError(err?.data?.message || "Failed to change password. Please try again.");
        }
    };

    return (
        <Card className="max-w-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <IconLock className="w-5 h-5 text-gray-600" />
                    Change Password
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <PasswordField
                        label="Current Password"
                        name="currentPassword"
                        value={form.currentPassword}
                        show={showCurrent}
                        onToggle={() => setShowCurrent((v) => !v)}
                        onChange={handleChange}
                    />
                    <PasswordField
                        label="New Password"
                        name="newPassword"
                        value={form.newPassword}
                        show={showNew}
                        onToggle={() => setShowNew((v) => !v)}
                        onChange={handleChange}
                    />
                    <PasswordField
                        label="Confirm New Password"
                        name="confirmPassword"
                        value={form.confirmPassword}
                        show={showConfirm}
                        onToggle={() => setShowConfirm((v) => !v)}
                        onChange={handleChange}
                    />

                    {error && (
                        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
                    >
                        {isLoading ? "Saving..." : "Save Password"}
                    </button>
                </form>
            </CardContent>
        </Card>
    );
}

function PasswordField({ label, name, value, show, onToggle, onChange }) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={name} className="block text-sm font-medium text-gray-700">
                {label}
            </label>
            <div className="relative">
                <input
                    id={name}
                    name={name}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    autoComplete="off"
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Enter ${label.toLowerCase()}`}
                />
                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                >
                    {show ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
