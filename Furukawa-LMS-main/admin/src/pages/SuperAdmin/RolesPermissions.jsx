import React, { useState, useMemo } from 'react';
import { 
  IconShield, 
  IconUsers, 
  IconUserPlus, 
  IconSettings, 
  IconEye, 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconUsersGroup,
  IconMatrix,
  IconLock,
  IconLoader
} from '@tabler/icons-react';
import { toast } from 'react-toastify';
import {
  useGetRolesAndPermissionsQuery,
  useDeleteRoleMutation,
  useGetAllUsersQuery
} from '@/Redux/AllApi/SuperAdminApi';
import RoleCard from './components/RoleCard';
import CreateRoleModal from './components/CreateRoleModal';
import EditRoleModal from './components/EditRoleModal';
import AssignRoleModal from './components/AssignRoleModal';
import BulkAssignRoles from './components/BulkAssignRoles';
import UsersByRole from './components/UsersByRole';
import PermissionMatrix from './components/PermissionMatrix';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const TabButton = ({ active, onClick, icon: Icon, label, count }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-colors duration-200 ${
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
    {count !== undefined && (
      <span className={`px-2 py-1 text-xs rounded-full ${
        active ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
      }`}>
        {count}
      </span>
    )}
  </button>
);

const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    yellow: 'text-yellow-600 bg-yellow-50',
    purple: 'text-purple-600 bg-purple-50'
  };

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
        <p className="text-gray-600 font-medium">{title}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

const RolesPermissions = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRole, setSelectedRole] = useState(null);
  const [modalsOpen, setModalsOpen] = useState({
    createRole: false,
    editRole: false,
    assignRole: false,
    bulkAssign: false,
    confirmDelete: false
  });

  // API hooks
  const { 
    data: rolesData, 
    isLoading: rolesLoading, 
    error: rolesError,
    refetch: refetchRoles
  } = useGetRolesAndPermissionsQuery();

  const { data: usersData } = useGetAllUsersQuery({
    limit: 1000 // Get all users for assignment
  });

  const [deleteRole, { isLoading: deleteLoading }] = useDeleteRoleMutation();

  // Computed values
  const { roles = [], permissions = {} } = rolesData?.data || {};
  const users = usersData?.data?.users || [];

  const roleStats = useMemo(() => {
    const totalRoles = roles.length;
    const systemRoles = roles.filter(role => role.isSystemRole).length;
    const customRoles = roles.filter(role => !role.isSystemRole).length;
    const totalUsers = users.length;
    const totalPermissions = Object.values(permissions).reduce((acc, categoryPerms) => acc + categoryPerms.length, 0);

    return {
      totalRoles,
      systemRoles,
      customRoles,
      totalUsers,
      totalPermissions
    };
  }, [roles, permissions, users]);

  const openModal = (modalName, role = null) => {
    setSelectedRole(role);
    setModalsOpen(prev => ({ ...prev, [modalName]: true }));
  };

  const closeModal = (modalName) => {
    setModalsOpen(prev => ({ ...prev, [modalName]: false }));
    setSelectedRole(null);
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    try {
      await deleteRole(selectedRole.id).unwrap();
      toast.success('Role deleted successfully');
      closeModal('confirmDelete');
      refetchRoles();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to delete role');
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={IconShield}
          title="Total Roles"
          value={roleStats.totalRoles}
          subtitle={`${roleStats.systemRoles} system, ${roleStats.customRoles} custom`}
          color="blue"
        />
        <StatCard
          icon={IconUsers}
          title="Total Users"
          value={roleStats.totalUsers}
          subtitle="Across all roles"
          color="green"
        />
        <StatCard
          icon={IconLock}
          title="Permissions"
          value={roleStats.totalPermissions}
          subtitle="Available permissions"
          color="yellow"
        />
        <StatCard
          icon={IconSettings}
          title="Categories"
          value={Object.keys(permissions).length}
          subtitle="Permission categories"
          color="purple"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => openModal('createRole')}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <IconPlus size={20} />
          <span>Create Custom Role</span>
        </button>
        <button
          onClick={() => openModal('assignRole')}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <IconUserPlus size={20} />
          <span>Assign Role</span>
        </button>
        <button
          onClick={() => openModal('bulkAssign')}
          className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <IconUsersGroup size={20} />
          <span>Bulk Assign</span>
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <IconMatrix size={20} />
          <span>View Matrix</span>
        </button>
      </div>

      {/* Roles Grid */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Roles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onEdit={() => openModal('editRole', role)}
              onDelete={() => openModal('confirmDelete', role)}
              onViewUsers={() => {
                setSelectedRole(role);
                setActiveTab('users');
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <IconLoader className="animate-spin mx-auto mb-4 text-blue-600" size={40} />
          <p className="text-gray-600">Loading roles and permissions...</p>
        </div>
      </div>
    );
  }

  if (rolesError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          <IconShield className="text-red-500 mr-2" size={20} />
          <p className="text-red-700">
            Failed to load roles and permissions: {rolesError.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="text-gray-600 mt-1">
            Manage user roles, permissions, and access controls across the system
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          icon={IconEye}
          label="Overview"
        />
        <TabButton
          active={activeTab === 'users'}
          onClick={() => setActiveTab('users')}
          icon={IconUsers}
          label="Users by Role"
        />
        <TabButton
          active={activeTab === 'matrix'}
          onClick={() => setActiveTab('matrix')}
          icon={IconMatrix}
          label="Permission Matrix"
        />
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && (
          <UsersByRole
            selectedRole={selectedRole}
            roles={roles}
            onRoleSelect={setSelectedRole}
          />
        )}
        {activeTab === 'matrix' && (
          <PermissionMatrix
            roles={roles}
            permissions={permissions}
          />
        )}
      </div>

      {/* Modals */}
      <CreateRoleModal
        open={modalsOpen.createRole}
        onClose={() => closeModal('createRole')}
        permissions={permissions}
        onSuccess={() => {
          closeModal('createRole');
          refetchRoles();
        }}
      />

      <EditRoleModal
        open={modalsOpen.editRole}
        onClose={() => closeModal('editRole')}
        role={selectedRole}
        permissions={permissions}
        onSuccess={() => {
          closeModal('editRole');
          refetchRoles();
        }}
      />

      <AssignRoleModal
        open={modalsOpen.assignRole}
        onClose={() => closeModal('assignRole')}
        roles={roles}
        users={users}
        onSuccess={() => {
          closeModal('assignRole');
        }}
      />

      <BulkAssignRoles
        open={modalsOpen.bulkAssign}
        onClose={() => closeModal('bulkAssign')}
        roles={roles}
        users={users}
        onSuccess={() => {
          closeModal('bulkAssign');
        }}
      />

      <ConfirmDialog
        open={modalsOpen.confirmDelete}
        onClose={() => closeModal('confirmDelete')}
        onConfirm={handleDeleteRole}
        loading={deleteLoading}
        title="Delete Role"
        message={
          selectedRole && (
            <>
              Are you sure you want to delete the role <strong>"{selectedRole.name}"</strong>?
              <br />
              <br />
              This action cannot be undone. Make sure no users are currently assigned to this role.
            </>
          )
        }
        confirmText="Delete Role"
        severity="error"
      />
    </div>
  );
};

export default RolesPermissions;
