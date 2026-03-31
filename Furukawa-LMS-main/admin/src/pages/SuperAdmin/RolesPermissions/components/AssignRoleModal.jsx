import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  Autocomplete,
  ListItemAvatar,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Close,
  UserPlus,
  Search,
  Shield,
  Crown,
  Key,
  UserCheck,
  Lock,
  AlertTriangle,
  Info,
  ArrowRight
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { useAssignRoleMutation } from '@/Redux/AllApi/SuperAdminApi';

const getRoleColorAndIcon = (role) => {
  if (role.color) {
    return { color: role.color, icon: <Shield size={16} /> };
  }

  const colors = {
    STUDENT: { color: '#3B82F6', icon: <UserCheck size={16} /> },
    INSTRUCTOR: { color: '#10B981', icon: <Key size={16} /> },
    ADMIN: { color: '#F59E0B', icon: <Shield size={16} /> },
    SUPERADMIN: { color: '#EF4444', icon: <Crown size={16} /> }
  };

  return colors[role.id] || { color: '#6B7280', icon: <Shield size={16} /> };
};

const UserOption = ({ user, role }) => {
  const userRoleInfo = getRoleColorAndIcon({ id: user.role });
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <Avatar sx={{ width: 32, height: 32, mr: 2, fontSize: '0.875rem' }}>
        {user.fullName?.charAt(0)?.toUpperCase() || 'U'}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {user.fullName}
        </Typography>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block' }}>
          {user.email}
        </Typography>
      </Box>
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
    </Box>
  );
};

const RoleCard = ({ role, selected, onClick }) => {
  const { color: roleColor, icon: roleIcon } = getRoleColorAndIcon(role);
  
  return (
    <Card 
      sx={{ 
        cursor: 'pointer',
        border: selected ? `2px solid ${roleColor}` : '2px solid transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          borderColor: roleColor,
          transform: 'translateY(-2px)',
          boxShadow: 4
        }
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Avatar
            sx={{
              bgcolor: roleColor + '15',
              color: roleColor,
              width: 32,
              height: 32,
              mr: 1.5
            }}
          >
            {roleIcon}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: roleColor }}>
              {role.name}
            </Typography>
            <Chip
              label={role.isSystemRole ? 'System' : 'Custom'}
              size="small"
              variant="outlined"
              color={role.isSystemRole ? 'primary' : 'secondary'}
              sx={{ fontSize: '0.7rem', height: 18 }}
            />
          </Box>
        </Box>
        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
          {role.description}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption">
            {role.permissions?.length || 0} permissions
          </Typography>
          <Typography variant="caption">
            {role.userCount || 0} users
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

const AssignRoleModal = ({ open, onClose, roles, users, onSuccess }) => {
  const theme = useTheme();
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [assignRole, { isLoading }] = useAssignRoleMutation();

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter(user => 
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  // Filter roles (exclude SuperAdmin for non-SuperAdmin users)
  const availableRoles = useMemo(() => {
    return roles.filter(role => role.id !== 'SUPERADMIN' || selectedUser?.role === 'SUPERADMIN');
  }, [roles, selectedUser]);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    // Auto-select current role if it exists
    const currentRole = roles.find(role => role.id === user.role);
    if (currentRole) {
      setSelectedRole(currentRole);
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  const handleSubmit = async () => {
    if (!selectedUser || !selectedRole) {
      toast.error('Please select both user and role');
      return;
    }

    if (selectedUser.role === selectedRole.id) {
      toast.error('User already has this role');
      return;
    }

    try {
      await assignRole({
        userId: selectedUser._id,
        roleId: selectedRole.id
      }).unwrap();

      toast.success(`Role "${selectedRole.name}" assigned to ${selectedUser.fullName} successfully!`);
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to assign role');
    }
  };

  const handleClose = () => {
    setSelectedUser(null);
    setSelectedRole(null);
    setSearchQuery('');
    onClose();
  };

  const currentUserRole = selectedUser ? roles.find(role => role.id === selectedUser.role) : null;
  const isRoleChange = selectedUser && selectedRole && selectedUser.role !== selectedRole.id;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
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
              <UserPlus size={20} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Assign Role to User
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Select a user and assign them a specific role
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
            <Paper sx={{ p: 3, borderRadius: 2, height: 'fit-content' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <Search size={20} style={{ marginRight: 8 }} />
                Select User
              </Typography>
              
              <Autocomplete
                value={selectedUser}
                onChange={(event, newValue) => handleUserSelect(newValue)}
                inputValue={searchQuery}
                onInputChange={(event, newInputValue) => setSearchQuery(newInputValue)}
                options={filteredUsers}
                getOptionLabel={(option) => option.fullName || ''}
                renderOption={(props, option) => (
                  <li {...props}>
                    <UserOption user={option} />
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search by name or email..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <Search size={20} style={{ marginRight: 8, color: theme.palette.text.secondary }} />
                    }}
                  />
                )}
                sx={{ mb: 2 }}
              />

              {selectedUser && (
                <Card sx={{ border: `1px solid ${theme.palette.divider}` }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Selected User
                    </Typography>
                    <UserOption user={selectedUser} />
                    
                    {currentUserRole && (
                      <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                        <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
                          Current Role:
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            sx={{
                              bgcolor: getRoleColorAndIcon(currentUserRole).color + '15',
                              color: getRoleColorAndIcon(currentUserRole).color,
                              width: 24,
                              height: 24,
                              mr: 1
                            }}
                          >
                            {getRoleColorAndIcon(currentUserRole).icon}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {currentUserRole.name}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}
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
                <Grid container spacing={2}>
                  {availableRoles.map((role) => (
                    <Grid item xs={12} key={role.id}>
                      <RoleCard
                        role={role}
                        selected={selectedRole?.id === role.id}
                        onClick={() => handleRoleSelect(role)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Assignment Summary */}
        {selectedUser && selectedRole && (
          <Paper sx={{ p: 3, mt: 3, borderRadius: 2, bgcolor: 'background.default' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Assignment Summary
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              {/* Current Role */}
              {currentUserRole && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                    From
                  </Typography>
                  <Avatar
                    sx={{
                      bgcolor: getRoleColorAndIcon(currentUserRole).color + '15',
                      color: getRoleColorAndIcon(currentUserRole).color,
                      width: 48,
                      height: 48,
                      mx: 'auto',
                      mb: 1
                    }}
                  >
                    {getRoleColorAndIcon(currentUserRole).icon}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {currentUserRole.name}
                  </Typography>
                </Box>
              )}

              {/* Arrow */}
              {isRoleChange && (
                <ArrowRight size={24} color={theme.palette.text.secondary} />
              )}

              {/* New Role */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                  {isRoleChange ? 'To' : 'Assign'}
                </Typography>
                <Avatar
                  sx={{
                    bgcolor: getRoleColorAndIcon(selectedRole).color + '15',
                    color: getRoleColorAndIcon(selectedRole).color,
                    width: 48,
                    height: 48,
                    mx: 'auto',
                    mb: 1
                  }}
                >
                  {getRoleColorAndIcon(selectedRole).icon}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {selectedRole.name}
                </Typography>
              </Box>
            </Box>

            {isRoleChange && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'start' }}>
                  <AlertTriangle size={16} style={{ marginRight: 8, marginTop: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Role Change Warning
                    </Typography>
                    <Typography variant="body2">
                      This will change {selectedUser.fullName}'s role from {currentUserRole?.name} to {selectedRole.name}.
                      The user's permissions will be updated immediately.
                    </Typography>
                  </Box>
                </Box>
              </Alert>
            )}

            {!isRoleChange && currentUserRole && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'start' }}>
                  <Info size={16} style={{ marginRight: 8, marginTop: 2 }} />
                  <Typography variant="body2">
                    User already has this role. No changes will be made.
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
          disabled={isLoading || !selectedUser || !selectedRole || !isRoleChange}
          sx={{ textTransform: 'none', fontWeight: 600 }}
          startIcon={isLoading ? <CircularProgress size={16} /> : <UserPlus size={16} />}
        >
          {isLoading ? 'Assigning...' : 'Assign Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignRoleModal;
