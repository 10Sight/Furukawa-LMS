import React from 'react';
import { IconAlertTriangle, IconLock, IconClock } from '@tabler/icons-react';

const AccountStatusNotification = ({ status, fullScreen = false }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING':
        return {
          icon: IconClock,
          title: 'Account Pending Approval',
          message: 'Your account is currently pending approval. You can only access your profile page at this time. Please contact your instructor for more information.',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-600',
          titleColor: 'text-yellow-800',
          messageColor: 'text-yellow-700',
        };
      case 'SUSPENDED':
        return {
          icon: IconAlertTriangle,
          title: 'Account Suspended',
          message: 'Your account has been suspended. Please contact your instructor for more information.',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          iconColor: 'text-orange-600',
          titleColor: 'text-orange-800',
          messageColor: 'text-orange-700',
        };
      case 'BANNED':
        return {
          icon: IconLock,
          title: 'Account Banned',
          message: 'Your account has been banned. Please contact your instructor for more information.',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          iconColor: 'text-red-600',
          titleColor: 'text-red-800',
          messageColor: 'text-red-700',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const { icon: Icon, title, message, bgColor, borderColor, iconColor, titleColor, messageColor } = config;

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className={`max-w-md w-full ${bgColor} ${borderColor} border-2 rounded-xl shadow-lg p-8 text-center`}>
          <div className="flex justify-center mb-6">
            <Icon className={`w-16 h-16 ${iconColor}`} strokeWidth={1.5} />
          </div>
          <h1 className={`text-2xl font-bold ${titleColor} mb-4`}>
            {title}
          </h1>
          <p className={`${messageColor} leading-relaxed mb-6`}>
            {message}
          </p>
          <div className={`${borderColor} border-t pt-4`}>
            <p className="text-sm text-gray-600">
              Need help? Contact your instructor or administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgColor} ${borderColor} border rounded-lg p-4 mb-6`}>
      <div className="flex items-start space-x-3">
        <Icon className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} strokeWidth={1.5} />
        <div className="flex-1">
          <h3 className={`font-medium ${titleColor} mb-1`}>
            {title}
          </h3>
          <p className={`text-sm ${messageColor}`}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountStatusNotification;
