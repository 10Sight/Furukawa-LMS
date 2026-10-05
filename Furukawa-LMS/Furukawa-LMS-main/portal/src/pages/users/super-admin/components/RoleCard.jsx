import React from 'react';
import {
  IconShield,
  IconUsers,
  IconEdit,
  IconTrash,
  IconLock,
  IconSettings,
  IconEye
} from '@tabler/icons-react';

const RoleCard = ({ role, onEdit, onDelete, onViewUsers }) => {
  const getRoleColor = (roleName) => {
    const colors = {
      'SUPERADMIN': 'bg-red-100 text-red-700 border-red-200',
      'ADMIN': 'bg-blue-100 text-blue-700 border-blue-200',
      'INSTRUCTOR': 'bg-green-100 text-green-700 border-green-200',
      'STUDENT': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      default: 'bg-purple-100 text-purple-700 border-purple-200'
    };
    return colors[roleName] || colors.default;
  };

  const getPermissionCount = () => {
    if (!role.permissions) return 0;
    return Array.isArray(role.permissions) 
      ? role.permissions.length 
      : Object.values(role.permissions).reduce((acc, perms) => acc + perms.length, 0);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <IconShield size={20} className="text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{role.name}</h3>
            <div className="flex items-center mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(role.name)}`}>
                {role.isSystemRole ? 'System Role' : 'Custom Role'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Actions Menu */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onViewUsers(role)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View Users"
          >
            <IconEye size={16} />
          </button>
          {!role.isSystemRole && (
            <>
              <button
                onClick={() => onEdit(role)}
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Edit Role"
              >
                <IconEdit size={16} />
              </button>
              <button
                onClick={() => onDelete(role)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Role"
              >
                <IconTrash size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {role.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {role.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <IconUsers size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {role.userCount || 0} users
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <IconLock size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {getPermissionCount()} permissions
            </span>
          </div>
        </div>

        {role.isSystemRole && (
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <IconSettings size={14} />
            <span>Protected</span>
          </div>
        )}
      </div>

      {/* Permission Preview */}
      {role.permissions && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-1">
            {Array.isArray(role.permissions) 
              ? role.permissions.slice(0, 3).map((permission, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                  >
                    {permission}
                  </span>
                ))
              : Object.keys(role.permissions).slice(0, 3).map((category, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                  >
                    {category}
                  </span>
                ))
            }
            {getPermissionCount() > 3 && (
              <span className="px-2 py-1 bg-gray-200 text-gray-500 text-xs rounded-md">
                +{getPermissionCount() - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleCard;
