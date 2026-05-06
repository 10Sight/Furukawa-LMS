import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGetAllInstructorsQuery, useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetCoursesQuery } from '@/Redux/AllApi/CourseApi';
import { useGetAllAuditsQuery } from '@/Redux/AllApi/AuditApi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  IconUsers,
  IconSchool,
  IconCalendar,
  IconBook,
  IconTrendingUp,
  IconActivity,
  IconPlus,
  IconEye,
  IconSettings,
  IconChartBar,
  IconUserCheck,
  IconBook2,
  IconClipboardCheck,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import DepartmentQuizChart from "@/components/charts/DepartmentQuizChart";
import DojoHiringChart from "@/components/charts/DojoHiringChart";
import HandoverComparisonChart from "@/components/charts/HandoverComparisonChart";
import TestPaperPassChart from "@/components/charts/TestPaperPassChart";
import UserStatusDistributionChart from "@/components/charts/UserStatusDistributionChart";
import DashboardDateFilter from "@/components/dashboard/DashboardDateFilter";
import { useGetAdminHomeDojoStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { IconUserPlus } from "@tabler/icons-react";

// Reusable StatCard component
const StatCard = ({ title, value, description, icon: Icon, iconBgColor, iconColor, isLoading, trend, linkTo }) => {
  const CardWrapper = linkTo ? Link : 'div';
  const cardProps = linkTo ? { to: linkTo, className: "block" } : {};

  return (
    <CardWrapper {...cardProps}>
      <Card className={`border border-gray-200 shadow-sm transition-all hover:shadow-md ${linkTo ? 'hover:border-blue-200 cursor-pointer' : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          <div className={`h-8 w-8 rounded-full ${iconBgColor} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              {trend && (
                <div className={`flex items-center text-xs ${trend.type === 'positive' ? 'text-green-600' : trend.type === 'negative' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                  <IconTrendingUp className="h-3 w-3 mr-1" />
                  {trend.value}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        </CardContent>
      </Card>
    </CardWrapper>
  );
};

// Quick Action Card component
const QuickActionCard = ({ title, description, icon: Icon, linkTo, color = "blue" }) => {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' }
  };

  return (
    <Link to={linkTo}>
      <Card className={`${colorClasses[color].border} border-2 hover:shadow-md transition-all cursor-pointer group`}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${colorClasses[color].bg}`}>
              <Icon className={`h-5 w-5 ${colorClasses[color].text}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 group-hover:text-gray-700">{title}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const Home = () => {
  const [dateRange, setDateRange] = React.useState({ startDate: '', endDate: '' });

  // API calls for all stats
  const { data: studentsData, isLoading: studentsLoading } = useGetAllStudentsQuery();
  const { data: instructorsData, isLoading: instructorsLoading } = useGetAllInstructorsQuery();
  const { data: departmentsData, isLoading: departmentsLoading } = useGetAllDepartmentsQuery();
  const { data: coursesData, isLoading: coursesLoading } = useGetCoursesQuery({
    page: 1,
    limit: 1000, // Get all courses for count
    search: "",
    category: "",
    status: ""
  });
  const { data: auditsData, isLoading: auditsLoading } = useGetAllAuditsQuery({
    page: 1,
    limit: 10
  });

  // Dojo Hiring stats from the new API
  const { data: dojoStats, isLoading: dojoLoading } = useGetAdminHomeDojoStatsQuery(dateRange);
  const totalDojoUsers = dojoStats?.data?.totalDojoUsers || 0;

  // Extract counts from API responses
  const totalStudents = studentsData?.data?.totalUsers || 0;
  const totalInstructors = instructorsData?.data?.totalUsers || 0;
  const totalDepartments = departmentsData?.data?.totalDepartments || 0;
  const totalCourses = coursesData?.data?.total || 0;
  const recentActivities = auditsData?.data?.audits || [];

  // Calculate additional statistics
  const activeStudents = useMemo(() => {
    if (!studentsData?.data?.users) return 0;
    return studentsData.data.users.filter(student => student.status === 'ACTIVE').length;
  }, [studentsData]);

  const activeDepartments = useMemo(() => {
    if (!departmentsData?.data?.departments) return 0;
    return departmentsData.data.departments.filter(department => department.status === 'COMPLETED').length;
  }, [departmentsData]);

  const publishedCourses = useMemo(() => {
    if (!coursesData?.data?.courses) return 0;
    return coursesData.data.courses.filter(course => course.status === 'PUBLISHED').length;
  }, [coursesData]);

  // Calculate engagement metrics
  const studentEngagement = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;
  const departmentUtilization = totalDepartments > 0 ? Math.round((activeDepartments / totalDepartments) * 100) : 0;
  const courseCompletion = totalCourses > 0 ? Math.round((publishedCourses / totalCourses) * 100) : 0;

  return (
    <div className="space-y-6">
      <DashboardDateFilter onFilterChange={setDateRange} />

      {/* Main Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Operators"
          value={totalStudents}
          description="All registered operators"
          icon={IconUsers}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          isLoading={studentsLoading}
          linkTo="/admin/employees"
          trend={{ type: 'positive', value: `${activeStudents} active` }}
        />


        <StatCard
          title="Total Sections"
          value={totalDepartments}
          description="Learning groups"
          icon={IconCalendar}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          isLoading={departmentsLoading}
          linkTo="/admin/departments"
          trend={{ type: 'positive', value: `${activeDepartments} active` }}
        />

        <StatCard
          title="Total Courses"
          value={totalCourses}
          description="Available courses"
          icon={IconBook}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
          isLoading={coursesLoading}
          linkTo="/admin/courses"
          trend={{ type: 'positive', value: `${publishedCourses} published` }}
        />

        <StatCard
          title="Dojo Hiring"
          value={totalDojoUsers}
          description="Temporary candidates"
          icon={IconUserPlus}
          iconBgColor="bg-pink-100"
          iconColor="text-pink-600"
          isLoading={dojoLoading}
          linkTo="/admin/employees?type=temporary"
        />
      </div>


      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DojoHiringChart dateRange={dateRange} />
        <HandoverComparisonChart dateRange={dateRange} />
        <TestPaperPassChart dateRange={dateRange} />
        <UserStatusDistributionChart dateRange={dateRange} />
        <DepartmentQuizChart dateRange={dateRange} />
      </div>

      {/* Main Content Area (Moved below charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconActivity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest system events</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/analytics">View All</Link>
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
                        {activity.action || 'System activity'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.user?.fullName || 'System'} • {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {activity.action?.split(' ')[0] || 'Activity'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <IconActivity className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSettings className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <QuickActionCard
                title="Add New Course"
                description="Create a new learning course"
                icon={IconPlus}
                linkTo="/admin/add-course"
                color="blue"
              />

              <QuickActionCard
                title="Manage Sections"
                description="View and organize sections"
                icon={IconCalendar}
                linkTo="/admin/departments"
                color="purple"
              />

              <QuickActionCard
                title="View Reports"
                description="Analytics and insights"
                icon={IconChartBar}
                linkTo="/admin/analytics"
                color="green"
              />

              <QuickActionCard
                title="Operator Management"
                description="Manage operator accounts"
                icon={IconUsers}
                linkTo="/admin/employees"
                color="orange"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconClipboardCheck className="h-5 w-5" />
            System Overview
          </CardTitle>
          <CardDescription>Key performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{activeStudents}</div>
              <div className="text-sm text-gray-500">Active Operators</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{activeDepartments}</div>
              <div className="text-sm text-gray-500">Running Departments</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{publishedCourses}</div>
              <div className="text-sm text-gray-500">Published Courses</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">{recentActivities.length}</div>
              <div className="text-sm text-gray-500">Recent Activities</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;