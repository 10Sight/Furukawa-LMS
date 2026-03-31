import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  IconFileAnalytics,
  IconSearch,
  IconFilter,
  IconDownload,
  IconEye,
  IconRefresh,
  IconCalendar,
  IconUser,
  IconAlertTriangle,
  IconShield,
  IconActivity,
  IconClock,
  IconX,
  IconChevronDown,
  IconArrowUp,
  IconArrowDown,
  IconExclamationMark,
  IconInfoCircle,
  IconTrash
} from "@tabler/icons-react";
import { 
  useGetAllAuditLogsQuery,
  useGetAuditLogByIdQuery,
  useDeleteAuditLogMutation
} from "@/Redux/AllApi/SuperAdminApi";
import { toast } from "sonner";

const SystemAuditLogs = () => {
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showLogDetail, setShowLogDetail] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [dateRange, setDateRange] = useState("all");
  const [showDebugInfo, setShowDebugInfo] = useState(true); // Temporarily enabled for debugging
  
  const [filters, setFilters] = useState({
    action: "",
    userId: "",
    dateFrom: "",
    dateTo: "",
    ipAddress: "",
    severity: ""
  });

  // Date range calculations
  const getDateRangeFilter = () => {
    const now = new Date();
    let dateFrom = null;
    let dateTo = null;
    
    switch (dateRange) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateTo = new Date();
        break;
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateTo = new Date();
        break;
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        dateTo = new Date();
        break;
      case 'custom':
        dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null;
        dateTo = filters.dateTo ? new Date(filters.dateTo) : null;
        break;
      default: // 'all' case
        dateFrom = null;
        dateTo = null;
        break;
    }
    
    return { dateFrom, dateTo };
  };

  const { dateFrom, dateTo } = getDateRangeFilter();

  // API hooks with conditional parameters
  const apiParams = {
    page: currentPage,
    limit: 20,
    sortBy,
    order: sortOrder,
  };
  
  // Only add parameters that have values to avoid sending empty strings
  if (filters.action) apiParams.action = filters.action;
  if (filters.userId) apiParams.userId = filters.userId;
  if (filters.ipAddress) apiParams.ipAddress = filters.ipAddress;
  if (filters.severity) apiParams.severity = filters.severity;
  if (dateFrom) apiParams.dateFrom = dateFrom.toISOString();
  if (dateTo) apiParams.dateTo = dateTo.toISOString();
  if (searchTerm) apiParams.search = searchTerm;

  const { 
    data: auditLogsData, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useGetAllAuditLogsQuery(apiParams);

  // Handle different possible API response structures
  const auditLogs = auditLogsData?.data?.audits || 
                    auditLogsData?.data?.logs || 
                    auditLogsData?.audits || 
                    auditLogsData?.logs || 
                    [];
  
  const totalPages = auditLogsData?.data?.pagination?.pages || 
                     auditLogsData?.data?.pagination?.totalPages || 
                     auditLogsData?.data?.totalPages || 
                     auditLogsData?.pagination?.pages || 
                     auditLogsData?.pagination?.totalPages ||
                     auditLogsData?.totalPages ||
                     Math.ceil((auditLogsData?.data?.pagination?.total || auditLogsData?.data?.total || auditLogs.length) / 20);
  
  const totalLogs = auditLogsData?.data?.pagination?.total || 
                    auditLogsData?.data?.total || 
                    auditLogsData?.pagination?.total || 
                    auditLogsData?.total || 
                    auditLogs.length;


  // Manual API test - for debugging
  const testApiCall = async () => {
    try {
      // Use fetch with credentials: 'include' to send HTTP-only cookies
      const response = await fetch('https://swargaya-learning-management-system-3vcz.onrender.com/api/audits?page=1&limit=5', {
        method: 'GET',
        credentials: 'include', // This ensures cookies are sent
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Manual API Test] Failed:', data);
      }
    } catch (error) {
      console.error('[Manual API Test] Error:', error);
    }
  };

  // Run manual API test on component mount
  useEffect(() => {
    testApiCall();
  }, []);

  const handleExportLogs = async () => {
    try {
      // Create a CSV export of visible logs
      const csvContent = [
        // Header
        ['Date', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'User Agent'].join(','),
        // Data rows
        ...auditLogs.map(log => [
          new Date(log.createdAt).toLocaleString(),
          log.user ? log.user.fullName : 'System',
          log.action,
          log.resourceType || 'N/A',
          log.resourceId || 'N/A',
          log.ip || 'N/A',
          log.userAgent || 'N/A'
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Audit logs exported successfully!');
    } catch (error) {
      console.error("Error exporting logs:", error);
      toast.error('Failed to export audit logs');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getActionIcon = (action) => {
    if (action.includes('DELETE')) return IconAlertTriangle;
    if (action.includes('LOGIN')) return IconUser;
    if (action.includes('SYSTEM')) return IconShield;
    if (action.includes('CREATE') || action.includes('UPDATE')) return IconActivity;
    return IconFileAnalytics;
  };

  const LogDetailModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Audit Log Details</h3>
          <button
            onClick={() => setShowLogDetail(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        
        {selectedLog && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <div className="flex items-center space-x-2">
                  {React.createElement(getActionIcon(selectedLog.action), { className: "w-4 h-4 text-blue-600" })}
                  <span className="font-medium text-sm">{selectedLog.action}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(selectedLog.severity || 'low')}`}>
                  {(selectedLog.severity || 'LOW').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                <div className="text-sm text-gray-900">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedLog.status || 'success')}`}>
                  {(selectedLog.status || 'SUCCESS').toUpperCase()}
                </span>
              </div>
            </div>

            {/* User Info */}
            {selectedLog.user && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">User Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="break-words">
                    <span className="font-medium">Name:</span> {selectedLog.user.fullName}
                  </div>
                  <div className="break-words">
                    <span className="font-medium">Email:</span> {selectedLog.user.email}
                  </div>
                  <div>
                    <span className="font-medium">Role:</span> {selectedLog.user.role}
                  </div>
                  <div className="break-all">
                    <span className="font-medium">User ID:</span> {selectedLog.user._id}
                  </div>
                </div>
              </div>
            )}

            {/* Resource Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type</label>
                <div className="text-sm text-gray-900 break-words">{selectedLog.resourceType || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resource ID</label>
                <div className="text-sm text-gray-900 break-all">{selectedLog.resourceId || 'N/A'}</div>
              </div>
            </div>
            
            {/* Network Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                <div className="text-sm text-gray-900">{selectedLog.ip || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Agent</label>
                <div className="text-sm text-gray-900 break-all" title={selectedLog.userAgent}>
                  {selectedLog.userAgent || 'N/A'}
                </div>
              </div>
            </div>

            {/* Details */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Additional Details</h4>
              <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowLogDetail(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {/* Export single log */}}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Export Log
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">System Audit Logs</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Monitor and track all system activities and security events
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowDebugInfo(!showDebugInfo)}
            className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 rounded-md transition-colors text-xs sm:text-sm ${
              showDebugInfo ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Debug Info"
          >
            <IconInfoCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Debug</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-md transition-colors text-xs sm:text-sm ${
              showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <IconFilter className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Filters</span>
          </button>
          <button
            onClick={handleExportLogs}
            className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs sm:text-sm"
          >
            <IconDownload className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Debug Information Panel */}
      {showDebugInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <IconInfoCircle className="w-5 h-5 text-yellow-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-yellow-800 font-medium mb-3">Debug Information</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong className="text-yellow-800">Current User:</strong>
                    <div className="text-yellow-700 mt-1">
                      {currentUser ? (
                        <div>
                          <div>Name: {currentUser.fullName}</div>
                          <div>Email: {currentUser.email}</div>
                          <div>Role: {currentUser.role}</div>
                          <div>Status: {currentUser.status}</div>
                        </div>
                      ) : (
                        <div className="text-red-600">No user data found in Redux state</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <strong className="text-yellow-800">Authentication:</strong>
                    <div className="text-yellow-700 mt-1">
                      <div>Token exists: {localStorage.getItem('token') ? 'Yes' : 'No'}</div>
                      <div>IsLoggedIn: {localStorage.getItem('isLoggedIn')}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <strong className="text-yellow-800">API Request Status:</strong>
                  <div className="text-yellow-700 mt-1">
                    <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
                    <div>Error: {isError ? 'Yes' : 'No'}</div>
                    {error && (
                      <div className="mt-2">
                        <strong>Error Details:</strong>
                        <div className="bg-red-50 border border-red-200 rounded p-2 mt-1">
                          <div>Status: {error.status}</div>
                          <div>Message: {error.message || error.data?.message}</div>
                          {error.data && (
                            <div>Data: {JSON.stringify(error.data, null, 2)}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <strong className="text-yellow-800">API Endpoint:</strong>
                  <div className="text-yellow-700 mt-1">
                    <div>URL: /api/audits</div>
                    <div>Parameters: {JSON.stringify({
                      page: currentPage,
                      limit: 20,
                      sortBy,
                      order: sortOrder,
                      search: searchTerm,
                      action: filters.action,
                      userId: filters.userId,
                      dateFrom: dateFrom?.toISOString(),
                      dateTo: dateTo?.toISOString(),
                      ipAddress: filters.ipAddress,
                      userAgent: filters.userAgent
                    }, null, 2)}</div>
                  </div>
                </div>
                
                <div>
                  <strong className="text-yellow-800">Response Data Structure:</strong>
                  <div className="text-yellow-700 mt-1">
                    <div>Raw Response: {auditLogsData ? 'Available' : 'No Data'}</div>
                    <div>Audit Logs Count: {auditLogs.length}</div>
                    <div>Total Pages: {totalPages}</div>
                    <div>Total Logs: {totalLogs}</div>
                    {auditLogsData && (
                      <div className="bg-gray-50 border border-gray-200 rounded p-2 mt-1 max-h-40 overflow-y-auto">
                        <div>Response Structure: {JSON.stringify(Object.keys(auditLogsData), null, 2)}</div>
                        {auditLogsData.data && (
                          <div>Data Keys: {JSON.stringify(Object.keys(auditLogsData.data), null, 2)}</div>
                        )}
                        <div className="mt-2">
                          <strong>Full Raw Response:</strong>
                          <pre className="text-xs">{JSON.stringify(auditLogsData, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Events</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{totalLogs}</p>
            </div>
            <IconFileAnalytics className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Delete Actions</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                {auditLogs.filter(log => log.action?.includes('DELETE')).length}
              </p>
            </div>
            <IconAlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 flex-shrink-0" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Login Actions</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                {auditLogs.filter(log => log.action?.includes('LOGIN')).length}
              </p>
            </div>
            <IconExclamationMark className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600 flex-shrink-0" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Unique Users</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                {new Set(auditLogs.filter(log => log.user).map(log => log.user._id)).size}
              </p>
            </div>
            <IconUser className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
            <span className="text-sm font-medium text-gray-700">Time Range:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All Time' },
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'custom', label: 'Custom' }
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDateRange(range.value)}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm transition-colors whitespace-nowrap ${
                    dateRange === range.value 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={() => refetch()}
            className="flex items-center justify-center space-x-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
          >
            <IconRefresh className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                <option value="LOGIN_ATTEMPT">Login Attempt</option>
                <option value="LOGIN_FAILED">Login Failed</option>
                <option value="DELETE_USER">Delete User</option>
                <option value="CREATE_USER">Create User</option>
                <option value="UPDATE_USER">Update User</option>
                <option value="SYSTEM_BACKUP">System Backup</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">User</label>
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                placeholder="User ID or email"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="relative max-w-full sm:max-w-md">
          <IconSearch className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Mobile Card View */}
        <div className="block md:hidden">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : isError ? (
              <div className="text-center py-8 text-red-600">
                Error loading audit logs: {error?.data?.message || error?.message}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8">
                <IconFileAnalytics className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Audit Logs</h3>
                <p className="text-gray-500">No audit logs found for the selected criteria.</p>
              </div>
            ) : (
              auditLogs.map((log) => {
                const ActionIcon = getActionIcon(log.action);
                return (
                  <div key={log._id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ActionIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">{log.action}</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedLog(log);
                          setShowLogDetail(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <IconEye className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {log.user ? (
                          <>
                            <img
                              className="h-6 w-6 rounded-full"
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(log.user.fullName)}&background=2563eb&color=fff`}
                              alt={log.user.fullName}
                            />
                            <span className="text-sm text-gray-900">{log.user.fullName}</span>
                          </>
                        ) : (
                          <>
                            <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center">
                              <IconShield className="w-3 h-3 text-gray-500" />
                            </div>
                            <span className="text-sm text-gray-900">System</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(log.severity || 'low')}`}>
                          {(log.severity || 'LOW').toUpperCase()}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status || 'success')}`}>
                          {(log.status || 'SUCCESS').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {log.resourceType || 'System'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => {
                      setSortBy("createdAt");
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    }}
                    className="flex items-center space-x-1 hover:text-gray-700"
                  >
                    <span>Date & Time</span>
                    {sortBy === "createdAt" && (
                      sortOrder === "asc" ? <IconArrowUp className="w-3 h-3" /> : <IconArrowDown className="w-3 h-3" />
                    )}
                  </button>
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 lg:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <div className="text-red-600">
                      Error loading audit logs: {error?.data?.message || error?.message}
                    </div>
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <IconFileAnalytics className="w-12 h-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">No Audit Logs</h3>
                      <p className="text-gray-500">No audit logs found for the selected criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => {
                  const ActionIcon = getActionIcon(log.action);
                  return (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="px-3 lg:px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-3 lg:px-6 py-4">
                        {log.user ? (
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-6 lg:h-8 w-6 lg:w-8">
                              <img
                                className="h-6 lg:h-8 w-6 lg:w-8 rounded-full"
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(log.user.fullName)}&background=2563eb&color=fff`}
                                alt={log.user.fullName}
                              />
                            </div>
                            <div className="ml-2 lg:ml-3 min-w-0">
                              <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">{log.user.fullName}</div>
                              <div className="text-xs text-gray-500 truncate">{log.user.role}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-6 lg:h-8 w-6 lg:w-8">
                              <div className="h-6 lg:h-8 w-6 lg:w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <IconShield className="w-3 lg:w-4 h-3 lg:h-4 text-gray-500" />
                              </div>
                            </div>
                            <div className="ml-2 lg:ml-3">
                              <div className="text-xs lg:text-sm font-medium text-gray-900">System</div>
                              <div className="text-xs text-gray-500">Automated</div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 lg:px-6 py-4">
                        <div className="flex items-center space-x-1 lg:space-x-2">
                          <ActionIcon className="w-3 lg:w-4 h-3 lg:h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-xs lg:text-sm font-medium text-gray-900 truncate">{log.action}</span>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4">
                        <div className="text-sm text-gray-900">{log.resourceType || 'System'}</div>
                      </td>
                      <td className="px-3 lg:px-6 py-4">
                        <span className={`inline-flex px-1.5 lg:px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(log.severity || 'low')}`}>
                          <span className="hidden lg:inline">{(log.severity || 'LOW').toUpperCase()}</span>
                          <span className="lg:hidden">{(log.severity || 'L')[0]}</span>
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status || 'success')}`}>
                          {(log.status || 'SUCCESS').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 lg:px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedLog(log);
                            setShowLogDetail(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="View Details"
                        >
                          <IconEye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200">
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="text-xs sm:text-sm text-gray-700">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalLogs)} of {totalLogs} logs
            </div>
            <div className="flex items-center justify-center space-x-1 sm:space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">←</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded-md ${
                      currentPage === page 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showLogDetail && <LogDetailModal />}
    </div>
  );
};

export default SystemAuditLogs;
