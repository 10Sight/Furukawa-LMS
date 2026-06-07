import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Save, Shield, ChevronRight, Check, Settings, Layout, Key } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { PAGE_REGISTRY, getPagesByLayout } from "@/constants/pageRegistry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const LAYOUTS = ["admin", "trainer", "student", "cms", "dashboard", "custom"];
const LAYOUT_LABELS = {
    admin: "Admin Pages",
    trainer: "Trainer Pages",
    student: "Student Pages",
    cms: "CMS Pages",
    dashboard: "MPS Portal Pages",
    custom: "Custom Portal"
};

const DEFAULT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

// ── Role List Item ─────────────────────────────────────────────────────────
const RoleItem = ({ role, selected, onClick }) => (
    <div
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group
      ${selected
                ? "bg-blue-600 text-white shadow-md"
                : "hover:bg-gray-50 border border-transparent hover:border-gray-200"
            }`}
    >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
        <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${selected ? "text-white" : "text-gray-800"}`}>{role.name}</p>
            <p className={`text-xs truncate ${selected ? "text-blue-100" : "text-gray-500"}`}>
                {(role.allowedPages?.length || 0) === 0 ? "All pages" : `${role.allowedPages.length} pages, ${role.permissions?.length || 0} perms`}
            </p>
        </div>
        {role.isSystemRole && (
            <Badge variant="secondary" className={`text-[10px] ${selected ? "bg-blue-500 text-blue-100" : ""}`}>
                System
            </Badge>
        )}
        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${selected ? "text-blue-200" : "text-gray-400 group-hover:text-gray-600"}`} />
    </div>
);

// ── Page Checkbox ──────────────────────────────────────────────────────────
const PageCheckbox = ({ page, checked, onChange, disabled }) => (
    <label className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
    ${disabled ? "opacity-50 cursor-default" : "hover:bg-blue-50 hover:border-blue-200"}
    ${checked ? "bg-blue-50 border-blue-300" : "bg-white border-gray-200"}`}>
        <input
            type="checkbox"
            className="absolute opacity-0 w-0 h-0"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
        />
        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0 transition-colors
      ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
            {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </div>
        <span className="text-sm text-gray-700 font-medium">{page.label}</span>
    </label>
);

// ── Main Component ─────────────────────────────────────────────────────────
export default function RoleManager() {
    const [roles, setRoles] = useState([]);
    const [systemPermissions, setSystemPermissions] = useState({});
    const [selected, setSelected] = useState(null);
    const [editing, setEditing] = useState({
        name: "",
        description: "",
        color: "#3B82F6",
        allowedPages: [],
        permissions: [],
        generateManagementPage: false,
        targetLayout: "custom"
    });
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("pages"); // "pages" or "functionalities"

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get("/api/roles-permissions");
            setRoles(res.data.data.roles || []);
            setSystemPermissions(res.data.data.permissions || {});
        } catch (e) {
            toast.error("Failed to load roles and permissions");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const selectRole = (role) => {
        setIsNew(false);
        setSelected(role);
        setEditing({
            name: role.name,
            description: role.description || "",
            color: role.color || "#3B82F6",
            allowedPages: [...(role.allowedPages || [])],
            permissions: [...(role.permissions || [])],
            generateManagementPage: !!role.generateManagementPage,
            targetLayout: role.targetLayout || "custom"
        });
    };

    const startNew = () => {
        setIsNew(true);
        setSelected(null);
        setEditing({
            name: "",
            description: "",
            color: "#3B82F6",
            allowedPages: [],
            permissions: [],
            generateManagementPage: false,
            targetLayout: "custom"
        });
    };

    const togglePage = (key) => {
        setEditing(prev => ({
            ...prev,
            allowedPages: prev.allowedPages.includes(key)
                ? prev.allowedPages.filter(k => k !== key)
                : [...prev.allowedPages, key],
        }));
    };

    const togglePermission = (id) => {
        setEditing(prev => ({
            ...prev,
            permissions: prev.permissions.includes(id)
                ? prev.permissions.filter(p => p !== id)
                : [...prev.permissions, id],
        }));
    };

    const handleSave = async () => {
        if (!editing.name.trim()) { toast.error("Role name is required"); return; }
        setSaving(true);
        try {
            if (isNew) {
                await axiosInstance.post("/api/roles-permissions/custom-roles", editing);
                toast.success("Role created!");
            } else {
                await axiosInstance.put(`/api/roles-permissions/custom-roles/${selected.id}`, editing);
                toast.success("Role updated!");
            }
            await fetchData();
            setIsNew(false);
            setSelected(null);
        } catch (e) {
            toast.error(e?.response?.data?.message || "Failed to save role");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selected || selected.isSystemRole) return;
        if (!confirm(`Delete role "${selected.name}"? Users assigned to it will lose their custom access.`)) return;
        try {
            await axiosInstance.delete(`/api/roles-permissions/custom-roles/${selected.id}`);
            toast.success("Role deleted");
            setSelected(null);
            setIsNew(false);
            await fetchData();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Failed to delete role");
        }
    };

    const manageableRoles = roles.filter(r => r.id !== 'ADMIN' && r.id !== 'STUDENT' && r.id !== 'INSTRUCTOR' && r.id !== 'SUPERADMIN');
    const isReadOnly = false; // Allow editing all roles that appear in the manager
    const hasChanges = selected || isNew;

    return (
        <div className="min-h-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-xl">
                    <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">RBAC Role Manager</h1>
                    <p className="text-sm text-gray-500">Define custom roles with granular functionality and page-level access</p>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 items-start">
                {/* Role List */}
                <div className="w-full xl:w-[320px] flex-shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[60vh] xl:h-[calc(100vh-180px)] min-h-[400px]">
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-700 text-sm">Roles ({manageableRoles.length})</h2>
                        <Button size="sm" onClick={startNew} variant="outline" className="h-8 gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
                            <Plus className="w-3.5 h-3.5" /> New Role
                        </Button>
                    </div>

                    <div className="p-3 space-y-1 overflow-y-auto flex-1">
                        {loading && roles.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-400">Loading roles...</div>
                        ) : (
                            manageableRoles.map(role => (
                                <RoleItem
                                    key={role.id}
                                    role={role}
                                    selected={selected?.id === role.id}
                                    onClick={() => selectRole(role)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Role Editor */}
                {hasChanges ? (
                    <div className="w-full xl:flex-1 min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-auto xl:h-[calc(100vh-180px)] min-h-[500px]">
                        {/* Editor Header */}
                        <div className="p-5 border-b border-gray-100 shrink-0">
                            <div className="flex flex-col xl:flex-row items-start justify-between gap-6">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex-shrink-0 border-2 border-white shadow-md"
                                            style={{ backgroundColor: editing.color }}
                                        />
                                        <div className="flex-1">
                                            <Input
                                                placeholder="Role Name"
                                                className="text-lg font-bold border-0 border-b-2 border-gray-200 rounded-none px-0 h-auto py-1 focus:ring-0 focus:border-blue-400"
                                                value={editing.name}
                                                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                                                disabled={isReadOnly}
                                            />
                                            <Input
                                                placeholder="Short description of the role responsibilities..."
                                                className="text-sm text-gray-500 border-0 px-0 h-auto py-1 focus:ring-0"
                                                value={editing.description}
                                                onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
                                                disabled={isReadOnly}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6 pt-2">
                                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                                            <Label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Target Layout</Label>
                                            <select
                                                className="text-xs font-medium border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50 p-1.5"
                                                value={editing.targetLayout}
                                                onChange={e => setEditing(p => ({ ...p, targetLayout: e.target.value }))}
                                                disabled={isReadOnly}
                                            >
                                                <option value="">No Special Layout</option>
                                                {LAYOUTS.map(layout => (
                                                    <option key={layout} value={layout}>{LAYOUT_LABELS[layout]}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="h-10 w-px bg-gray-200" />
                                        <div className="flex-1 space-y-1.5">
                                            <Label className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Role Color</Label>
                                            <div className="flex items-center gap-2">
                                                {DEFAULT_COLORS.map(c => (
                                                    <button
                                                        key={c}
                                                        disabled={isReadOnly}
                                                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${editing.color === c ? "border-gray-800 scale-125 shadow-sm" : "border-transparent"}`}
                                                        style={{ backgroundColor: c }}
                                                        onClick={() => setEditing(p => ({ ...p, color: c }))}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="h-10 w-px bg-gray-200" />
                                        <div className="flex items-center space-x-2">
                                            <Switch
                                                id="management-page"
                                                checked={editing.generateManagementPage}
                                                onCheckedChange={(checked) => setEditing(p => ({ ...p, generateManagementPage: checked }))}
                                                disabled={isReadOnly}
                                            />
                                            <Label htmlFor="management-page" className="text-xs font-medium text-gray-600 cursor-pointer">
                                                Create User Management Page
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-row items-center gap-2 w-full xl:w-auto justify-end">
                                    {!isReadOnly && selected && !isNew && (
                                        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                                        </Button>
                                    )}
                                    {!isReadOnly && (
                                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                                            <Save className="w-4 h-4 mr-1.5" /> {saving ? "Saving..." : isNew ? "Create Role" : "Save Changes"}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 shrink-0 px-5 bg-gray-50/50">
                            <button
                                onClick={() => setActiveTab("pages")}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "pages" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                            >
                                <Layout className="w-4 h-4" /> Page Access
                            </button>
                            <button
                                onClick={() => setActiveTab("functionalities")}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === "functionalities" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                            >
                                <Key className="w-4 h-4" /> Functionality Permissions
                            </button>
                        </div>

                        {/* Editor Content */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {activeTab === "pages" ? (
                                <div className="space-y-8">
                                    {LAYOUTS.map(layout => (
                                        <div key={layout} className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{LAYOUT_LABELS[layout]}</h3>
                                                {!isReadOnly && (
                                                    <button
                                                        className="text-xs text-blue-600 font-medium"
                                                        onClick={() => {
                                                            const keys = getPagesByLayout(layout).map(p => p.key);
                                                            const allChecked = keys.every(k => editing.allowedPages.includes(k));
                                                            setEditing(prev => ({
                                                                ...prev,
                                                                allowedPages: allChecked
                                                                    ? prev.allowedPages.filter(k => !keys.includes(k))
                                                                    : [...new Set([...prev.allowedPages, ...keys])]
                                                            }));
                                                        }}
                                                    >
                                                        Toggle All
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {getPagesByLayout(layout).map(page => (
                                                    <PageCheckbox
                                                        key={page.key}
                                                        page={page}
                                                        checked={editing.allowedPages.includes(page.key)}
                                                        onChange={() => togglePage(page.key)}
                                                        disabled={isReadOnly}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {Object.entries(systemPermissions).map(([category, perms]) => (
                                        <div key={category} className="space-y-4">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{category}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {perms.map(p => (
                                                    <label
                                                        key={p.id}
                                                        className={`relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer group h-full
                                                            ${editing.permissions.includes(p.id) ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100 hover:border-gray-200"}
                                                            ${isReadOnly ? "opacity-75 cursor-default" : ""}
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-sm font-semibold text-gray-800">{p.name}</span>
                                                            <input
                                                                type="checkbox"
                                                                className="absolute opacity-0 w-0 h-0"
                                                                checked={editing.permissions.includes(p.id)}
                                                                onChange={() => togglePermission(p.id)}
                                                                disabled={isReadOnly}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{p.description}</span>
                                                        <code className="text-[10px] mt-2 text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded self-start font-mono">
                                                            {p.id}
                                                        </code>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full xl:flex-1 min-w-0 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center h-[50vh] xl:h-[calc(100vh-180px)] min-h-[500px]">
                        <div className="text-center text-gray-400">
                            <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="font-medium text-gray-600">Select a role to configure</p>
                            <p className="text-sm mt-1">Manage granular permissions and page access</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
