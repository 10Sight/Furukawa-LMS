import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  Alert
} from '@mui/material';
import {
  Matrix3x3,
  Search,
  Filter,
  Download,
  ExpandMore,
  Shield,
  Crown,
  Key,
  UserCheck,
  Check,
  X,
  Eye,
  EyeOff,
  Info
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';

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

const PermissionCell = ({ hasPermission, role, permission }) => {
  const theme = useTheme();
  const { color: roleColor } = getRoleColorAndIcon(role);

  if (hasPermission) {
    return (
      <Tooltip title={`${role.name} has ${permission.name}`}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: roleColor + '15',
            color: roleColor,
            border: `2px solid ${roleColor}`,
            cursor: 'help'
          }}
        >
          <Check size={16} />
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`${role.name} does not have ${permission.name}`}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: theme.palette.grey[100],
          color: theme.palette.grey[400],
          border: `2px solid ${theme.palette.grey[300]}`,
          cursor: 'help'
        }}
      >
        <X size={16} />
      </Box>
    </Tooltip>
  );
};

const CompactMatrix = ({ roles, permissions, searchQuery, selectedCategory }) => {
  const theme = useTheme();

  // Filter permissions based on search and category
  const filteredPermissions = useMemo(() => {
    let allPermissions = [];
    
    Object.entries(permissions).forEach(([category, categoryPerms]) => {
      if (selectedCategory && selectedCategory !== category) return;
      
      const filtered = categoryPerms.filter(perm =>
        searchQuery === '' || 
        perm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        perm.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (filtered.length > 0) {
        allPermissions.push({ category, permissions: filtered });
      }
    });
    
    return allPermissions;
  }, [permissions, searchQuery, selectedCategory]);

  return (
    <Box>
      {filteredPermissions.map(({ category, permissions: categoryPerms }) => (
        <Paper key={category} sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: theme.palette.primary.main + '10', borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
              {category}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {categoryPerms.length} permissions
            </Typography>
          </Box>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Permission</TableCell>
                  {roles.map((role) => {
                    const { color: roleColor, icon: roleIcon } = getRoleColorAndIcon(role);
                    return (
                      <TableCell key={role.id} align="center" sx={{ minWidth: 80 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <Avatar
                            sx={{
                              bgcolor: roleColor + '15',
                              color: roleColor,
                              width: 24,
                              height: 24,
                              mb: 0.5
                            }}
                          >
                            {roleIcon}
                          </Avatar>
                          <Typography variant="caption" sx={{ fontWeight: 600, textAlign: 'center' }}>
                            {role.name}
                          </Typography>
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {categoryPerms.map((permission) => (
                  <TableRow key={permission.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {permission.name}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {permission.description}
                        </Typography>
                      </Box>
                    </TableCell>
                    {roles.map((role) => (
                      <TableCell key={role.id} align="center">
                        <PermissionCell
                          hasPermission={role.permissions?.includes(permission.id)}
                          role={role}
                          permission={permission}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}
      
      {filteredPermissions.length === 0 && (
        <Alert severity="info">
          No permissions found matching your search criteria.
        </Alert>
      )}
    </Box>
  );
};

const RoleSummaryCards = ({ roles, permissions }) => {
  return (
    <Grid container spacing={3}>
      {roles.map((role) => {
        const { color: roleColor, icon: roleIcon } = getRoleColorAndIcon(role);
        const rolePermissionCount = role.permissions?.length || 0;
        const totalPermissions = Object.values(permissions).reduce((acc, categoryPerms) => acc + categoryPerms.length, 0);
        const coveragePercentage = totalPermissions > 0 ? Math.round((rolePermissionCount / totalPermissions) * 100) : 0;

        return (
          <Grid item xs={12} sm={6} md={3} key={role.id}>
            <Card sx={{ border: `2px solid ${roleColor}20` }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Avatar
                  sx={{
                    bgcolor: roleColor + '15',
                    color: roleColor,
                    width: 48,
                    height: 48,
                    mx: 'auto',
                    mb: 2
                  }}
                >
                  {roleIcon}
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 600, color: roleColor, mb: 1 }}>
                  {role.name}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {rolePermissionCount}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                  permissions
                </Typography>
                <Chip
                  label={`${coveragePercentage}% coverage`}
                  size="small"
                  color={coveragePercentage > 75 ? 'success' : coveragePercentage > 50 ? 'warning' : 'error'}
                  variant="outlined"
                />
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={role.isSystemRole ? 'System' : 'Custom'}
                    size="small"
                    color={role.isSystemRole ? 'primary' : 'secondary'}
                    variant="filled"
                    sx={{ fontSize: '0.7rem', height: 18 }}
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

const PermissionMatrix = ({ roles, permissions }) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('compact'); // 'compact' | 'summary'

  const handleExport = () => {
    // In a real implementation, this would generate a CSV/Excel export
    console.log('Exporting permission matrix...');
  };

  const totalPermissions = useMemo(() => {
    return Object.values(permissions).reduce((acc, categoryPerms) => acc + categoryPerms.length, 0);
  }, [permissions]);

  const permissionCategories = Object.keys(permissions);

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar
              sx={{
                bgcolor: theme.palette.primary.main + '15',
                color: theme.palette.primary.main,
                mr: 2
              }}
            >
              <Matrix3x3 size={20} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Permission Matrix
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Visual overview of role permissions across the system
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={viewMode === 'summary' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('summary')}
              sx={{ textTransform: 'none' }}
            >
              Summary
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setViewMode('compact')}
              sx={{ textTransform: 'none' }}
            >
              Matrix
            </Button>
            <Tooltip title="Export Matrix">
              <IconButton onClick={handleExport}>
                <Download size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stats */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                {roles.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Roles
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                {totalPermissions}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Permissions
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
                {permissionCategories.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Categories
              </Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Card sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>
                {roles.filter(r => !r.isSystemRole).length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Custom Roles
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* View Mode: Summary */}
      {viewMode === 'summary' && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Role Permission Summary
          </Typography>
          <RoleSummaryCards roles={roles} permissions={permissions} />
        </Box>
      )}

      {/* View Mode: Matrix */}
      {viewMode === 'compact' && (
        <Box>
          {/* Filters */}
          <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                placeholder="Search permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: <Search size={20} style={{ marginRight: 8 }} />
                }}
              />
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Category Filter</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label="Category Filter"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {permissionCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* Legend */}
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: theme.palette.background.default }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Legend
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: theme.palette.success.main + '15',
                    color: theme.palette.success.main,
                    border: `2px solid ${theme.palette.success.main}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Check size={12} />
                </Box>
                <Typography variant="body2">Has Permission</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: theme.palette.grey[100],
                    color: theme.palette.grey[400],
                    border: `2px solid ${theme.palette.grey[300]}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={12} />
                </Box>
                <Typography variant="body2">No Permission</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Permission Matrix */}
          <CompactMatrix
            roles={roles}
            permissions={permissions}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
          />
        </Box>
      )}

      {/* Info Alert */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'start' }}>
          <Info size={16} style={{ marginRight: 8, marginTop: 2 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Permission Matrix Guide
            </Typography>
            <Typography variant="body2">
              This matrix shows which permissions each role has across all system categories. 
              Use the search and filter options to narrow down specific permissions. 
              System roles have predefined permissions, while custom roles can be modified.
            </Typography>
          </Box>
        </Box>
      </Alert>
    </Box>
  );
};

export default PermissionMatrix;
