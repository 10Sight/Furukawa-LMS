import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Badge,
  Divider
} from '@mui/material';
import {
  Users,
  Search,
  Filter,
  Eye,
  Mail,
  Calendar,
  Shield,
  Crown,
  Key,
  UserCheck,
  RefreshCw,
  Download,
  UserX
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import { useGetUsersByRoleQuery } from '@/Redux/AllApi/SuperAdminApi';

const getRoleColorAndIcon = (role) => {
  if (role?.color) {
    return { color: role.color, icon: <Shield size={16} /> };
  }

  const colors = {
    STUDENT: { color: '#3B82F6', icon: <UserCheck size={16} /> },
    INSTRUCTOR: { color: '#10B981', icon: <Key size={16} /> },
    ADMIN: { color: '#F59E0B', icon: <Shield size={16} /> },
    SUPERADMIN: { color: '#EF4444', icon: <Crown size={16} /> }
  };

  return colors[role?.id] || { color: '#6B7280', icon: <Shield size={16} /> };
};

const RoleSelector = ({ roles, selectedRole, onRoleSelect }) => {
  const theme = useTheme();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Select Role to View Users
      </Typography>
      <Grid container spacing={2}>
        {roles.map((role) => {
          const { color: roleColor, icon: roleIcon } = getRoleColorAndIcon(role);
          const isSelected = selectedRole?.id === role.id;

          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={role.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: isSelected ? `2px solid ${roleColor}` : '2px solid transparent',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: roleColor,
                    transform: 'translateY(-2px)',
                    boxShadow: 4
                  }
                }}
                onClick={() => onRoleSelect(role)}
              >
                <CardContent sx={{ p: 2, textAlign: 'center' }}>
                  <Avatar
                    sx={{
                      bgcolor: roleColor + '15',
                      color: roleColor,
                      width: 48,
                      height: 48,
                      mx: 'auto',
                      mb: 1
                    }}
                  >
                    {roleIcon}
                  </Avatar>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: roleColor, mb: 0.5 }}>
                    {role.name}
                  </Typography>
                  <Badge 
                    badgeContent={role.userCount} 
                    color="primary"
                    sx={{ width: '100%' }}
                  >
                    <Typography variant="caption" color="textSecondary" sx={{ width: '100%' }}>
                      Users
                    </Typography>
                  </Badge>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={role.isSystemRole ? 'System' : 'Custom'}
                      size="small"
                      variant="outlined"
                      color={role.isSystemRole ? 'primary' : 'secondary'}
                      sx={{ fontSize: '0.7rem', height: 18 }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

const UserTable = ({ users, loading, pagination, onPageChange, onLimitChange }) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!users || users.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <UserX size={20} style={{ marginRight: 8 }} />
          No users found for this role.
        </Box>
      </Alert>
    );
  }

  return (
    <Box>
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: theme.palette.background.default }}>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user._id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ width: 32, height: 32, mr: 2, fontSize: '0.875rem' }}>
                      {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {user.fullName}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        ID: {user._id}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Mail size={14} style={{ marginRight: 4 }} />
                    <Typography variant="body2">
                      {user.email}
                    </Typography>
                    {user.isEmailVerified && (
                      <Chip
                        label="Verified"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ ml: 1, fontSize: '0.7rem', height: 18 }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={user.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={user.isActive ? 'success' : 'error'}
                    variant="filled"
                    sx={{ fontSize: '0.7rem', height: 20 }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Calendar size={14} style={{ marginRight: 4 }} />
                    <Typography variant="body2">
                      {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View User Details">
                    <IconButton size="small">
                      <Eye size={16} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination && (
        <TablePagination
          component="div"
          count={pagination.totalUsers}
          page={pagination.currentPage - 1}
          onPageChange={(event, newPage) => onPageChange(newPage + 1)}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={(event) => onLimitChange(parseInt(event.target.value))}
          rowsPerPageOptions={[10, 20, 50, 100]}
          sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
        />
      )}
    </Box>
  );
};

const UsersByRole = ({ selectedRole, roles, onRoleSelect }) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Reset page when role or search changes
  useEffect(() => {
    setPage(1);
  }, [selectedRole, searchQuery]);

  // Query users by role
  const {
    data: usersData,
    isLoading,
    error,
    refetch
  } = useGetUsersByRoleQuery(
    {
      roleId: selectedRole?.id,
      page,
      limit,
      search: searchQuery
    },
    {
      skip: !selectedRole?.id
    }
  );

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleExport = () => {
    // In a real implementation, this would trigger a CSV/Excel export
    console.log('Export users for role:', selectedRole?.name);
  };

  if (!selectedRole) {
    return (
      <Box>
        <RoleSelector
          roles={roles}
          selectedRole={selectedRole}
          onRoleSelect={onRoleSelect}
        />
      </Box>
    );
  }

  const { color: roleColor, icon: roleIcon } = getRoleColorAndIcon(selectedRole);
  const users = usersData?.data?.users || [];
  const pagination = usersData?.data?.pagination || null;

  return (
    <Box>
      {/* Role Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              sx={{
                bgcolor: roleColor + '15',
                color: roleColor,
                width: 48,
                height: 48,
                mr: 2
              }}
            >
              {roleIcon}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: roleColor }}>
                {selectedRole.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {selectedRole.description}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => onRoleSelect(null)}
              sx={{ textTransform: 'none' }}
            >
              Change Role
            </Button>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh}>
                <RefreshCw size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton onClick={handleExport}>
                <Download size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Role Stats */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                {pagination?.totalUsers || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Users
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                {users.filter(u => u.isActive).length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Active Users
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>
                {users.filter(u => u.isEmailVerified).length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Verified Email
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
                {selectedRole.permissions?.length || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Permissions
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Search and Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: <Search size={20} style={{ marginRight: 8 }} />
            }}
          />
          <Button
            variant="outlined"
            startIcon={<Filter size={16} />}
            sx={{ textTransform: 'none' }}
          >
            Filters
          </Button>
        </Box>
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load users: {error.message}
        </Alert>
      )}

      {/* Users Table */}
      <UserTable
        users={users}
        loading={isLoading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />
    </Box>
  );
};

export default UsersByRole;
