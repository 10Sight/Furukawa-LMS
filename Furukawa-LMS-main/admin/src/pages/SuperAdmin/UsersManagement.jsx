import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Users, Trash2, UserX, Eye } from 'lucide-react';
import {
  useGetAllUsersQuery,
  useGetSoftDeletedUsersQuery,
  useDeleteUserMutation,
  useRestoreUserMutation,
} from '@/Redux/AllApi/UserApi';
import TabNavigation from '@/components/common/TabNavigation';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import ActionButtons from '@/components/common/ActionButtons';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMediaUrl } from "@/utils/mediaUtils";

const UsersManagement = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null,
    user: null
  });

  const limit = 20;

  // API queries
  const {
    data: activeUsersData,
    isLoading: activeLoading,
    refetch: refetchActive
  } = useGetAllUsersQuery({
    page: currentPage,
    limit,
    search: searchTerm,
    role: roleFilter,
    unit: unitFilter,
  }, {
    skip: activeTab !== 'active',
    refetchOnMountOrArgChange: true
  });

  const {
    data: deletedUsersData,
    isLoading: deletedLoading,
    refetch: refetchDeleted
  } = useGetSoftDeletedUsersQuery({
    page: currentPage,
    limit,
    search: searchTerm,
    role: roleFilter,
  }, {
    skip: activeTab !== 'deleted',
    refetchOnMountOrArgChange: true
  });

  // Mutations
  const [deleteUser, { isLoading: deleteLoading }] = useDeleteUserMutation();
  const [restoreUser, { isLoading: restoreLoading }] = useRestoreUserMutation();

  const currentData = activeTab === 'active' ? activeUsersData : deletedUsersData;
  const isLoading = activeTab === 'active' ? activeLoading : deletedLoading;

  const tabs = [
    {
      id: 'active',
      label: 'Active Users',
      icon: Users,
      count: activeUsersData?.totalUsers || 0
    },
    {
      id: 'deleted',
      label: 'Deleted Users',
      icon: UserX,
      count: deletedUsersData?.totalUsers || 0
    }
  ];

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'ADMIN', label: 'Admin' },
    { value: 'INSTRUCTOR', label: 'Instructor' },
    { value: 'STUDENT', label: 'Student' }
  ];

  const unitOptions = [
    { value: '', label: 'All Units' },
    { value: 'UNIT_1', label: 'Unit 1' },
    { value: 'UNIT_2', label: 'Unit 2' },
    { value: 'UNIT_3', label: 'Unit 3' },
    { value: 'UNIT_4', label: 'Unit 4' },
    { value: 'UNIT_5', label: 'Unit 5' },
  ];

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleRoleFilter = (value) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleUnitFilter = (value) => {
    setUnitFilter(value);
    setCurrentPage(1);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm('');
    setRoleFilter('');
    setUnitFilter('');
  };

  const openConfirmModal = (type, user) => {
    setConfirmModal({ isOpen: true, type, user });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, type: null, user: null });
  };

  const handleConfirmAction = async () => {
    const { type, user } = confirmModal;

    try {
      if (type === 'delete') {
        await deleteUser(user._id).unwrap();
        toast.success('User permanently deleted successfully!');
      } else if (type === 'restore') {
        await restoreUser(user._id).unwrap();
        toast.success('User restored successfully!');
      }

      // Refetch data
      if (activeTab === 'active') {
        refetchActive();
      } else {
        refetchDeleted();
      }

      closeConfirmModal();
    } catch (error) {
      toast.error(error?.data?.message || 'Something went wrong');
    }
  };

  const getUserStatusBadge = (status) => {
    const statusColors = {
      ACTIVE: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-yellow-100 text-yellow-800',
      BANNED: 'bg-red-100 text-red-800',
      PENDING: 'bg-blue-100 text-blue-800',
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const getRoleBadge = (role) => {
    const roleColors = {
      ADMIN: 'bg-purple-100 text-purple-800',
      INSTRUCTOR: 'bg-blue-100 text-blue-800',
      STUDENT: 'bg-green-100 text-green-800',
      SUPERADMIN: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={roleColors[role] || 'bg-gray-100 text-gray-800'}>
        {role?.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage all users in the system. Super Admin can view deleted users and permanently remove them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search users by name, email, or username..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full"
              />
            </div>
            <div className="w-full sm:w-48 flex gap-2">
              <Select value={roleFilter} onValueChange={handleRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={unitFilter} onValueChange={handleUnitFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>{activeTab === 'active' ? 'Created' : 'Deleted'}</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={7}>
                        <div className="animate-pulse bg-gray-200 h-4 rounded"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : currentData?.users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-12 h-12 text-gray-400" />
                        <p className="text-gray-500">No users found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentData?.users?.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            {user.avatar?.url ? (
                              <img
                                src={getMediaUrl(user.avatar.url)}
                                alt={user.fullName}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-600">
                                {user.fullName?.charAt(0)?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{user.fullName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <p className="text-xs text-gray-400">@{user.userName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        {user.unit ? user.unit.replace("UNIT_", "Unit ") : (
                          <span className="text-gray-400">No unit</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getUserStatusBadge(user.status)}
                      </TableCell>
                      <TableCell>
                        {user.department?.name || (
                          <span className="text-gray-400">No department</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(activeTab === 'active' ? user.createdAt : user.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ActionButtons.View
                            onClick={() => window.open(`/superadmin/users/${user._id}`, '_blank')}
                          />
                          {activeTab === 'deleted' ? (
                            <ActionButtons.Restore
                              onClick={() => openConfirmModal('restore', user)}
                            />
                          ) : null}
                          <ActionButtons.Delete
                            onClick={() => openConfirmModal('delete', user)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {currentData && currentData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * limit) + 1} to{' '}
                {Math.min(currentPage * limit, currentData.totalUsers)} of{' '}
                {currentData.totalUsers} users
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === currentData.totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmAction}
        title={confirmModal.type === 'delete' ? 'Permanently Delete User' : 'Restore User'}
        description={
          confirmModal.type === 'delete'
            ? `Are you sure you want to permanently delete "${confirmModal.user?.fullName}"? This action cannot be undone and will remove all associated data.`
            : `Are you sure you want to restore "${confirmModal.user?.fullName}"? This will make the user active again.`
        }
        confirmText={confirmModal.type === 'delete' ? 'Delete Permanently' : 'Restore User'}
        type={confirmModal.type === 'delete' ? 'danger' : 'restore'}
        isLoading={deleteLoading || restoreLoading}
      />
    </div>
  );
};

export default UsersManagement;
