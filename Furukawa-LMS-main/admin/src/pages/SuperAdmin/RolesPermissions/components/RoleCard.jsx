import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Shield,
  Users,
  Edit,
  Delete,
  Eye,
  MoreVertical,
  Crown,
  Key,
  UserCheck,
  Lock
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@mui/material/styles';

const RoleCard = ({ role, onEdit, onDelete, onViewUsers }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);

  const getRoleColorAndIcon = (role) => {
    if (role.color) {
      return { color: role.color, icon: <Shield size={20} /> };
    }

    // Default colors based on role type
    const colors = {
      STUDENT: { color: '#3B82F6', icon: <UserCheck size={20} /> },
      INSTRUCTOR: { color: '#10B981', icon: <Key size={20} /> },
      ADMIN: { color: '#F59E0B', icon: <Shield size={20} /> },
      SUPERADMIN: { color: '#EF4444', icon: <Crown size={20} /> }
    };

    return colors[role.id] || { color: '#6B7280', icon: <Shield size={20} /> };
  };

  const { color: roleColor, icon: roleIcon } = getRoleColorAndIcon(role);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    handleMenuClose();
    onEdit();
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete();
  };

  const handleViewUsers = () => {
    handleMenuClose();
    onViewUsers();
  };

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        transition: 'all 0.3s ease',
        border: `2px solid transparent`,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
          borderColor: roleColor + '20'
        },
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
          : `linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)`,
      }}
    >
      {/* Role Type Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1
        }}
      >
        <Chip
          label={role.isSystemRole ? 'System' : 'Custom'}
          size="small"
          variant={role.isSystemRole ? 'filled' : 'outlined'}
          color={role.isSystemRole ? 'primary' : 'secondary'}
          sx={{
            fontSize: '0.75rem',
            height: 20,
            fontWeight: 600
          }}
        />
      </Box>

      <CardContent sx={{ pb: 1 }}>
        {/* Role Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2, pr: 6 }}>
          <Avatar
            sx={{
              bgcolor: roleColor + '15',
              color: roleColor,
              width: 48,
              height: 48,
              mr: 2,
              border: `2px solid ${roleColor}20`
            }}
          >
            {roleIcon}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 0.5,
                color: roleColor,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {role.name}
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              sx={{
                lineHeight: 1.4,
                display: '-webkit-box',
                '-webkit-line-clamp': 2,
                '-webkit-box-orient': 'vertical',
                overflow: 'hidden'
              }}
            >
              {role.description}
            </Typography>
          </Box>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
              {role.permissions?.length || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Permissions
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
              {role.userCount || 0}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Users
            </Typography>
          </Box>
        </Box>

        {/* Permission Preview */}
        <Box>
          <Typography variant="caption" color="textSecondary" sx={{ mb: 1, display: 'block' }}>
            Key Permissions:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(role.permissions || []).slice(0, 3).map((permission, index) => (
              <Chip
                key={index}
                label={permission.split(':')[1] || permission}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.7rem',
                  height: 20,
                  borderColor: roleColor + '40',
                  color: roleColor,
                  '& .MuiChip-label': {
                    px: 1
                  }
                }}
              />
            ))}
            {(role.permissions || []).length > 3 && (
              <Chip
                label={`+${role.permissions.length - 3} more`}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.7rem',
                  height: 20,
                  borderColor: theme.palette.divider,
                  color: 'textSecondary',
                  '& .MuiChip-label': {
                    px: 1
                  }
                }}
              />
            )}
          </Box>
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0, px: 2, pb: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="View Users">
            <IconButton
              size="small"
              onClick={handleViewUsers}
              sx={{
                color: theme.palette.info.main,
                '&:hover': {
                  bgcolor: theme.palette.info.main + '10'
                }
              }}
            >
              <Eye size={16} />
            </IconButton>
          </Tooltip>

          {!role.isSystemRole && (
            <Tooltip title="Edit Role">
              <IconButton
                size="small"
                onClick={handleEdit}
                sx={{
                  color: theme.palette.warning.main,
                  '&:hover': {
                    bgcolor: theme.palette.warning.main + '10'
                  }
                }}
              >
                <Edit size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box>
          <Tooltip title="More Actions">
            <IconButton
              size="small"
              onClick={handleMenuOpen}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  bgcolor: theme.palette.action.hover
                }
              }}
            >
              <MoreVertical size={16} />
            </IconButton>
          </Tooltip>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              minWidth: 180,
              borderRadius: 2,
              boxShadow: theme.shadows[8]
            }
          }}
        >
          <MenuItem onClick={handleViewUsers}>
            <ListItemIcon>
              <Users size={16} />
            </ListItemIcon>
            <ListItemText>View Users</ListItemText>
          </MenuItem>

          {!role.isSystemRole && (
            <>
              <MenuItem onClick={handleEdit}>
                <ListItemIcon>
                  <Edit size={16} />
                </ListItemIcon>
                <ListItemText>Edit Role</ListItemText>
              </MenuItem>
              
              <Divider />
              
              <MenuItem 
                onClick={handleDelete}
                sx={{ 
                  color: theme.palette.error.main,
                  '&:hover': {
                    bgcolor: theme.palette.error.main + '10'
                  }
                }}
              >
                <ListItemIcon>
                  <Delete size={16} color={theme.palette.error.main} />
                </ListItemIcon>
                <ListItemText>Delete Role</ListItemText>
              </MenuItem>
            </>
          )}

          {role.isSystemRole && (
            <MenuItem disabled>
              <ListItemIcon>
                <Lock size={16} />
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2" color="textSecondary">
                  System Role - Protected
                </Typography>
              </ListItemText>
            </MenuItem>
          )}
        </Menu>
      </CardActions>
    </Card>
  );
};

export default RoleCard;
