import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Avatar,
  CircularProgress,
  Alert
} from '@mui/material';
import useTranslate from "@/hooks/useTranslate";
import {
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { useTheme } from '@mui/material/styles';

const getSeverityConfig = (severity) => {
  const configs = {
    error: {
      color: '#EF4444',
      bgColor: '#FEF2F2',
      icon: <XCircle size={24} />
    },
    warning: {
      color: '#F59E0B',
      bgColor: '#FFFBEB',
      icon: <AlertTriangle size={24} />
    },
    info: {
      color: '#3B82F6',
      bgColor: '#EFF6FF',
      icon: <Info size={24} />
    },
    success: {
      color: '#10B981',
      bgColor: '#F0FDF4',
      icon: <CheckCircle size={24} />
    },
    question: {
      color: '#6B7280',
      bgColor: '#F9FAFB',
      icon: <HelpCircle size={24} />
    }
  };

  return configs[severity] || configs.question;
};

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  severity = 'warning',
  loading = false,
  disabled = false,
  maxWidth = 'sm',
  fullWidth = true
}) => {
  const theme = useTheme();
  const { t } = useTranslate();
  const severityConfig = getSeverityConfig(severity);

  const handleConfirm = () => {
    if (!loading && !disabled) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            sx={{
              bgcolor: severityConfig.bgColor,
              color: severityConfig.color,
              mr: 2,
              width: 48,
              height: 48
            }}
          >
            {severityConfig.icon}
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title || t('dialog.confirmTitle')}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
          {typeof message === 'string' ? (message || t('dialog.confirmMessage')) : <Box>{message}</Box>}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={handleCancel}
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          {cancelText || t('dialog.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={loading || disabled}
          sx={{
            bgcolor: severityConfig.color,
            '&:hover': {
              bgcolor: severityConfig.color + 'DD'
            },
            textTransform: 'none',
            fontWeight: 600
          }}
          startIcon={loading && <CircularProgress size={16} />}
        >
          {loading ? t('dialog.processing') : (confirmText || t('dialog.confirm'))}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
