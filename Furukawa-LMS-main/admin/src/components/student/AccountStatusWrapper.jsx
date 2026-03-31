import React from 'react';
import { useSelector } from 'react-redux';
import AccountStatusNotification from './AccountStatusNotification';

const AccountStatusWrapper = ({ children, allowPending = false, pageName = '' }) => {
  const { user } = useSelector((state) => state.auth);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Only apply restrictions to STUDENT role
  if (user.role !== 'STUDENT') {
    return children;
  }

  // Check account status
  switch (user.status) {
    case 'ACTIVE':
    case 'PRESENT':
      // Active users have full access
      return children;

    case 'PENDING':
    case 'ON_LEAVE':
      // Pending users can only access certain pages (like profile)
      if (allowPending) {
        return (
          <>
            <AccountStatusNotification status={user.status} />
            {children}
          </>
        );
      }
      // For restricted pages, show full-screen notification
      return <AccountStatusNotification status={user.status} fullScreen />;

    case 'SUSPENDED':
    case 'BANNED':
    case 'ABSENT':
      // Suspended and banned users cannot access any pages
      return <AccountStatusNotification status={user.status} fullScreen />;

    default:
      // Unknown status, allow access but show warning
      return (
        <>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0">⚠</div>
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800 mb-1">Unknown Account Status</h3>
                <p className="text-sm text-yellow-700">
                  Your account status is unrecognized. Please contact your administrator.
                </p>
              </div>
            </div>
          </div>
          {children}
        </>
      );
  }
};

export default AccountStatusWrapper;
