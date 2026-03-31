import React, { useState, useEffect, useMemo } from "react";
import {
  IconCalendar,
  IconDownload,
  IconFilter,
  IconChartBar,
  IconUsers,
  IconSchool,
  IconTrendingUp,
  IconActivity,
  IconRefresh,
  IconFileText,
  IconChartLine,
  IconChartArea,
  IconChartPie,
  IconTable,
  IconEye,
  IconArrowUp,
  IconArrowDown,
  IconMinus
} from "@tabler/icons-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import {
  useGetComprehensiveAnalyticsQuery,
  useGenerateCustomReportMutation,
  useExportAnalyticsMutation
} from "@/Redux/AllApi/SuperAdminApi";

const AdvancedAnalytics = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [filters, setFilters] = useState({
    granularity: 'day',
    role: '',
    status: ''
  });
  const [reportType, setReportType] = useState('user_activity');
  const [exportFormat, setExportFormat] = useState('json');

  // RTK Query hooks
  const {
    data: analyticsResponse,
    isLoading: loading,
    isError,
    error,
    refetch
  } = useGetComprehensiveAnalyticsQuery({
    dateFrom: dateRange.startDate,
    dateTo: dateRange.endDate,
    granularity: filters.granularity
  });

  const [generateCustomReport, { isLoading: isGeneratingReport }] = useGenerateCustomReportMutation();
  const [exportAnalytics, { isLoading: isExporting }] = useExportAnalyticsMutation();

  // Extract data from API response
  const analyticsData = analyticsResponse?.data;

  // Color schemes for charts
  const colors = {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    indigo: '#6366F1'
  };

  const pieColors = [colors.primary, colors.secondary, colors.accent, colors.danger, colors.purple, colors.indigo];

  // Process data for charts
  const processedData = useMemo(() => {
    if (!analyticsData) return {};

    // Process user registration trends
    const userTrendsMap = new Map();
    analyticsData.userRegistrationTrends?.forEach(item => {
      const date = item._id.date;
      if (!userTrendsMap.has(date)) {
        userTrendsMap.set(date, { date, students: 0, instructors: 0 });
      }
      const entry = userTrendsMap.get(date);
      if (item._id.role === 'STUDENT') entry.students = item.count;
      if (item._id.role === 'INSTRUCTOR') entry.instructors = item.count;
    });
    const userTrends = Array.from(userTrendsMap.values());

    // Process engagement metrics
    const engagementData = analyticsData.engagementMetrics?.map(item => ({
      date: item._id.date,
      attempts: item.totalAttempts,
      averageScore: Math.round(item.averageScore || 0),
      passRate: Math.round((item.passedAttempts / item.totalAttempts) * 100) || 0
    })) || [];

    // Process course performance for pie chart
    const coursePerformanceData = analyticsData.coursePerformance?.map((course, index) => ({
      name: course.title,
      value: course.totalEnrolledStudents,
      fill: pieColors[index % pieColors.length]
    })) || [];

    return {
      userTrends,
      engagementData,
      coursePerformanceData
    };
  }, [analyticsData]);

  // Generate custom report
  const handleGenerateReport = async () => {
    try {
      const reportData = {
        reportType,
        dateRange,
        filters
      };
      const response = await generateCustomReport(reportData).unwrap();
      toast.success('Report generated successfully!');
      // Handle report data (could open in new tab, download, etc.)
    } catch (error) {
      toast.error('Failed to generate report');
    }
  };

  // Export analytics data
  const handleExportData = async () => {
    try {
      const exportData = {
        format: exportFormat,
        reportType: 'comprehensive',
        dateRange,
        filters
      };
      const response = await exportAnalytics(exportData).unwrap();
      toast.success(`Data exported successfully in ${exportFormat.toUpperCase()} format!`);
      // Handle file download
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  // Calculate key metrics
  const keyMetrics = useMemo(() => {
    if (!analyticsData) return [];
    
    const totalStudents = analyticsData.topStudents?.length || 0;
    const totalInstructors = analyticsData.instructorPerformance?.length || 0;
    const totalCourses = analyticsData.coursePerformance?.length || 0;
    const avgQuizScore = analyticsData.coursePerformance?.reduce((acc, course) => acc + (course.averageQuizScore || 0), 0) / Math.max(totalCourses, 1);

    return [
      {
        title: "Active Students",
        value: totalStudents.toString(),
        change: "+12%",
        trend: "up",
        icon: IconUsers,
        color: "blue"
      },
      {
        title: "Total Instructors",
        value: totalInstructors.toString(),
        change: "+5%",
        trend: "up",
        icon: IconSchool,
        color: "green"
      },
      {
        title: "Published Courses",
        value: totalCourses.toString(),
        change: "+8%",
        trend: "up",
        icon: IconChartBar,
        color: "purple"
      },
      {
        title: "Avg Test Score",
        value: `${Math.round(avgQuizScore || 0)}%`,
        change: "+3%",
        trend: "up",
        icon: IconTrendingUp,
        color: "orange"
      }
    ];
  }, [analyticsData]);

  const tabs = [
    { id: "overview", label: "Overview", icon: IconChartLine },
    { id: "users", label: "User Analytics", icon: IconUsers },
    { id: "courses", label: "Course Performance", icon: IconSchool },
    { id: "engagement", label: "Engagement", icon: IconActivity },
    { id: "reports", label: "Custom Reports", icon: IconFileText }
  ];

  if (loading && !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics & Reports</h1>
            <p className="text-gray-600 mt-1">Comprehensive analytics dashboard with custom reporting</p>
          </div>
        </div>
        
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive analytics dashboard with custom reporting</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <IconCalendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <IconRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {keyMetrics.map((metric, index) => {
          const Icon = metric.icon;
          const colorClasses = {
            blue: "bg-blue-100 text-blue-600",
            green: "bg-green-100 text-green-600",
            purple: "bg-purple-100 text-purple-600",
            orange: "bg-orange-100 text-orange-600"
          };
          
          return (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-lg ${colorClasses[metric.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex items-center text-sm font-medium">
                  {metric.trend === 'up' && <IconArrowUp className="w-4 h-4 text-green-500 mr-1" />}
                  {metric.trend === 'down' && <IconArrowDown className="w-4 h-4 text-red-500 mr-1" />}
                  {metric.trend === 'neutral' && <IconMinus className="w-4 h-4 text-gray-500 mr-1" />}
                  <span className={metric.trend === 'up' ? 'text-green-600' : metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                    {metric.change}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-600">{metric.title}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* User Registration Trends */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Registration Trends</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={processedData.userTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="students" stroke={colors.primary} strokeWidth={2} name="Students" />
                      <Line type="monotone" dataKey="instructors" stroke={colors.secondary} strokeWidth={2} name="Instructors" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Engagement Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Performance Trends</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData.engagementData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="averageScore" stroke={colors.accent} fill={`${colors.accent}30`} name="Avg Score" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Enrollment Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={processedData.coursePerformanceData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {processedData.coursePerformanceData?.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Analytics Tab */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Students</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Attempts</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyticsData?.topStudents?.map((student, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.fullName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Math.round(student.averageQuizScore || 0)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.totalQuizAttempts}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Math.round(student.averageProgress || 0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Course Performance Tab */}
          {activeTab === "courses" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Course Performance Analytics</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analyticsData?.coursePerformance?.map((course, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">{course.title}</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Enrolled Students:</span>
                        <span className="font-medium">{course.totalEnrolledStudents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Test Score:</span>
                        <span className="font-medium">{Math.round(course.averageQuizScore || 0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Progress:</span>
                        <span className="font-medium">{Math.round(course.averageProgress || 0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Engagement Tab */}
          {activeTab === "engagement" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Learning Engagement Metrics</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedData.engagementData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="attempts" fill={colors.primary} name="Test Attempts" />
                    <Bar dataKey="passRate" fill={colors.secondary} name="Pass Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Custom Reports Tab */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Custom Reports & Data Export</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Generate Custom Report</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                      <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="user_activity">User Activity Report</option>
                        <option value="course_completion">Course Completion Report</option>
                        <option value="quiz_performance">Test Performance Report</option>
                        <option value="instructor_effectiveness">Instructor Effectiveness Report</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={handleGenerateReport}
                      disabled={isGeneratingReport}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <IconFileText className="w-4 h-4" />
                      {isGeneratingReport ? 'Generating...' : 'Generate Report'}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Export Analytics Data</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="json">JSON</option>
                        <option value="csv">CSV</option>
                        <option value="xlsx">Excel (XLSX)</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={handleExportData}
                      disabled={isExporting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <IconDownload className="w-4 h-4" />
                      {isExporting ? 'Exporting...' : 'Export Data'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
