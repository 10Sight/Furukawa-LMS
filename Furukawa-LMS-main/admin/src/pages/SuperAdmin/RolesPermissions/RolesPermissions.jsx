import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Tab, 
  Tabs, 
  Grid, 
  Button, 
  Chip,
  Alert,
  CircularProgress,
  Container,
  Paper,
  Breadcrumbs,
  Link,
  Fade,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Shield,
  Users,
  UserPlus,
  Settings,
  Eye,
  Plus,
  Edit,
  Delete,
  PersonAdd,
  Group,
  Matrix3x3,
  Security
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
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

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`roles-tabpanel-${index}`}
      aria-labelledby={`roles-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Fade in timeout={300}>
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        </Fade>
      )}
    </div>
  );
}

const RolesPermissions = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

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
    <Grid container spacing={3}>
      {/* Stats Cards */}
      <Grid item xs={12} md={3}>
        <Card sx={{ 
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          border: `1px solid ${theme.palette.divider}`
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Shield size={24} color={theme.palette.primary.main} />
              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                Total Roles
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
              {roleStats.totalRoles}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {roleStats.systemRoles} system, {roleStats.customRoles} custom
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={{ 
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          border: `1px solid ${theme.palette.divider}`
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Users size={24} color={theme.palette.success.main} />
              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                Total Users
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
              {roleStats.totalUsers}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Across all roles
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={{ 
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          border: `1px solid ${theme.palette.divider}`
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Security size={24} color={theme.palette.warning.main} />
              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                Permissions
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
              {roleStats.totalPermissions}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Available permissions
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card sx={{ 
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          border: `1px solid ${theme.palette.divider}`
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Settings size={24} color={theme.palette.info.main} />
              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                Categories
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.info.main }}>
              {Object.keys(permissions).length}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Permission categories
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Action Buttons */}
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={() => openModal('createRole')}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Create Custom Role
          </Button>
          <Button
            variant="outlined"
            startIcon={<PersonAdd size={20} />}
            onClick={() => openModal('assignRole')}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Assign Role
          </Button>
          <Button
            variant="outlined"
            startIcon={<Group size={20} />}
            onClick={() => openModal('bulkAssign')}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Bulk Assign
          </Button>
          <Button
            variant="outlined"
            startIcon={<Matrix3x3 size={20} />}
            onClick={() => setActiveTab(4)}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            View Matrix
          </Button>
        </Box>
      </Grid>

      {/* Roles Grid */}
      <Grid item xs={12}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          All Roles
        </Typography>
        <Grid container spacing={3}>
          {roles.map((role) => (
            <Grid item xs={12} sm={6} lg={4} xl={3} key={role.id}>
              <RoleCard
                role={role}
                onEdit={() => openModal('editRole', role)}
                onDelete={() => openModal('confirmDelete', role)}
                onViewUsers={() => {
                  setSelectedRole(role);
                  setActiveTab(3);
                }}
              />
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Grid>
  );

  if (rolesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (rolesError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load roles and permissions: {rolesError.message}
      </Alert>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs separator="›" sx={{ mb: 2 }}>
          <Link color="inherit" href="/admin">
            Admin
          </Link>
          <Typography color="text.primary">Roles & Permissions</Typography>
        </Breadcrumbs>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Roles & Permissions Management
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage user roles, permissions, and access controls across the system
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem'
            }
          }}
        >
          <Tab 
            icon={<Eye size={20} />} 
            label="Overview" 
            iconPosition="start"
          />
          <Tab 
            icon={<Plus size={20} />} 
            label="Create Role" 
            iconPosition="start"
          />
          <Tab 
            icon={<PersonAdd size={20} />} 
            label="Assign Roles" 
            iconPosition="start"
          />
          <Tab 
            icon={<Users size={20} />} 
            label="Users by Role" 
            iconPosition="start"
          />
          <Tab 
            icon={<Matrix3x3 size={20} />} 
            label="Permission Matrix" 
            iconPosition="start"
          />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          {renderOverview()}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <CreateRoleModal
            open={true}
            onClose={() => setActiveTab(0)}
            permissions={permissions}
            onSuccess={() => {
              setActiveTab(0);
              refetchRoles();
            }}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <AssignRoleModal
            open={true}
            onClose={() => setActiveTab(0)}
            roles={roles}
            users={users}
            onSuccess={() => {
              setActiveTab(0);
            }}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          <UsersByRole
            selectedRole={selectedRole}
            roles={roles}
            onRoleSelect={setSelectedRole}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={4}>
          <PermissionMatrix
            roles={roles}
            permissions={permissions}
          />
        </TabPanel>
      </Paper>

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
    </Container>
  );
};

export default RolesPermissions;
