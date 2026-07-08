import React, { useState } from 'react';
import { useGetAllAuditsQuery } from '@/Redux/AllApi/AuditApi';
import { useGetAllInstructorsQuery, useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetCoursesQuery } from '@/Redux/AllApi/CourseApi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLazyExportAuditStatsQuery } from "@/Redux/AllApi/AnalyticsApi";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconActivity,
  IconUsers,
  IconSchool,
  IconCalendar,
  IconBook,
  IconTrendingUp,
  IconClock
} from "@tabler/icons-react";

const Analytics = ({ pageName = "Recent Activity" }) => {
  const navigate = useNavigate();
  const [auditGroupBy, setAuditGroupBy] = useState('month');
  const [triggerExportAuditStats, { isFetching: isExportingAudit }] = useLazyExportAuditStatsQuery();
  const { data: auditsData, isLoading: auditsLoading } = useGetAllAuditsQuery({
    page: 1,
    limit: 900
  });
  const { data: studentsData } = useGetAllStudentsQuery();
  const { data: instructorsData } = useGetAllInstructorsQuery();
  const { data: departmentsData } = useGetAllDepartmentsQuery();
  const { data: coursesData } = useGetCoursesQuery({
    page: 1,
    limit: 1000,
    search: "",
    category: "",
    status: ""
  });

  const activities = auditsData?.data?.audits || [];
  const totalActivities = auditsData?.data?.pagination?.total || 0;

  // Calculate some basic stats
  const totalStudents = studentsData?.data?.totalUsers || 0;
  const totalInstructors = instructorsData?.data?.totalUsers || 0;
  const totalDepartments = departmentsData?.data?.totalDepartments || 0;
  const totalCourses = coursesData?.data?.total || 0;

  const getActivityIcon = (action) => {
    const lowerAction = action?.toLowerCase() || '';
    if (lowerAction.includes('login')) return IconUsers;
    if (lowerAction.includes('course')) return IconBook;
    if (lowerAction.includes('department')) return IconCalendar; // Using Calendar for Department for now
    if (lowerAction.includes('instructor')) return IconSchool;
    return IconActivity;
  };

  const getActivityColor = (action) => {
    const lowerAction = action?.toLowerCase() || '';
    if (lowerAction.includes('create') || lowerAction.includes('add')) return 'text-green-600';
    if (lowerAction.includes('update') || lowerAction.includes('edit')) return 'text-blue-600';
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) return 'text-red-600';
    if (lowerAction.includes('login')) return 'text-purple-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageName}</h1>
          <p className="text-gray-600">Recent system activity and monitoring</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="border rounded px-2 py-1 text-sm" value={auditGroupBy} onChange={e => setAuditGroupBy(e.target.value)}>
            <option value="month">Audit by Month</option>
            <option value="year">Audit by Year</option>
          </select>
          <Button
            variant="outline"
            disabled={isExportingAudit}
            onClick={async () => {
              const { data } = await triggerExportAuditStats({ groupBy: auditGroupBy, format: 'excel' });
              const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `audit_stats_${auditGroupBy}.xlsx`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
            }}
          >Export Audit (Excel)</Button>
          <Button
            variant="outline"
            disabled={isExportingAudit}
            onClick={async () => {
              const { data } = await triggerExportAuditStats({ groupBy: auditGroupBy, format: 'pdf' });
              const blob = new Blob([data], { type: 'application/pdf' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `audit_stats_${auditGroupBy}.pdf`; document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
            }}
          >Export Audit (PDF)</Button>
          <Button onClick={() => navigate('/admin/exam-history')}>Exam History</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                <p className="text-2xl font-bold text-gray-900">{totalActivities}</p>
              </div>
              <IconActivity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Students</p>
                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              </div>
              <IconUsers className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Instructors</p>
                <p className="text-2xl font-bold text-gray-900">{totalInstructors}</p>
              </div>
              <IconSchool className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Departments</p>
                <p className="text-2xl font-bold text-gray-900">{totalDepartments}</p>
              </div>
              <IconCalendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Courses</p>
                <p className="text-2xl font-bold text-gray-900">{totalCourses}</p>
              </div>
              <IconBook className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconActivity className="h-5 w-5" />
            Recent System Activities
          </CardTitle>
          <CardDescription>
            Latest {activities.length} of {totalActivities} total activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditsLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((activity, index) => {
                const ActivityIcon = getActivityIcon(activity.action);
                const activityColor = getActivityColor(activity.action);

                return (
                  <div key={activity._id || index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-gray-100 rounded-full">
                        <ActivityIcon className={`h-5 w-5 ${activityColor}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {activity.action || 'System Activity'}
                        </p>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <span>{activity.user?.fullName || 'System'}</span>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            <IconClock className="h-3 w-3" />
                            <span>{new Date(activity.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className={`${activityColor.replace('text-', 'border-').replace('-600', '-200')} ${activityColor.replace('text-', 'text-').replace('-600', '-700')}`}
                      >
                        {activity.action?.split(' ')[0] || 'Activity'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <IconActivity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No Activities Found</p>
              <p className="text-sm">System activities will appear here when available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
