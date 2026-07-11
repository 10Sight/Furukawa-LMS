import React, { useState, useEffect, useRef } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconActivity,
  IconUsers,
  IconSchool,
  IconCalendar,
  IconBook,
  IconTrendingUp,
  IconClock,
  IconSearch
} from "@tabler/icons-react";

const Analytics = ({ pageName = "Recent Activity" }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({ action: "", dateFrom: "", dateTo: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [activities, setActivities] = useState([]);
  const loadMoreRef = useRef(null);

  // Debounce the search input so we only hit the API 500ms after typing stops
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const auditParams = { page: currentPage, limit: 20 };
  if (debouncedSearch) auditParams.search = debouncedSearch;
  if (filters.action) auditParams.action = filters.action;
  if (filters.dateFrom) auditParams.dateFrom = new Date(filters.dateFrom).toISOString();
  if (filters.dateTo) auditParams.dateTo = new Date(filters.dateTo).toISOString();

  const { data: auditsData, isLoading: auditsLoading, isFetching: auditsFetching } = useGetAllAuditsQuery(auditParams);
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

  const pageActivities = auditsData?.data?.audits || [];
  const totalActivities = auditsData?.data?.pagination?.total || 0;
  const totalPages = auditsData?.data?.pagination?.pages || Math.ceil(totalActivities / 20) || 1;

  // Reset the accumulated list and go back to page 1 whenever the filter criteria change
  useEffect(() => {
    setCurrentPage(1);
    setActivities([]);
  }, [debouncedSearch, filters.action, filters.dateFrom, filters.dateTo]);

  // Accumulate pages of results as they arrive
  useEffect(() => {
    if (!auditsData) return;
    setActivities((prev) => (currentPage === 1 ? pageActivities : [...prev, ...pageActivities]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditsData]);

  // Infinite scroll: load the next page once the sentinel div scrolls into view
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !auditsFetching && currentPage < totalPages) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [auditsFetching, currentPage, totalPages]);

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
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-gray-600" htmlFor="analytics-date-from">From</label>
          <input
            id="analytics-date-from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <label className="text-gray-600" htmlFor="analytics-date-to">To</label>
          <input
            id="analytics-date-to"
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
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

      {/* Search & Action Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
            <div className="relative max-w-full sm:max-w-md flex-1">
              <IconSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'VIEW', label: 'View' },
                { value: 'UPDATE', label: 'Update' },
                { value: 'DELETE', label: 'Delete' }
              ].map((badge) => (
                <button
                  key={badge.value}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      action: prev.action === badge.value ? '' : badge.value
                    }))
                  }
                  className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${filters.action === badge.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {badge.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconActivity className="h-5 w-5" />
            Recent System Activities
          </CardTitle>
          <CardDescription>
            Showing {activities.length} of {totalActivities} total activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditsLoading && activities.length === 0 ? (
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
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {auditsFetching && activities.length > 0 && (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                )}
                {!auditsFetching && currentPage >= totalPages && (
                  <span className="text-xs text-gray-400">No more activities</span>
                )}
              </div>
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
