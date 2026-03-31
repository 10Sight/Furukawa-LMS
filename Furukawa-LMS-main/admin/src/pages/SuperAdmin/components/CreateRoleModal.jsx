import React, { useState } from 'react';
import {
  IconX,
  IconShield,
  IconCheck,
  IconLoader,
  IconAlertTriangle
} from '@tabler/icons-react';
import { toast } from 'react-toastify';
import { useCreateRoleMutation } from '@/Redux/AllApi/SuperAdminApi';

const CreateRoleModal = ({ open, onClose, permissions, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: []
  });
  const [expandedCategories, setExpandedCategories] = useState({});

  const [createRole, { isLoading }] = useCreateRoleMutation();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handlePermissionToggle = (permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleCategoryToggle = (category, categoryPermissions) => {
    const allSelected = categoryPermissions.every(p => formData.permissions.includes(p));
    
    if (allSelected) {
      // Remove all permissions from this category
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPermissions.includes(p))
      }));
    } else {
      // Add all permissions from this category
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...categoryPermissions])]
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    if (formData.permissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    try {
      await createRole({
        name: formData.name.trim(),
        description: formData.description.trim(),
        permissions: formData.permissions
      }).unwrap();

      toast.success('Role created successfully');
      setFormData({ name: '', description: '', permissions: [] });
      setExpandedCategories({});
      onSuccess();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to create role');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', permissions: [] });
    setExpandedCategories({});
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <IconShield size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Custom Role</h2>
              <p className="text-sm text-gray-600">Define a new role with specific permissions</p>
            </div>
          </div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              
              <div>
                <label htmlFor="roleName" className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name *
                </label>
                <input
                  id="roleName"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter role name"
                  required
                />
              </div>

              <div>
                <label htmlFor="roleDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="roleDescription"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe this role and its purpose"
                />
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
                <span className="text-sm text-gray-600">
                  {formData.permissions.length} selected
                </span>
              </div>

              {Object.entries(permissions).map(([category, categoryPermissions]) => {
                const isExpanded = expandedCategories[category];
                const selectedCount = categoryPermissions.filter(p => formData.permissions.includes(p)).length;
                const allSelected = selectedCount === categoryPermissions.length;

                return (
                  <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <div className="bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => handleCategoryToggle(category, categoryPermissions)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-900 capitalize">
                              {category.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          </label>
                          <span className="text-sm text-gray-500">
                            ({selectedCount}/{categoryPermissions.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <IconCheck 
                            size={16} 
                            className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                          />
                        </button>
                      </div>
                    </div>

                    {/* Category Permissions */}
                    {isExpanded && (
                      <div className="p-4 space-y-2">
                        {categoryPermissions.map((permission) => (
                          <label key={permission} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={formData.permissions.includes(permission)}
                              onChange={() => handlePermissionToggle(permission)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{permission}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center text-sm text-gray-600">
              <IconAlertTriangle size={16} className="mr-1" />
              Custom roles can be modified or deleted later
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !formData.name.trim() || formData.permissions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <IconLoader className="animate-spin" size={16} />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <IconShield size={16} />
                    <span>Create Role</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoleModal;
