import React, { useState, useEffect } from 'react';
import { useGetAllAuditsQuery } from "@/services/api/AuditApi.js";
import { useGetAllInstructorsQuery, useGetAllStudentsQuery } from "@/services/api/InstructorApi.js";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";
import { useGetCoursesQuery } from "@/services/api/CourseApi.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/common/ui/card.jsx";
import { Badge } from "@/components/common/ui/badge.jsx";
import { Skeleton } from "@/components/common/ui/skeleton.jsx";
import {
  IconActivity,
  IconUsers,
  IconSchool,
  IconCalendar,
  IconBook,
  IconTrendingUp,
  IconClock,
  IconSearch,
  IconId,
  IconBuilding,
  IconChevronLeft,
  IconChevronRight
} from "@tabler/icons-react";

// Matches the server's AUDIT_RETENTION_DAYS default: older activity is deleted nightly.
const RETENTION_DAYS = 30;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const toDateInputValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

// Page numbers to show around the current page, with "…" gaps, e.g. 1 … 4 5 6 … 12
const getPageNumbers = (current, total) => {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap-' + p);
    result.push(p);
  });
  return result;
};

const Analytics = ({ pageName = "Recent Activity" }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({ action: "", dateFrom: "", dateTo: "", departmentId: "", sectionId: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const minDate = toDateInputValue(new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
  const maxDate = toDateInputValue(new Date());

  // Debounce the search input so we only hit the API 500ms after typing stops
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  const auditParams = { page: currentPage, limit: pageSize };
  if (debouncedSearch) auditParams.search = debouncedSearch;
  if (filters.action) auditParams.action = filters.action;
  if (filters.dateFrom) auditParams.dateFrom = new Date(`${filters.dateFrom}T00:00:00`).toISOString();
  if (filters.dateTo) auditParams.dateTo = new Date(`${filters.dateTo}T23:59:59.999`).toISOString();
  if (filters.departmentId) auditParams.departmentId = filters.departmentId;
  if (filters.sectionId) auditParams.sectionId = filters.sectionId;

  const { data: auditsData, isLoading: auditsLoading, isFetching: auditsFetching } = useGetAllAuditsQuery(auditParams);
  const { data: studentsData } = useGetAllStudentsQuery();
  const { data: instructorsData } = useGetAllInstructorsQuery();
  const { data: departmentsData } = useGetAllDepartmentsQuery({ limit: 1000 });
  const { data: sectionsData } = useGetSectionsByDepartmentQuery(filters.departmentId, {
    skip: !filters.departmentId
  });
  const { data: coursesData } = useGetCoursesQuery({
    page: 1,
    limit: 1000,
    search: "",
    category: "",
    status: ""
  });

  const activities = auditsData?.data?.audits || [];
  const totalActivities = auditsData?.data?.pagination?.total || 0;
  const totalPages = Math.max(auditsData?.data?.pagination?.pages || Math.ceil(totalActivities / pageSize), 1);
  const rangeStart = totalActivities === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalActivities);

  const departments = departmentsData?.data?.departments || [];
  const sections = filters.departmentId ? (sectionsData?.data || []) : [];

  // Go back to page 1 whenever the filter criteria or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filters.action, filters.dateFrom, filters.dateTo, filters.departmentId, filters.sectionId, pageSize]);

  // If the result set shrinks (e.g. rows aged out), don't leave the user on an empty page
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
          <p className="text-gray-600">System activity from the last {RETENTION_DAYS} days</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-gray-600" htmlFor="analytics-date-from">From</label>
          <input
            id="analytics-date-from"
            type="date"
            min={minDate}
            max={filters.dateTo || maxDate}
            value={filters.dateFrom}
            onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <label className="text-gray-600" htmlFor="analytics-date-to">To</label>
          <input
            id="analytics-date-to"
            type="date"
            min={filters.dateFrom || minDate}
            max={maxDate}
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
                <p className="text-sm font-medium text-gray-600">Activities ({RETENTION_DAYS} days)</p>
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
            <div className="flex flex-col gap-2 sm:flex-row sm:ml-auto">
              <select
                aria-label="Filter by department"
                value={filters.departmentId}
                onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value, sectionId: "" }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              <select
                aria-label="Filter by section"
                value={filters.sectionId}
                disabled={!filters.departmentId}
                onChange={(e) => setFilters((prev) => ({ ...prev, sectionId: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">{filters.departmentId ? "All Sections" : "Select department first"}</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
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
            Showing {rangeStart}–{rangeEnd} of {totalActivities} activities from the last {RETENTION_DAYS} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditsLoading || (auditsFetching && activities.length === 0) ? (
            <div className="space-y-4">
              {[...Array(Math.min(pageSize, 10))].map((_, i) => (
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
            <div className={`space-y-2 transition-opacity ${auditsFetching ? 'opacity-60' : ''}`}>
              {activities.map((activity, index) => {
                const ActivityIcon = getActivityIcon(activity.action);
                const activityColor = getActivityColor(activity.action);
                const user = activity.user && typeof activity.user === 'object' ? activity.user : null;
                const orgUnit = [user?.department?.name, user?.section?.name].filter(Boolean).join(' / ');

                return (
                  <div key={activity.id || index} className="flex items-center justify-between gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="p-2 bg-gray-100 rounded-full shrink-0">
                        <ActivityIcon className={`h-5 w-5 ${activityColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">
                          {activity.action || 'System Activity'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                          <span className="font-medium text-gray-700">{user?.fullName || 'System'}</span>
                          {user?.empId && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <IconId className="h-3 w-3" />
                                {user.empId}
                              </span>
                            </>
                          )}
                          {orgUnit && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <IconBuilding className="h-3 w-3" />
                                {orgUnit}
                              </span>
                            </>
                          )}
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

          {totalActivities > 0 && (
            <div className="flex flex-col gap-3 pt-4 mt-4 border-t sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <label htmlFor="analytics-page-size">Rows per page</label>
                <select
                  id="analytics-page-size"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <nav aria-label="Activity pages" className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <IconChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                {getPageNumbers(currentPage, totalPages).map((p) =>
                  typeof p === 'string' ? (
                    <span key={p} className="px-2 text-sm text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      aria-current={p === currentPage ? 'page' : undefined}
                      className={`min-w-[2rem] px-2 py-1 text-sm border rounded-md ${p === currentPage
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'hover:bg-gray-50'
                        }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <IconChevronRight className="h-4 w-4" />
                </button>
              </nav>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
