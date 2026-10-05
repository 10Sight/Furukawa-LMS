import React, { useState, useMemo } from 'react';
import {
  IconCheck,
  IconX,
  IconSearch,
  IconFilter,
  IconDownload,
  IconMatrix,
  IconShield,
  IconLock,
  IconEye,
  IconEyeOff
} from '@tabler/icons-react';

const PermissionMatrix = ({ roles, permissions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showSystemRoles, setShowSystemRoles] = useState(true);
  const [showCustomRoles, setShowCustomRoles] = useState(true);

  // Filter roles based on filters
  const filteredRoles = useMemo(() => {
    let filtered = roles;

    if (!showSystemRoles) {
      filtered = filtered.filter(role => !role.isSystemRole);
    }
    if (!showCustomRoles) {
      filtered = filtered.filter(role => role.isSystemRole);
    }

    if (roleFilter) {
      filtered = filtered.filter(role =>
        role.name.toLowerCase().includes(roleFilter.toLowerCase())
      );
    }

    return filtered;
  }, [roles, showSystemRoles, showCustomRoles, roleFilter]);

  // Filter permissions based on search and category
  const filteredPermissions = useMemo(() => {
    const allPermissions = [];

    Object.entries(permissions).forEach(([category, categoryPermissions]) => {
      if (!categoryFilter || category === categoryFilter) {
        categoryPermissions.forEach(permObj => {
          // permObj is expected to be { id, name, description }
          // We can match against name or id
          const permName = permObj.name || permObj.id || String(permObj);
          const permId = permObj.id || String(permObj);

          if (!searchTerm || permName.toLowerCase().includes(searchTerm.toLowerCase())) {
            allPermissions.push({ category, permission: permName, id: permId });
          }
        });
      }
    });

    return allPermissions;
  }, [permissions, searchTerm, categoryFilter]);

  // Check if a role has a specific permission
  const hasPermission = (role, permission) => {
    if (!role.permissions) return false;

    if (Array.isArray(role.permissions)) {
      return role.permissions.includes(permission);
    }

    return Object.values(role.permissions).flat().includes(permission);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRoles = filteredRoles.length;
    const totalPermissions = filteredPermissions.length;
    const permissionCoverage = {};
    const roleCoverage = {};

    // Calculate permission coverage (how many roles have each permission)
    filteredPermissions.forEach(({ permission, id }) => {
      permissionCoverage[permission] = filteredRoles.filter(role =>
        hasPermission(role, id)
      ).length;
    });

    // Calculate role coverage (how many permissions each role has)
    filteredRoles.forEach(role => {
      roleCoverage[role.id] = filteredPermissions.filter(({ id }) =>
        hasPermission(role, id)
      ).length;
    });

    return {
      totalRoles,
      totalPermissions,
      permissionCoverage,
      roleCoverage,
      avgPermissionsPerRole: totalRoles > 0
        ? Object.values(roleCoverage).reduce((sum, count) => sum + count, 0) / totalRoles
        : 0
    };
  }, [filteredRoles, filteredPermissions]);

  const getRoleColor = (roleName, isSystemRole) => {
    if (isSystemRole) {
      const colors = {
        'SUPERADMIN': 'bg-red-100 text-red-700 border-red-200',
        'ADMIN': 'bg-blue-100 text-blue-700 border-blue-200',
        'INSTRUCTOR': 'bg-green-100 text-green-700 border-green-200',
        'STUDENT': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      };
      return colors[roleName] || 'bg-gray-100 text-gray-700 border-gray-200';
    }
    return 'bg-purple-100 text-purple-700 border-purple-200';
  };

  const exportMatrix = () => {
    const csvContent = [
      ['Role', 'System Role', ...filteredPermissions.map(p => p.permission)].join(','),
      ...filteredRoles.map(role => [
        role.name,
        role.isSystemRole ? 'Yes' : 'No',
        ...filteredPermissions.map(({ id }) =>
          hasPermission(role, id) ? 'Yes' : 'No'
        )
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roles-permissions-matrix.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const categoryOptions = Object.keys(permissions);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
            <IconMatrix size={24} />
            <span>Permission Matrix</span>
          </h3>
          <p className="text-gray-600 mt-1">
            Visual overview of role permissions across the system
          </p>
        </div>
        <button
          onClick={exportMatrix}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <IconDownload size={16} />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {stats.totalRoles}
          </div>
          <div className="text-sm text-gray-600">Total Roles</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {stats.totalPermissions}
          </div>
          <div className="text-sm text-gray-600">Total Permissions</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600 mb-1">
            {Math.round(stats.avgPermissionsPerRole)}
          </div>
          <div className="text-sm text-gray-600">Avg Permissions/Role</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600 mb-1">
            {categoryOptions.length}
          </div>
          <div className="text-sm text-gray-600">Permission Categories</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Search Permissions */}
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Search permissions..."
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <IconFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">All Categories</option>
              {categoryOptions.map(category => (
                <option key={category} value={category}>
                  {category.replace(/([A-Z])/g, ' $1').trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="relative">
            <IconShield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Filter roles..."
            />
          </div>
        </div>

        {/* Role Type Toggles */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showSystemRoles}
              onChange={(e) => setShowSystemRoles(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show System Roles</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showCustomRoles}
              onChange={(e) => setShowCustomRoles(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show Custom Roles</span>
          </label>
        </div>
      </div>

      {/* Matrix Table */}
      {filteredRoles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <IconEyeOff className="mx-auto mb-4 text-gray-400" size={48} />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Roles Match Filters</h4>
          <p className="text-gray-600">
            Adjust your filters to see roles in the permission matrix.
          </p>
        </div>
      ) : filteredPermissions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <IconSearch className="mx-auto mb-4 text-gray-400" size={48} />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Permissions Found</h4>
          <p className="text-gray-600">
            Try adjusting your search terms or category filter.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-[calc(100vw-2rem)] lg:max-w-[calc(100vw-280px)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                    Role
                  </th>
                  {filteredPermissions.map(({ category, permission, id }, index) => (
                    <th
                      key={`${category}-${permission}`}
                      className="h-[180px] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-bottom w-[60px] relative"
                      title={`${category}: ${permission} (${id})`}
                    >
                      <div className="absolute bottom-2 left-2 transform -rotate-45 origin-bottom-left w-max translate-x-1">
                        <div className="flex items-center space-x-1">
                          <span className="">{permission}</span>
                          <span className="text-gray-400">
                            ({stats.permissionCoverage[permission]})
                          </span>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coverage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white hover:bg-gray-50 px-6 py-4 whitespace-nowrap border-r border-gray-200">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                          {role.isSystemRole && <IconLock size={14} className="text-gray-400" />}
                          <span className="font-medium text-gray-900">{role.name}</span>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(role.name, role.isSystemRole)}`}>
                          {role.isSystemRole ? 'System' : 'Custom'}
                        </span>
                      </div>
                    </td>
                    {filteredPermissions.map(({ permission, id }) => (
                      <td
                        key={`${role.id}-${permission}`}
                        className="px-3 py-4 whitespace-nowrap text-center"
                      >
                        {hasPermission(role, id) ? (
                          <div className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                            <IconCheck size={14} className="text-green-600" />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">
                            <IconX size={14} className="text-red-500" />
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {stats.roleCoverage[role.id]} / {stats.totalPermissions}
                        </div>
                        <div className="text-xs text-gray-500">
                          {stats.totalPermissions > 0
                            ? Math.round((stats.roleCoverage[role.id] / stats.totalPermissions) * 100)
                            : 0
                          }%
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Legend</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                <IconCheck size={14} className="text-green-600" />
              </div>
              <span className="text-gray-700">Permission granted</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="inline-flex items-center justify-center w-6 h-6 bg-red-100 rounded-full">
                <IconX size={14} className="text-red-500" />
              </div>
              <span className="text-gray-700">Permission not granted</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <IconLock size={14} className="text-gray-400" />
              <span className="text-gray-700">System role (protected)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500">(n)</span>
              <span className="text-gray-700">Number of roles with permission</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionMatrix;
