import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Bell,
  X,
  Calendar,
  Info
} from 'lucide-react';
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';

const DepartmentStatusNotifications = ({ userId, departmentId, className = '' }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set());

  useEffect(() => {
    if (userId) {
      fetchDepartmentNotifications();
    }
  }, [userId, departmentId]);

  const fetchDepartmentNotifications = async () => {
    try {
      setLoading(true);

      const endpoint = departmentId
        ? `/api/departments/notifications/${departmentId}`
        : '/api/departments/notifications/my-department';

      const response = await axiosInstance.get(endpoint);
      const notificationsData = response.data?.data || [];
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Error fetching department notifications:', error);
      // Don't show error toast for this as it might be called frequently
    } finally {
      setLoading(false);
    }
  };

  const dismissNotification = (notificationIndex) => {
    setDismissedNotifications(prev => new Set([...prev, notificationIndex]));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'ERROR':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'SUCCESS':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'INFO':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'ERROR':
        return 'bg-red-50 border-red-200';
      case 'SUCCESS':
        return 'bg-green-50 border-green-200';
      case 'WARNING':
        return 'bg-yellow-50 border-yellow-200';
      case 'INFO':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getNotificationTextColor = (type) => {
    switch (type) {
      case 'ERROR':
        return 'text-red-800';
      case 'SUCCESS':
        return 'text-green-800';
      case 'WARNING':
        return 'text-yellow-800';
      case 'INFO':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const visibleNotifications = notifications.filter((_, index) =>
    !dismissedNotifications.has(index)
  );

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {visibleNotifications.map((notification, index) => (
        <Alert
          key={index}
          className={`${getNotificationColor(notification.type)} transition-all duration-300 ${notification.urgent ? 'border-2' : ''
            }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {getNotificationIcon(notification.type)}
              <div className="flex-1">
                <AlertTitle className={`text-sm font-semibold ${getNotificationTextColor(notification.type)}`}>
                  {notification.title}
                </AlertTitle>
                <AlertDescription className={`mt-1 text-sm ${getNotificationTextColor(notification.type)}`}>
                  {notification.message}
                </AlertDescription>

                {notification.metadata && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {notification.metadata.departmentName && (
                      <Badge variant="outline" className="text-xs">
                        Department: {notification.metadata.departmentName}
                      </Badge>
                    )}
                    {notification.metadata.courseTitle && (
                      <Badge variant="outline" className="text-xs">
                        Course: {notification.metadata.courseTitle}
                      </Badge>
                    )}
                    {notification.metadata.oldStatus && notification.metadata.newStatus && (
                      <Badge variant="outline" className="text-xs">
                        {notification.metadata.oldStatus} → {notification.metadata.newStatus}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-gray-200"
              onClick={() => dismissNotification(index)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
};

// Helper component for department status summary
export const DepartmentStatusSummary = ({ departmentId, refreshTrigger }) => {
  const [statusInfo, setStatusInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (departmentId) {
      fetchDepartmentStatusInfo();
    }
  }, [departmentId, refreshTrigger]);

  const fetchDepartmentStatusInfo = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/departments/status/${departmentId}/info`);
      setStatusInfo(response.data?.data);
    } catch (error) {
      console.error('Error fetching department status info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !statusInfo) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { department, statusCalculation, timeline } = statusInfo;
  const isStatusAccurate = statusCalculation.isStatusAccurate;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Department Status Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Current Status</p>
            <Badge
              variant={department.status === 'CANCELLED' ? 'destructive' : 'default'}
              className="mt-1"
            >
              {department.status}
            </Badge>
          </div>

          <div>
            <p className="text-xs text-gray-500">Calculated Status</p>
            <Badge
              variant={statusCalculation.calculatedStatus === 'CANCELLED' ? 'destructive' : 'secondary'}
              className="mt-1"
            >
              {statusCalculation.calculatedStatus}
            </Badge>
          </div>
        </div>

        {!isStatusAccurate && (
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-xs">
              Status needs to be updated based on dates
            </AlertDescription>
          </Alert>
        )}

        {timeline.daysUntilStart !== null && (
          <div className="text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {timeline.daysUntilStart > 0
                ? `Starts in ${timeline.daysUntilStart} days`
                : timeline.daysUntilStart === 0
                  ? "Starts today"
                  : `Started ${Math.abs(timeline.daysUntilStart)} days ago`
              }
            </div>
          </div>
        )}

        {timeline.daysUntilEnd !== null && (
          <div className="text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeline.daysUntilEnd > 0
                ? `Ends in ${timeline.daysUntilEnd} days`
                : timeline.daysUntilEnd === 0
                  ? "Ends today"
                  : `Ended ${Math.abs(timeline.daysUntilEnd)} days ago`
              }
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DepartmentStatusNotifications;
