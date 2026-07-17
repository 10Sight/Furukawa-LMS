import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetCoursesQuery } from '@/Redux/AllApi/CourseApi';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  IconUsers,
  IconCalendar,
  IconBook,
  IconTrendingUp,
  IconPlus,
  IconSettings,
  IconChartBar,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import LazyContainer from "@/components/common/LazyContainer";
import DepartmentQuizChart from "@/components/charts/DepartmentQuizChart";
import DojoHiringTrendChart from "@/components/charts/DojoHiringTrendChart";
import TestPaperPassChart from "@/components/charts/TestPaperPassChart";
import EfficiencyChart from "@/components/charts/EfficiencyChart";
import DojoHandoverComparisonChart from "@/components/charts/DojoHandoverComparisonChart";
import ContractorWiseOperatorChart from "@/components/charts/ContractorWiseOperatorChart";
import DashboardDateFilter from "@/components/dashboard/DashboardDateFilter";
import RecentActivityCard from "@/components/dashboard/RecentActivityCard";
import SystemOverviewCard from "@/components/dashboard/SystemOverviewCard";
import { useGetAdminHomeDojoStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useLogActionMutation } from '@/Redux/AllApi/AuditApi';
import { IconUserPlus } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";
import { useIsTablet } from "@/hooks/useIsTablet";

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
  const { t } = useTranslate();
  const isTablet = useIsTablet();
  const [dateRange, setDateRange] = React.useState({ startDate: '', endDate: '' });
  const [logAction] = useLogActionMutation();

  React.useEffect(() => {
    logAction({ action: "VIEW_DASHBOARD", details: { page: "Admin Home" } })
      .unwrap()
      .catch((err) => console.error("Failed to log page view:", err));
  }, [logAction]);

  // API calls for all stats
  const { data: studentsData, isLoading: studentsLoading } = useGetAllStudentsQuery();
  const { data: departmentsData, isLoading: departmentsLoading } = useGetAllDepartmentsQuery();
  const { data: coursesData, isLoading: coursesLoading } = useGetCoursesQuery({
    page: 1,
    limit: 1000, // Get all courses for count
    search: "",
    category: "",
    status: ""
  });

  // Dojo Hiring stats from the new API
  const { data: dojoStats, isLoading: dojoLoading } = useGetAdminHomeDojoStatsQuery(dateRange);
  const totalDojoUsers = dojoStats?.data?.totalDojoUsers || 0;

  // Extract counts from API responses
  const totalStudents = studentsData?.data?.totalUsers || 0;
  const totalDepartments = departmentsData?.data?.totalDepartments || 0;
  const totalCourses = coursesData?.data?.total || 0;

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
          title={t('home.totalOperators')}
          value={totalStudents}
          description={t('home.registeredOperators')}
          icon={IconUsers}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          isLoading={studentsLoading}
          linkTo="/admin/employees"
          trend={{ type: 'positive', value: `${activeStudents} ${t('home.active')}` }}
        />


        <StatCard
          title={t('home.totalSections')}
          value={totalDepartments}
          description={t('home.learningGroups')}
          icon={IconCalendar}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          isLoading={departmentsLoading}
          linkTo="/admin/departments"
          trend={{ type: 'positive', value: `${activeDepartments} ${t('home.active')}` }}
        />

        <StatCard
          title={t('home.totalCourses')}
          value={totalCourses}
          description={t('home.availableCourses')}
          icon={IconBook}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
          isLoading={coursesLoading}
          linkTo="/admin/courses"
          trend={{ type: 'positive', value: `${publishedCourses} ${t('home.published')}` }}
        />

        <StatCard
          title={t('home.dojoHiring')}
          value={totalDojoUsers}
          description={t('home.tempCandidates')}
          icon={IconUserPlus}
          iconBgColor="bg-pink-100"
          iconColor="text-pink-600"
          isLoading={dojoLoading}
          linkTo="/admin/employees?type=temporary"
        />
      </div>


      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6">
        <LazyContainer minHeight={isTablet ? 600 : 460}>
          <DojoHiringTrendChart />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : 640}>
          <DojoHandoverComparisonChart />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : 640}>
          <ContractorWiseOperatorChart />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 1160 : 420}>
          <TestPaperPassChart />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 620 : 560}>
          <DepartmentQuizChart dateRange={dateRange} />
        </LazyContainer>
        <LazyContainer minHeight={600}>
          <EfficiencyChart />
        </LazyContainer>
      </div>

      {/* Main Content Area (Moved below charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <LazyContainer minHeight={420}>
          <RecentActivityCard />
        </LazyContainer>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSettings className="h-5 w-5" />
              {t('home.quickActions')}
            </CardTitle>
            <CardDescription>{t('home.commonAdminTasks')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <QuickActionCard
                title={t('home.addNewCourse')}
                description={t('home.createNewCourseDesc')}
                icon={IconPlus}
                linkTo="/admin/add-course"
                color="blue"
              />

              <QuickActionCard
                title={t('home.manageSections')}
                description={t('home.manageSectionsDesc')}
                icon={IconCalendar}
                linkTo="/admin/departments"
                color="purple"
              />

              <QuickActionCard
                title={t('home.viewReports')}
                description={t('home.viewReportsDesc')}
                icon={IconChartBar}
                linkTo="/admin/analytics"
                color="green"
              />

              <QuickActionCard
                title={t('home.operatorManagement')}
                description={t('home.operatorManagementDesc')}
                icon={IconUsers}
                linkTo="/admin/employees"
                color="orange"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health Indicators */}
      <LazyContainer minHeight={140}>
        <SystemOverviewCard />
      </LazyContainer>
    </div>
  );
};

export default Home;