import React from 'react';
import { Link } from 'react-router-dom';
import { useGetAllAuditsQuery } from '@/Redux/AllApi/AuditApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconActivity } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";

const RecentActivityCard = () => {
  const { t } = useTranslate();
  const { data: auditsData, isLoading: auditsLoading } = useGetAllAuditsQuery({
    page: 1,
    limit: 10
  });

  const recentActivities = auditsData?.data?.audits || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <IconActivity className="h-5 w-5" />
            {t('home.recentActivity')}
          </CardTitle>
          <CardDescription>{t('home.latestSystemEvents')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/analytics">{t('home.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {auditsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recentActivities.length > 0 ? (
          <div className="space-y-4">
            {recentActivities.slice(0, 5).map((activity, index) => (
              <div key={activity._id || index} className="flex items-start space-x-3">
                <div className="h-2 w-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">
                    {activity.action || t('home.systemActivity')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.user?.fullName || 'System'} • {new Date(activity.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {activity.action?.split(' ')[0] || t('home.activity')}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <IconActivity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>{t('home.noRecentActivity')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityCard;
