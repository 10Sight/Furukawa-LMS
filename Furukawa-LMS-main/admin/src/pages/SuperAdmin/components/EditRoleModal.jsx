import React, { useState, useEffect } from 'react';
import {
  IconShield,
  IconX,
  IconCheck,
  IconChevronDown,
  IconKey,
  IconSettings,
  IconLoader,
  IconAlertTriangle,
  IconLock,
  IconPencil,
} from '@tabler/icons-react';
import { toast } from 'react-toastify';
import { useUpdateRoleMutation } from '@/Redux/AllApi/SuperAdminApi';

const ROLE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6B7280',
];

const TARGET_LAYOUTS = [
  { value: 'custom', label: 'Custom Portal (Default)' },
  { value: 'admin', label: 'Admin Portal' },
  { value: 'trainer', label: 'Trainer Portal' },
  { value: 'student', label: 'Student Portal' },
  { value: 'cms', label: 'CMS Portal' },
  { value: 'dashboard', label: 'MPS Portal' },
];

const ColorPicker = ({ selectedColor, onColorChange, disabled }) => (
  <div className="mt-4">
    <label className="block text-sm font-semibold text-gray-700 mb-2">Role Color</label>
    <div className="flex flex-wrap gap-2">
      {ROLE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => !disabled && onColorChange(color)}
          disabled={disabled}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
          style={{
            backgroundColor: color,
            boxShadow: selectedColor === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : 'none',
          }}
        >
          {selectedColor === color && <IconCheck size={14} color="white" />}
        </button>
      ))}
    </div>
  </div>
);

const PermissionCategory = ({ category, permissions, selectedPermissions, onPermissionChange, roleColor, disabled }) => {
  const [expanded, setExpanded] = useState(false);
  const categoryIds = permissions.map(p => (typeof p === 'object' ? p.id : p));
  const selectedInCategory = categoryIds.filter(id => selectedPermissions.includes(id));
  const allSelected = selectedInCategory.length === categoryIds.length;
  const someSelected = selectedInCategory.length > 0 && !allSelected;

  const handleSelectAll = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (allSelected) {
      onPermissionChange(selectedPermissions.filter(p => !categoryIds.includes(p)));
    } else {
      onPermissionChange([...new Set([...selectedPermissions, ...categoryIds])]);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className={`bg-gray-50 px-4 py-3 flex items-center justify-between select-none
          ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={handleSelectAll}
            onClick={e => e.stopPropagation()}
            disabled={disabled}
            className={`w-4 h-4 rounded ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            style={{ accentColor: roleColor }}
          />
          <span className="font-medium text-gray-800">{category}</span>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {selectedInCategory.length}/{categoryIds.length}
          </span>
        </div>
        <IconChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      {expanded && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-gray-100">
          {permissions.map(permission => {
            const permId = typeof permission === 'object' ? permission.id : permission;
            const permName = typeof permission === 'object' ? (permission.name || permId) : permission;
            const permDesc = typeof permission === 'object' ? permission.description : null;
            return (
              <label
                key={permId}
                className={`flex items-start gap-2 group ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedPermissions.includes(permId)}
                  onChange={() => {
                    if (disabled) return;
                    if (selectedPermissions.includes(permId)) {
                      onPermissionChange(selectedPermissions.filter(p => p !== permId));
                    } else {
                      onPermissionChange([...selectedPermissions, permId]);
                    }
                  }}
                  disabled={disabled}
                  className={`mt-0.5 w-4 h-4 rounded ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ accentColor: roleColor }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{permName}</p>
                  {permDesc && <p className="text-xs text-gray-400">{permDesc}</p>}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const EditRoleModal = ({ open, onClose, role, permissions, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
    color: '#3B82F6',
    targetLayout: 'custom',
  });

  const [updateRole, { isLoading }] = useUpdateRoleMutation();

  useEffect(() => {
    if (role && open) {
      const raw = Array.isArray(role.permissions)
        ? role.permissions
        : Object.values(role.permissions || {}).flat();
      const sanitizedPerms = raw.map(p =>
        typeof p === 'object' && p !== null ? (p.id || p) : p
      );
      setFormData({
        name: role.name || '',
        description: role.description || '',
        permissions: sanitizedPerms,
        color: role.color || '#3B82F6',
        targetLayout: role.targetLayout || 'custom',
      });
    }
  }, [role, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Role name is required'); return; }
    if (formData.permissions.length === 0) { toast.error('Select at least one permission'); return; }

    try {
      await updateRole({
        id: role.id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        permissions: formData.permissions,
        color: formData.color,
        targetLayout: formData.targetLayout,
      }).unwrap();
      toast.success('Role updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to update role');
    }
  };

  if (!open || !role) return null;

  const isSystemRole = role.isSystemRole;
  const selectedColor = formData.color;

  const totalPermissionsCount = Object.values(permissions).reduce((acc, cat) => acc + cat.length, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: isSystemRole ? '#FEE2E2' : selectedColor + '20',
                color: isSystemRole ? '#DC2626' : selectedColor,
              }}
            >
              {isSystemRole ? <IconLock size={20} /> : <IconPencil size={20} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isSystemRole ? 'View System Role' : 'Edit Custom Role'}
              </h2>
              <p className="text-sm text-gray-500">
                {isSystemRole
                  ? 'System roles are protected and cannot be modified'
                  : 'Update role details and permissions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex min-h-0">
          {/* Left Column */}
          <div className="w-80 shrink-0 border-r border-gray-100 overflow-y-auto p-6 space-y-5">
            {isSystemRole && (
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
                <IconLock size={16} className="shrink-0" />
                <span>This is a system role. Permissions are read-only.</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <IconSettings size={18} className="text-gray-500" />
              <h3 className="font-semibold text-gray-800">Basic Information</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Role Name {!isSystemRole && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="Enter role name"
                disabled={isSystemRole}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                onFocus={e => { if (!isSystemRole) e.target.style.borderColor = selectedColor; }}
                onBlur={e => { if (!isSystemRole) e.target.style.borderColor = '#D1D5DB'; }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={e => handleChange('description', e.target.value)}
                rows={3}
                placeholder="Describe this role's purpose"
                disabled={isSystemRole}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                onFocus={e => { if (!isSystemRole) e.target.style.borderColor = selectedColor; }}
                onBlur={e => { if (!isSystemRole) e.target.style.borderColor = '#D1D5DB'; }}
              />
            </div>

            <ColorPicker
              selectedColor={selectedColor}
              onColorChange={c => handleChange('color', c)}
              disabled={isSystemRole}
            />

            {!isSystemRole && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Target Layout</label>
                <select
                  value={formData.targetLayout}
                  onChange={e => handleChange('targetLayout', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white cursor-pointer"
                  onFocus={e => (e.target.style.borderColor = selectedColor)}
                  onBlur={e => (e.target.style.borderColor = '#D1D5DB')}
                >
                  {TARGET_LAYOUTS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Determines the default dashboard and sidebar for this role.
                </p>
              </div>
            )}

            {/* Live Preview */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Preview</p>
              <div
                className="rounded-xl border-2 p-4"
                style={{ borderColor: selectedColor + '30', backgroundColor: selectedColor + '08' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: selectedColor + '20', color: selectedColor }}
                  >
                    <IconShield size={16} />
                  </div>
                  <span
                    className="font-semibold text-sm truncate"
                    style={{ color: selectedColor }}
                  >
                    {formData.name || 'Role Name'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {formData.description || 'Role description will appear here...'}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400">
                    {formData.permissions.length} permission{formData.permissions.length !== 1 ? 's' : ''}
                  </span>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: selectedColor + '20', color: selectedColor }}
                  >
                    {isSystemRole ? 'System' : 'Custom'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Permissions */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconKey size={18} className="text-gray-500" />
                <h3 className="font-semibold text-gray-800">Permissions</h3>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-sm px-3 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: formData.permissions.length > 0 ? selectedColor + '15' : '#F3F4F6',
                    color: formData.permissions.length > 0 ? selectedColor : '#6B7280',
                  }}
                >
                  {formData.permissions.length} / {totalPermissionsCount} selected
                </span>
                {!isSystemRole && (
                  <button
                    type="button"
                    onClick={() => handleChange('permissions', [])}
                    disabled={formData.permissions.length === 0}
                    className="text-sm text-gray-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(permissions).map(([category, categoryPermissions]) => (
                <PermissionCategory
                  key={category}
                  category={category}
                  permissions={categoryPermissions}
                  selectedPermissions={formData.permissions}
                  onPermissionChange={newPerms => handleChange('permissions', newPerms)}
                  roleColor={selectedColor}
                  disabled={isSystemRole}
                />
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <IconAlertTriangle size={15} />
            {isSystemRole
              ? 'System roles are protected and cannot be modified'
              : 'Changes will apply to all users with this role'}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              {isSystemRole ? 'Close' : 'Cancel'}
            </button>
            {!isSystemRole && (
              <button
                type="submit"
                form=""
                onClick={handleSubmit}
                disabled={isLoading || !formData.name.trim() || formData.permissions.length === 0}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-opacity"
                style={{ backgroundColor: selectedColor }}
              >
                {isLoading ? <IconLoader size={16} className="animate-spin" /> : <IconShield size={16} />}
                {isLoading ? 'Updating...' : 'Update Role'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRoleModal;
