import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  FormGroup,
  FormLabel,
  Grid,
  Card,
  CardContent,
  Avatar,
  Divider
} from '@mui/material';
import {
  ExpandMore,
  Close,
  Shield,
  Edit,
  Check,
  Info,
  AlertTriangle,
  Settings,
  Key,
  Lock,
  Crown
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import { useUpdateRoleMutation } from '@/Redux/AllApi/SuperAdminApi';

const ColorPicker = ({ selectedColor, onColorChange }) => {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6B7280'
  ];

  return (
    <Box sx={{ mt: 2 }}>
      <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 600 }}>
        Role Color
      </FormLabel>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {colors.map((color) => (
          <IconButton
            key={color}
            onClick={() => onColorChange(color)}
            sx={{
              width: 32,
              height: 32,
              bgcolor: color,
              border: selectedColor === color ? `3px solid ${color}` : '2px solid transparent',
              boxShadow: selectedColor === color ? '0 0 0 2px white' : 'none',
              '&:hover': {
                transform: 'scale(1.1)'
              }
            }}
          >
            {selectedColor === color && <Check size={16} color="white" />}
          </IconButton>
        ))}
      </Box>
    </Box>
  );
};

const PermissionCategory = ({ category, permissions, selectedPermissions, onPermissionToggle, roleColor, disabled = false }) => {
  const theme = useTheme();
  const categoryPermissions = permissions.map(p => p.id);
  const selectedInCategory = selectedPermissions.filter(p => categoryPermissions.includes(p));
  const allSelected = selectedInCategory.length === categoryPermissions.length;
  const someSelected = selectedInCategory.length > 0 && selectedInCategory.length < categoryPermissions.length;

  const handleSelectAll = () => {
    if (disabled) return;
    
    if (allSelected) {
      const newSelected = selectedPermissions.filter(p => !categoryPermissions.includes(p));
      onPermissionToggle(newSelected);
    } else {
      const newSelected = [...new Set([...selectedPermissions, ...categoryPermissions])];
      onPermissionToggle(newSelected);
    }
  };

  return (
    <Accordion disabled={disabled}>
      <AccordionSummary
        expandIcon={<ExpandMore />}
        sx={{
          '&.Mui-expanded': {
            borderBottom: `1px solid ${theme.palette.divider}`
          },
          opacity: disabled ? 0.6 : 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mr: 2 }}>
              {category}
            </Typography>
            <Chip
              size="small"
              label={`${selectedInCategory.length}/${categoryPermissions.length}`}
              color={allSelected ? 'primary' : someSelected ? 'warning' : 'default'}
              variant={someSelected || allSelected ? 'filled' : 'outlined'}
            />
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                onClick={(e) => e.stopPropagation()}
                disabled={disabled}
                sx={{
                  color: roleColor,
                  '&.Mui-checked': {
                    color: roleColor,
                  }
                }}
              />
            }
            label="Select All"
            onClick={(e) => e.stopPropagation()}
            sx={{ ml: 'auto', mr: 0 }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <FormGroup>
          <Grid container spacing={1}>
            {permissions.map((permission) => (
              <Grid item xs={12} sm={6} key={permission.id}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedPermissions.includes(permission.id)}
                      onChange={(e) => {
                        if (disabled) return;
                        if (e.target.checked) {
                          onPermissionToggle([...selectedPermissions, permission.id]);
                        } else {
                          onPermissionToggle(selectedPermissions.filter(p => p !== permission.id));
                        }
                      }}
                      disabled={disabled}
                      sx={{
                        color: roleColor,
                        '&.Mui-checked': {
                          color: roleColor,
                        }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {permission.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {permission.description}
                      </Typography>
                    </Box>
                  }
                />
              </Grid>
            ))}
          </Grid>
        </FormGroup>
      </AccordionDetails>
    </Accordion>
  );
};

const EditRoleModal = ({ open, onClose, role, permissions, onSuccess }) => {
  const theme = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [],
    color: '#3B82F6'
  });
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});

  const [updateRole, { isLoading }] = useUpdateRoleMutation();

  // Initialize form data when role changes
  useEffect(() => {
    if (role) {
      const initialData = {
        name: role.name || '',
        description: role.description || '',
        permissions: role.permissions || [],
        color: role.color || '#3B82F6'
      };
      setFormData(initialData);
      setOriginalData(initialData);
    }
  }, [role]);

  const selectedPermissionsCount = formData.permissions.length;
  const totalPermissionsCount = useMemo(() => {
    return Object.values(permissions).reduce((acc, categoryPerms) => acc + categoryPerms.length, 0);
  }, [permissions]);

  const hasChanges = useMemo(() => {
    if (!originalData) return false;
    return (
      formData.name !== originalData.name ||
      formData.description !== originalData.description ||
      formData.color !== originalData.color ||
      JSON.stringify(formData.permissions.sort()) !== JSON.stringify(originalData.permissions.sort())
    );
  }, [formData, originalData]);

  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handlePermissionToggle = (newPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: newPermissions
    }));
  };

  const handleColorChange = (color) => {
    setFormData(prev => ({
      ...prev,
      color
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Role name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Role name must be at least 2 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Role description is required';
    }

    if (formData.permissions.length === 0) {
      newErrors.permissions = 'At least one permission must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await updateRole({
        id: role.id,
        ...formData
      }).unwrap();
      
      toast.success('Role updated successfully!');
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to update role');
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
      color: '#3B82F6'
    });
    setOriginalData(null);
    setErrors({});
    onClose();
  };

  const getRoleIcon = () => {
    if (role?.id === 'SUPERADMIN') return <Crown size={20} />;
    if (role?.isSystemRole) return <Lock size={20} />;
    return <Edit size={20} />;
  };

  if (!role) {
    return null;
  }

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
                bgcolor: formData.color + '15',
                color: formData.color,
                mr: 2,
                border: `2px solid ${formData.color}20`
              }}
            >
              {getRoleIcon()}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Edit Role: {role.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {role.isSystemRole ? 'System Role - Limited editing' : 'Custom Role - Full editing'}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 0 }}>
        {role.isSystemRole && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'start' }}>
              <AlertTriangle size={16} style={{ marginRight: 8, marginTop: 2 }} />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  System Role Restrictions
                </Typography>
                <Typography variant="body2">
                  This is a system role with predefined permissions that ensure proper system functionality.
                  Only SuperAdmin can modify system role permissions.
                </Typography>
              </Box>
            </Box>
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: 'fit-content', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <Settings size={20} style={{ marginRight: 8 }} />
                Basic Information
              </Typography>
              
              <TextField
                fullWidth
                label="Role Name"
                value={formData.name}
                onChange={handleInputChange('name')}
                error={!!errors.name}
                helperText={errors.name}
                sx={{ mb: 2 }}
                disabled={role.isSystemRole}
              />

              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={handleInputChange('description')}
                error={!!errors.description}
                helperText={errors.description}
                multiline
                rows={3}
                sx={{ mb: 2 }}
                disabled={role.isSystemRole}
              />

              {!role.isSystemRole && (
                <ColorPicker
                  selectedColor={formData.color}
                  onColorChange={handleColorChange}
                />
              )}

              {/* Changes Summary */}
              {hasChanges && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'warning.main' }}>
                    Pending Changes
                  </Typography>
                  <Card sx={{ border: `1px solid ${theme.palette.warning.main}` }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="body2" color="textSecondary">
                        You have unsaved changes to this role. Review your modifications and click "Update Role" to save.
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {/* Role Preview */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Preview
                </Typography>
                <Card sx={{ border: `2px solid ${formData.color}20` }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Avatar
                        sx={{
                          bgcolor: formData.color + '15',
                          color: formData.color,
                          width: 32,
                          height: 32,
                          mr: 1.5
                        }}
                      >
                        <Shield size={16} />
                      </Avatar>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: formData.color }}>
                        {formData.name || 'Role Name'}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.8rem' }}>
                      {formData.description || 'Role description...'}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="caption">
                        {selectedPermissionsCount} permissions
                      </Typography>
                      <Chip 
                        label={role.isSystemRole ? 'System' : 'Custom'} 
                        size="small" 
                        variant="outlined" 
                        color={role.isSystemRole ? 'primary' : 'secondary'} 
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            </Paper>
          </Grid>

          {/* Permissions */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  <Key size={20} style={{ marginRight: 8 }} />
                  Permissions
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={`${selectedPermissionsCount} / ${totalPermissionsCount} selected`}
                    color={selectedPermissionsCount > 0 ? 'primary' : 'default'}
                    variant="outlined"
                  />
                  {!role.isSystemRole && (
                    <Button
                      size="small"
                      onClick={() => handlePermissionToggle([])}
                      disabled={selectedPermissionsCount === 0}
                    >
                      Clear All
                    </Button>
                  )}
                </Box>
              </Box>

              {errors.permissions && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {errors.permissions}
                </Alert>
              )}

              {!role.isSystemRole && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'start' }}>
                    <Info size={16} style={{ marginRight: 8, marginTop: 2 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Permission Guidelines
                      </Typography>
                      <Typography variant="body2">
                        Modify permissions carefully. Users with this role will be able to perform all selected actions.
                        Changes will affect all users currently assigned to this role.
                      </Typography>
                    </Box>
                  </Box>
                </Alert>
              )}

              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {Object.entries(permissions).map(([category, categoryPermissions]) => (
                  <PermissionCategory
                    key={category}
                    category={category}
                    permissions={categoryPermissions}
                    selectedPermissions={formData.permissions}
                    onPermissionToggle={handlePermissionToggle}
                    roleColor={formData.color}
                    disabled={role.isSystemRole}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        
        {!role.isSystemRole && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || !hasChanges}
            sx={{
              bgcolor: formData.color,
              '&:hover': {
                bgcolor: formData.color + 'DD'
              },
              textTransform: 'none',
              fontWeight: 600
            }}
            startIcon={isLoading ? <CircularProgress size={16} /> : <Edit size={16} />}
          >
            {isLoading ? 'Updating...' : 'Update Role'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EditRoleModal;
