import React, { useState, useMemo } from 'react';
import {
  IconShield,
  IconPlus,
  IconX,
  IconCheck,
  IconChevronDown,
  IconKey,
  IconSettings,
  IconInfoCircle,
  IconLoader,
  IconAlertCircle,
} from '@tabler/icons-react';
import { toast } from 'react-toastify';
import { useCreateRoleMutation } from '@/Redux/AllApi/SuperAdminApi';

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

const ColorPicker = ({ selectedColor, onColorChange }) => (
  <div className="mt-4">
    <label className="block text-sm font-semibold text-gray-700 mb-2">Role Color</label>
    <div className="flex flex-wrap gap-2">
      {ROLE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onColorChange(color)}
          className="w-8 h-8 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center"
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

const PermissionCategory = ({ category, permissions, selectedPermissions, onPermissionChange, roleColor }) => {
  const [expanded, setExpanded] = useState(false);
  const categoryIds = permissions.map(p => p.id);
  const selectedInCategory = categoryIds.filter(id => selectedPermissions.includes(id));
  const allSelected = selectedInCategory.length === categoryIds.length;
  const someSelected = selectedInCategory.length > 0 && !allSelected;

  const handleSelectAll = (e) => {
    e.stopPropagation();
    if (allSelected) {
      onPermissionChange(selectedPermissions.filter(p => !categoryIds.includes(p)));
    } else {
      onPermissionChange([...new Set([...selectedPermissions, ...categoryIds])]);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={handleSelectAll}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 rounded cursor-pointer"
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
          {permissions.map(permission => (
            <label key={permission.id} className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedPermissions.includes(permission.id)}
                onChange={() => {
                  if (selectedPermissions.includes(permission.id)) {
                    onPermissionChange(selectedPermissions.filter(p => p !== permission.id));
                  } else {
                    onPermissionChange([...selectedPermissions, permission.id]);
                  }
                }}
                className="mt-0.5 w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: roleColor }}
              />
              <div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{permission.name}</p>
                {permission.description && (
                  <p className="text-xs text-gray-400">{permission.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const CreateRoleModal = ({ open, onClose, permissions, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
    color: '#3B82F6',
    targetLayout: 'custom',
  });
  const [errors, setErrors] = useState({});
  const [createRole, { isLoading }] = useCreateRoleMutation();

  const totalPermissionsCount = useMemo(
    () => Object.values(permissions).reduce((acc, cat) => acc + cat.length, 0),
    [permissions]
  );

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Role name is required';
    else if (formData.name.trim().length < 2) newErrors.name = 'At least 2 characters required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (formData.permissions.length === 0) newErrors.permissions = 'Select at least one permission';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await createRole(formData).unwrap();
      toast.success('Role created successfully!');
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to create role');
    }
  };

  const handleClose = () => {
    setFormData({ name: '', description: '', permissions: [], color: '#3B82F6', targetLayout: 'custom' });
    setErrors({});
    onClose();
  };

  if (!open) return null;

  const selectedColor = formData.color;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: selectedColor + '20', color: selectedColor }}
            >
              <IconPlus size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create Custom Role</h2>
              <p className="text-sm text-gray-500">Define a new role with specific permissions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left Column */}
          <div className="w-80 shrink-0 border-r border-gray-100 overflow-y-auto p-6 space-y-5">
            <div className="flex items-center gap-2">
              <IconSettings size={18} className="text-gray-500" />
              <h3 className="font-semibold text-gray-800">Basic Information</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="e.g., Content Manager"
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors
                  ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                onFocus={e => { if (!errors.name) e.target.style.borderColor = selectedColor; }}
                onBlur={e => { if (!errors.name) e.target.style.borderColor = '#D1D5DB'; }}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={e => handleChange('description', e.target.value)}
                rows={3}
                placeholder="Describe this role's responsibilities..."
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none transition-colors
                  ${errors.description ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                onFocus={e => { if (!errors.description) e.target.style.borderColor = selectedColor; }}
                onBlur={e => { if (!errors.description) e.target.style.borderColor = '#D1D5DB'; }}
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
            </div>

            <ColorPicker selectedColor={selectedColor} onColorChange={c => handleChange('color', c)} />

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
                    Custom
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
                <button
                  type="button"
                  onClick={() => handleChange('permissions', [])}
                  disabled={formData.permissions.length === 0}
                  className="text-sm text-gray-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {errors.permissions && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                <IconAlertCircle size={16} className="shrink-0" />
                {errors.permissions}
              </div>
            )}

            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
              <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                Users with this role can perform all selected actions. System roles have predefined permissions and cannot be modified.
              </span>
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
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-5 py-2 text-sm font-semibold text-white rounded-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-opacity"
            style={{ backgroundColor: selectedColor }}
          >
            {isLoading ? <IconLoader size={16} className="animate-spin" /> : <IconPlus size={16} />}
            {isLoading ? 'Creating...' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoleModal;
