import React, { useState, useMemo } from 'react';
import {
  IconX,
  IconUsersGroup,
  IconSearch,
  IconLoader,
  IconUser,
  IconMail,
  IconShield,
  IconCheck,
  IconFilter
} from '@tabler/icons-react';
import { toast } from 'react-toastify';
import { useBulkAssignRolesMutation } from '@/Redux/AllApi/SuperAdminApi';

const BulkAssignRoles = ({ open, onClose, roles, users, onSuccess }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [bulkAssignRoles, { isLoading }] = useBulkAssignRolesMutation();

  // Filter users based on search term and role filter
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.fullName?.toLowerCase().includes(lowerSearchTerm) ||
        user.userName?.toLowerCase().includes(lowerSearchTerm) ||
        user.email?.toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    return filtered;
  }, [users, searchTerm, roleFilter]);

  const handleUserToggle = (user) => {
    setSelectedUsers(prev => 
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }

    try {
      await bulkAssignRoles({
        userIds: selectedUsers.map(user => user.id),
        roleId: selectedRole
      }).unwrap();

      toast.success(`Role assigned to ${selectedUsers.length} users successfully`);
      resetForm();
      onSuccess();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to assign roles');
    }
  };

  const resetForm = () => {
    setSelectedUsers([]);
    setSelectedRole('');
    setSearchTerm('');
    setRoleFilter('');
  };

  const getRoleColor = (roleName) => {
    const colors = {
      'SUPERADMIN': 'bg-red-100 text-red-700',
      'ADMIN': 'bg-blue-100 text-blue-700',
      'INSTRUCTOR': 'bg-green-100 text-green-700',
      'STUDENT': 'bg-yellow-100 text-yellow-700',
      default: 'bg-purple-100 text-purple-700'
    };
    return colors[roleName] || colors.default;
  };

  const uniqueRoles = [...new Set(users.map(user => user.role))];

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <IconUsersGroup size={24} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Bulk Assign Roles</h2>
              <p className="text-sm text-gray-600">Assign roles to multiple users at once</p>
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
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search users by name or email..."
                />
              </div>

              {/* Role Filter */}
              <div className="relative">
                <IconFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                >
                  <option value="">All Roles</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* User Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Select Users</h3>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    {selectedUsers.length} of {filteredUsers.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Users List */}
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredUsers.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <label 
                        key={user.id} 
                        className={`flex items-center space-x-3 p-4 cursor-pointer hover:bg-gray-50 ${
                          selectedUsers.find(u => u.id === user.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedUsers.find(u => u.id === user.id)}
                          onChange={() => handleUserToggle(user)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {user.fullName || user.userName}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <IconMail className="text-gray-400" size={14} />
                                <p className="text-sm text-gray-600 truncate">{user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                                {user.role}
                              </span>
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <IconUser className="text-gray-500" size={16} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No users found matching your filters
                  </div>
                )}
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Select Target Role</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map((role) => (
                  <label 
                    key={role.id}
                    className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRole === role.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selectedRole"
                      value={role.id}
                      checked={selectedRole === role.id}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-2">
                      <IconShield className="text-gray-500" size={20} />
                      <div>
                        <p className="font-medium text-gray-900">{role.name}</p>
                        {role.description && (
                          <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(role.name)}`}>
                            {role.isSystemRole ? 'System Role' : 'Custom Role'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Summary */}
            {selectedUsers.length > 0 && selectedRole && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Assignment Summary</h4>
                <p className="text-blue-800">
                  You are about to assign the role <strong>{roles.find(r => r.id === selectedRole)?.name}</strong> to{' '}
                  <strong>{selectedUsers.length}</strong> user{selectedUsers.length !== 1 ? 's' : ''}.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedUsers.slice(0, 5).map((user) => (
                    <span 
                      key={user.id}
                      className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-md"
                    >
                      {user.fullName || user.userName}
                    </span>
                  ))}
                  {selectedUsers.length > 5 && (
                    <span className="px-2 py-1 bg-blue-300 text-blue-900 text-xs rounded-md">
                      +{selectedUsers.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {selectedUsers.length > 0 && selectedRole ? (
                <span>Ready to assign role to {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''}</span>
              ) : (
                <span>Please select users and a target role</span>
              )}
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
                disabled={isLoading || selectedUsers.length === 0 || !selectedRole}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <IconLoader className="animate-spin" size={16} />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <>
                    <IconUsersGroup size={16} />
                    <span>Assign to {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}</span>
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

export default BulkAssignRoles;
