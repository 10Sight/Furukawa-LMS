import React, { useState } from 'react';
import { Bell, X, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useSocket } from '../../contexts/SocketContext';
import { formatDistanceToNow } from 'date-fns';
import useTranslate from '@/hooks/useTranslate';

const NotificationCenter = () => {
    const { notifications, isConnected, clearNotifications, removeNotification } = useSocket();
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslate();

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'quiz-started':
            case 'assignment-created':
                return <Info className="h-4 w-4 text-blue-500" />;
            case 'quiz-submitted':
            case 'assignment-submitted':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'grade-updated':
                return <AlertCircle className="h-4 w-4 text-orange-500" />;
            case 'announcement':
                return <Bell className="h-4 w-4 text-purple-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-500" />;
        }
    };

    const getNotificationStyle = (type) => {
        switch (type) {
            case 'quiz-started':
            case 'assignment-created':
                return 'border-l-4 border-blue-500 bg-blue-50';
            case 'quiz-submitted':
            case 'assignment-submitted':
                return 'border-l-4 border-green-500 bg-green-50';
            case 'grade-updated':
                return 'border-l-4 border-orange-500 bg-orange-50';
            case 'announcement':
                return 'border-l-4 border-purple-500 bg-purple-50';
            default:
                return 'border-l-4 border-gray-500 bg-gray-50';
        }
    };

    return (
        <div className="relative">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="relative p-2"
                    >
                        <Bell className={`h-5 w-5 ${isConnected ? 'text-green-600' : 'text-gray-400'}`} />
                        {notifications.length > 0 && (
                            <Badge
                                variant="destructive"
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                            >
                                {notifications.length > 9 ? '9+' : notifications.length}
                            </Badge>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                    <Card className="border-0 shadow-lg">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">
                                    {t('notify.title')}
                                    <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({notifications.length})
                                    </span>
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <span className="text-xs text-gray-500">
                                        {isConnected ? t('notify.connected') : t('notify.disconnected')}
                                    </span>
                                    {notifications.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearNotifications}
                                            className="text-xs px-2 py-1 h-auto"
                                        >
                                            {t('notify.clearAll')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-96 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500">
                                        <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                        <p className="text-sm">{t('notify.emptyTitle')}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {t('notify.emptyDescription')}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {notifications.map((notification, index) => (
                                            <div
                                                key={`${notification.timestamp}-${index}`}
                                                className={`p-4 hover:bg-gray-50 transition-colors ${getNotificationStyle(notification.type)}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        {getNotificationIcon(notification.type)}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 leading-tight">
                                                                {notification.message}
                                                            </p>
                                                            {notification.from && (
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    {t('notify.from')} {notification.from}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                                                            </p>
                                                            {/* Additional info based on notification type */}
                                                            {notification.quiz && (
                                                                <p className="text-xs text-blue-600 mt-1">
                                                                    {t('notify.quiz')} {notification.quiz.title}
                                                                </p>
                                                            )}
                                                            {notification.assignment && (
                                                                <p className="text-xs text-blue-600 mt-1">
                                                                    {t('notify.assignment')} {notification.assignment.title}
                                                                </p>
                                                            )}
                                                            {notification.grade && (
                                                                <p className="text-xs text-orange-600 mt-1">
                                                                    {t('notify.score')} {notification.grade.score || 'N/A'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeNotification(index)}
                                                        className="p-1 h-auto text-gray-400 hover:text-gray-600"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default NotificationCenter;
