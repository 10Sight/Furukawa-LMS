import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Grid,
  Card,
  CardContent,
  IconButton,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge
} from '@mui/material';
import {
  Close,
  Group,
  Search,
  Shield,
  Crown,
  Key,
  UserCheck,
  Users,
  SelectAll,
  AlertTriangle,
  Info,
  Filter,
  CheckCircle
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { useBulkAssignRolesMutation } from '@/Redux/AllApi/SuperAdminApi';

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

const UserListItem = ({ user, selected, onToggle, disabled }) => {
  const userRoleInfo = getRoleColorAndIcon({ id: user.role });

  return (
    <ListItem disablePadding>
      <ListItemButton onClick={() => onToggle(user)} disabled={disabled}>
        <Checkbox
          checked={selected}
          disabled={disabled}
          sx={{ mr: 1 }}
        />
        <ListItemAvatar>
          <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
            {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={user.fullName}
          secondary={user.email}
          primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
          secondaryTypographyProps={{ variant: 'caption' }}
        />
        <Chip
          label={user.role}
          size="small"
          sx={{
            bgcolor: userRoleInfo.color + '15',
            color: userRoleInfo.color,
            fontSize: '0.7rem',
            height: 20
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

const RoleSelection = ({ roles, selectedRole, onRoleSelect }) => {
  return (
    <Grid container spacing={2}>
      {roles.map((role) => {
        const { color: roleColor, icon: roleIcon } = getRoleColorAndIcon(role);
        const isSelected = selectedRole?.id === role.id;

        return (
          <Grid item xs={12} sm={6} key={role.id}>
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
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Avatar
                    sx={{
                      bgcolor: roleColor + '15',
                      color: roleColor,
                      width: 28,
                      height: 28,
                      mr: 1
                    }}
                  >
                    {roleIcon}
                  </Avatar>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: roleColor }}>
                    {role.name}
                  </Typography>
                </Box>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                  {role.description}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption">
                    {role.permissions?.length || 0} permissions
                  </Typography>
                  <Chip
                    label={role.isSystemRole ? 'System' : 'Custom'}
                    size="small"
                    variant="outlined"
                    color={role.isSystemRole ? 'primary' : 'secondary'}
                    sx={{ fontSize: '0.65rem', height: 16 }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};

const BulkAssignRoles = ({ open, onClose, roles, users, onSuccess }) => {
  const theme = useTheme();
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [bulkAssignRoles, { isLoading }] = useBulkAssignRolesMutation();

  // Filter and search users
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(user => 
        user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply role filter
    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    return filtered;
  }, [users, searchQuery, roleFilter]);

  // Available roles (exclude SuperAdmin unless current user is SuperAdmin)
  const availableRoles = useMemo(() => {
    return roles.filter(role => role.id !== 'SUPERADMIN');
  }, [roles]);

  // Get unique roles for filter dropdown
  const userRoles = useMemo(() => {
    const roleSet = new Set(users.map(user => user.role));
    return Array.from(roleSet).map(roleId => 
      roles.find(role => role.id === roleId)
    ).filter(Boolean);
  }, [users, roles]);

  const handleUserToggle = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u._id === user._id);
      if (isSelected) {
        return prev.filter(u => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers);
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }

    // Filter out users who already have the selected role
    const usersToUpdate = selectedUsers.filter(user => user.role !== selectedRole.id);
    
    if (usersToUpdate.length === 0) {
      toast.error('All selected users already have this role');
      return;
    }

    try {
      const result = await bulkAssignRoles({
        userIds: usersToUpdate.map(user => user._id),
        roleId: selectedRole.id
      }).unwrap();

      toast.success(
        `Successfully assigned "${selectedRole.name}" role to ${result.data.summary.successful} users!`
      );

      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to assign roles');
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSelectedRole(null);
    setSearchQuery('');
    setRoleFilter('');
    onClose();
  };

  const isAllSelected = selectedUsers.length > 0 && selectedUsers.length === filteredUsers.length;
  const isIndeterminate = selectedUsers.length > 0 && selectedUsers.length < filteredUsers.length;

  // Get users who will actually be updated (don't already have the selected role)
  const usersToUpdate = selectedUsers.filter(user => selectedRole && user.role !== selectedRole.id);
  const usersAlreadyHaveRole = selectedUsers.filter(user => selectedRole && user.role === selectedRole.id);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              sx={{
                bgcolor: theme.palette.primary.main + '15',
                color: theme.palette.primary.main,
                mr: 2
              }}
            >
              <Group size={20} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Bulk Assign Roles
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Select multiple users and assign them the same role
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 0 }}>
        <Grid container spacing={3}>
          {/* User Selection */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  <Users size={20} style={{ marginRight: 8 }} />
                  Select Users
                </Typography>
                <Badge badgeContent={selectedUsers.length} color="primary">
                  <Users size={20} />
                </Badge>
              </Box>

              {/* Search and Filter */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="small"
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: <Search size={16} style={{ marginRight: 8 }} />
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Role Filter</InputLabel>
                  <Select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    label="Role Filter"
                  >
                    <MenuItem value="">All Roles</MenuItem>
                    {userRoles.map((role) => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Select All */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isIndeterminate}
                    onChange={handleSelectAll}
                  />
                }
                label={`Select All (${filteredUsers.length} users)`}
                sx={{ mb: 1 }}
              />

              {/* User List */}
              <Box sx={{ maxHeight: 400, overflowY: 'auto', border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <List>
                  {filteredUsers.map((user, index) => (
                    <React.Fragment key={user._id}>
                      <UserListItem
                        user={user}
                        selected={selectedUsers.some(u => u._id === user._id)}
                        onToggle={handleUserToggle}
                      />
                      {index < filteredUsers.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                  {filteredUsers.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="No users found"
                        secondary="Try adjusting your search or filter criteria"
                        sx={{ textAlign: 'center' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            </Paper>
          </Grid>

          {/* Role Selection */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <Shield size={20} style={{ marginRight: 8 }} />
                Select Role
              </Typography>

              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                <RoleSelection
                  roles={availableRoles}
                  selectedRole={selectedRole}
                  onRoleSelect={handleRoleSelect}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Assignment Summary */}
        {selectedUsers.length > 0 && selectedRole && (
          <Paper sx={{ p: 3, mt: 3, borderRadius: 2, bgcolor: 'background.default' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Assignment Summary
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Card sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                    {selectedUsers.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Users Selected
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                    {usersToUpdate.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Will Be Updated
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
                    {usersAlreadyHaveRole.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Already Have Role
                  </Typography>
                </Card>
              </Grid>
            </Grid>

            {usersToUpdate.length > 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'start' }}>
                  <Info size={16} style={{ marginRight: 8, marginTop: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Bulk Assignment Preview
                    </Typography>
                    <Typography variant="body2">
                      {usersToUpdate.length} users will be assigned the "{selectedRole.name}" role.
                      {usersAlreadyHaveRole.length > 0 && 
                        ` ${usersAlreadyHaveRole.length} users already have this role and will be skipped.`
                      }
                    </Typography>
                  </Box>
                </Box>
              </Alert>
            )}

            {usersToUpdate.length === 0 && usersAlreadyHaveRole.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'start' }}>
                  <AlertTriangle size={16} style={{ marginRight: 8, marginTop: 2 }} />
                  <Typography variant="body2">
                    All selected users already have the "{selectedRole.name}" role. No changes will be made.
                  </Typography>
                </Box>
              </Alert>
            )}
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading || selectedUsers.length === 0 || !selectedRole || usersToUpdate.length === 0}
          sx={{ textTransform: 'none', fontWeight: 600 }}
          startIcon={isLoading ? <CircularProgress size={16} /> : <Group size={16} />}
        >
          {isLoading ? 'Assigning...' : `Assign Role to ${usersToUpdate.length} Users`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkAssignRoles;
