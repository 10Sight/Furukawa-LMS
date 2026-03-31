import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  IconUsers,
  IconCertificate,
  IconFolder,
  IconChartLine,
  IconShield,
  IconAlertTriangle,
  IconActivity,
  IconDatabase,
  IconEye,
  IconTrash,
  IconClock,
  IconTrendingUp,
  IconServer,
  IconBellRinging,
  IconFileAnalytics,
  IconUserCheck,
  IconUserX,
  IconBookmark,
  IconRefresh
} from "@tabler/icons-react";
import { useGetDashboardStatsQuery } from "@/Redux/AllApi/index";
import { useGetAllUsersQuery } from "@/Redux/AllApi/SuperAdminApi";
import { useGetAllAuditLogsQuery } from "@/Redux/AllApi/SuperAdminApi";
import { toast } from "sonner";

// shadcn/ui components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // API calls
  const {
    data: dashboardStatsData,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats
  } = useGetDashboardStatsQuery();

  const {
    data: usersData,
    isLoading: usersLoading
  } = useGetAllUsersQuery({ limit: 10 });

  const {
    data: auditData,
    isLoading: auditLoading
  } = useGetAllAuditLogsQuery({ limit: 5 });

  // Derived state from API data
  const systemStats = dashboardStatsData?.data || {
    totals: { students: 0, instructors: 0, courses: 0, departments: 0 },
    active: { students: 0, departments: 0, publishedCourses: 0 },
    engagement: { studentEngagement: 0, departmentUtilization: 0, courseCompletion: 0 },
    recentActivitiesCount: 0
  };

  const recentActivities = auditData?.data?.audits?.map(audit => ({
    id: audit._id,
    user: audit.user?.fullName || "Unknown User",
    action: audit.action,
    target: audit.details?.target || audit.resource || "System",
    time: new Date(audit.createdAt).toLocaleString(),
    severity: audit.severity || "info"
  })) || [];

  const quickActions = [
    {
      title: "Create User",
      description: "Add new user to system",
      icon: IconUsers,
      action: () => navigate("/superadmin/all-users"),
      color: "bg-blue-500"
    },
    {
      title: "View Audit Logs",
      description: "Monitor system activities",
      icon: IconFileAnalytics,
      action: () => navigate("/superadmin/audit-logs"),
      color: "bg-purple-500"
    },
    {
      title: "System Settings",
      description: "Configure system parameters",
      icon: IconShield,
      action: () => navigate("/superadmin/system-settings"),
      color: "bg-green-500"
    },
    {
      title: "Data Management",
      description: "Backup and restore data",
      icon: IconDatabase,
      action: () => navigate("/superadmin/data-management"),
      color: "bg-orange-500"
    }
  ];

  const StatCard = ({ title, value, subtitle, icon: Icon, trend }) => (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center mt-2 text-sm ${trend.type === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                <IconTrendingUp className="w-4 h-4 mr-1" />
                <span>{trend.value} {trend.label}</span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <Icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const QuickActionCard = ({ title, description, icon: Icon, action, color }) => (
    <div
      onClick={action}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start space-x-3">
        <div className={`${color} text-white p-2 rounded-lg group-hover:scale-105 transition-transform`}>
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );

  const ActivityItem = ({ activity }) => {
    const severityColors = {
      success: 'text-green-600 bg-green-50',
      warning: 'text-orange-600 bg-orange-50',
      error: 'text-red-600 bg-red-50',
      info: 'text-blue-600 bg-blue-50'
    };

    return (
      <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
        <div className={`w-2 h-2 rounded-full mt-2 ${severityColors[activity.severity]?.replace('text-', 'bg-').replace('-600', '-500')}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900">
            <span className="font-medium">{activity.user}</span>{' '}
            {activity.action}{' '}
            <span className="font-medium">{activity.target}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.fullName || 'Administrator'}. Here's what's happening with your system today.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => refetchStats()}
            variant="outline"
            disabled={statsLoading}
            className="flex items-center space-x-2"
          >
            <IconRefresh className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
            System Healthy
          </Badge>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          <div className="col-span-4 flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : statsError ? (
          <div className="col-span-4 text-center py-8 text-red-600">
            Failed to load statistics
          </div>
        ) : (
          <>
            <StatCard
              title="Total Users"
              value={(systemStats.totals.students + systemStats.totals.instructors + systemStats.totals.courses).toLocaleString()}
              subtitle={`${systemStats.active.students} active students`}
              icon={IconUsers}
              trend={{ type: 'positive', value: `${systemStats.engagement.studentEngagement}%`, label: 'engagement rate' }}
            />
            <StatCard
              title="Total Courses"
              value={systemStats.totals.courses}
              subtitle={`${systemStats.active.publishedCourses} published`}
              icon={IconCertificate}
              trend={{ type: 'positive', value: `${systemStats.engagement.courseCompletion}%`, label: 'completion rate' }}
            />
            <StatCard
              title="Active Sections"
              value={systemStats.totals.departments}
              subtitle={`${systemStats.active.departments} currently active`}
              icon={IconFolder}
              trend={{ type: 'positive', value: `${systemStats.engagement.departmentUtilization || 0}%`, label: 'utilization rate' }}
            />
            <StatCard
              title="System Health"
              value="98.5%"
              subtitle="All systems operational"
              icon={IconActivity}
              trend={{ type: 'positive', value: '+0.5%', label: 'uptime improvement' }}
            />
          </>
        )}
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">System Overview</CardTitle>
              <Link
                to="/superadmin/system-monitoring"
                className="text-sm text-primary hover:underline font-medium"
              >
                View Details →
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Storage Usage</span>
                    <span className="text-sm font-semibold">85.2%</span>
                  </div>
                  <Progress value={85.2} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">API Response Time</span>
                    <span className="text-sm font-semibold">120ms</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <IconServer className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">Excellent</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            <IconBellRinging className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickActions.map((action, index) => (
                <QuickActionCard key={index} {...action} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities and System Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">Recent Activities</CardTitle>
            <Link
              to="/superadmin/audit-logs"
              className="text-sm text-primary hover:underline font-medium"
            >
              View All →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              {auditLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No recent activities
                </div>
              ) : (
                recentActivities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold">User Statistics</CardTitle>
            <Link
              to="/superadmin/analytics-reports"
              className="text-sm text-primary hover:underline font-medium"
            >
              Detailed Report →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <IconUserCheck className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">Active Operators</span>
                </div>
                <Badge variant="outline">{systemStats.active.students}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <IconUsers className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium">Total Trainers</span>
                </div>
                <Badge variant="outline">{systemStats.totals.instructors}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <IconBookmark className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium">Total Operators</span>
                </div>
                <Badge variant="outline">{systemStats.totals.students}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <IconActivity className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium">Recent Activities</span>
                </div>
                <Badge variant="outline" className="text-red-600 border-red-200">{systemStats.recentActivitiesCount}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          to="/superadmin/all-users"
          className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6 hover:from-blue-100 hover:to-blue-200 transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 text-white p-3 rounded-lg group-hover:scale-105 transition-transform">
              <IconUsers className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">User Management</h3>
              <p className="text-sm text-gray-600">Manage all users and permissions</p>
            </div>
          </div>
        </Link>

        <Link
          to="/superadmin/courses"
          className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6 hover:from-green-100 hover:to-green-200 transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-green-600 text-white p-3 rounded-lg group-hover:scale-105 transition-transform">
              <IconCertificate className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-green-700">Course Management</h3>
              <p className="text-sm text-gray-600">Manage courses and content</p>
            </div>
          </div>
        </Link>

        <Link
          to="/superadmin/system-settings"
          className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6 hover:from-purple-100 hover:to-purple-200 transition-all duration-200 group"
        >
          <div className="flex items-center space-x-4">
            <div className="bg-purple-600 text-white p-3 rounded-lg group-hover:scale-105 transition-transform">
              <IconShield className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-purple-700">System Settings</h3>
              <p className="text-sm text-gray-600">Configure system parameters</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;


