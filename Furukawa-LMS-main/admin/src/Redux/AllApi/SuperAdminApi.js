import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const superAdminApi = createApi({
  reducerPath: "superAdminApi",
  baseQuery: axiosBaseQuery,
  tagTypes: ["User", "AuditLog", "SystemSettings", "Analytics", "BulkOperation", "DataManagement", "RolesPermissions"],
  endpoints: (builder) => ({
    // === USER MANAGEMENT ENDPOINTS ===

    // Get all users across all roles
    getAllUsers: builder.query({
      query: (params = {}) => ({
        url: "/api/users",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          sortBy: params.sortBy || "createdAt",
          order: params.order || "desc",
          search: params.search || "",
          role: params.role || "",
          status: params.status || "",
          dateFrom: params.dateFrom || "",
          dateTo: params.dateTo || "",
          departmentId: params.departmentId || "",
          unit: params.unit || "",
        },
      }),
      providesTags: ["User"],
    }),

    // Get soft-deleted users (SuperAdmin only)
    getSoftDeletedUsers: builder.query({
      query: (params = {}) => ({
        url: "/api/users/deleted/all",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          sortBy: params.sortBy || "updatedAt",
          order: params.order || "desc",
          search: params.search || "",
          role: params.role || "",
          deletedDateFrom: params.deletedDateFrom || "",
          deletedDateTo: params.deletedDateTo || "",
          deletedBy: params.deletedBy || "",
        },
      }),
      providesTags: ["User"],
    }),

    // Create user with full permissions
    createUser: builder.mutation({
      query: (userData) => ({
        url: "/api/users",
        method: "POST",
        data: userData,
      }),
      invalidatesTags: ["User"],
    }),

    // Update user with full permissions
    updateUser: builder.mutation({
      query: ({ id, ...userData }) => ({
        url: `/api/users/${id}`,
        method: "PATCH",
        data: userData,
      }),
      invalidatesTags: ["User"],
    }),

    // Permanently delete user (SuperAdmin only)
    permanentDeleteUser: builder.mutation({
      query: (userId) => ({
        url: `/api/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["User"],
    }),

    // Restore soft-deleted user
    restoreUser: builder.mutation({
      query: (userId) => ({
        url: `/api/users/deleted/${userId}/restore`,
        method: "PATCH",
      }),
      invalidatesTags: ["User"],
    }),

    // Bulk user operations
    bulkUserOperation: builder.mutation({
      query: ({ operation, userIds, data = {} }) => ({
        url: "/users/bulk",
        method: "POST",
        data: {
          operation, // 'activate', 'suspend', 'delete', 'restore', 'permanent_delete', 'update_role'
          userIds,
          data,
        },
      }),
      invalidatesTags: ["User", "BulkOperation"],
    }),

    // === AUDIT LOG ENDPOINTS ===

    // Get all audit logs
    getAllAuditLogs: builder.query({
      query: (params = {}) => ({
        url: "/api/audits",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          sortBy: params.sortBy || "createdAt",
          order: params.order || "desc",
          action: params.action || "",
          userId: params.userId || "",
          severity: params.severity || "",
          dateFrom: params.dateFrom || "",
          dateTo: params.dateTo || "",
          ipAddress: params.ipAddress || "",
        },
      }),
      providesTags: ["AuditLog"],
    }),

    // Get specific audit log by ID
    getAuditLogById: builder.query({
      query: (logId) => ({
        url: `/api/audits/${logId}`,
        method: "GET",
      }),
      providesTags: ["AuditLog"],
    }),

    // Delete audit log (SuperAdmin only)
    deleteAuditLog: builder.mutation({
      query: (logId) => ({
        url: `/api/audits/${logId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AuditLog"],
    }),

    // Export audit logs
    exportAuditLogs: builder.mutation({
      query: (params = {}) => ({
        url: "/audit-logs/export",
        method: "POST",
        data: {
          format: params.format || "csv", // 'csv', 'json', 'xlsx'
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          filters: params.filters || {},
        },
        responseType: "blob",
      }),
    }),

    // === SYSTEM SETTINGS ENDPOINTS ===

    // Get all system settings
    getSystemSettings: builder.query({
      query: () => ({
        url: "/system/settings",
        method: "GET",
      }),
      providesTags: ["SystemSettings"],
    }),

    // Update system settings
    updateSystemSettings: builder.mutation({
      query: (settings) => ({
        url: "/system/settings",
        method: "PUT",
        data: settings,
      }),
      invalidatesTags: ["SystemSettings"],
    }),

    // Reset system settings to default
    resetSystemSettings: builder.mutation({
      query: () => ({
        url: "/system/settings/reset",
        method: "POST",
      }),
      invalidatesTags: ["SystemSettings"],
    }),

    // === ANALYTICS ENDPOINTS ===

    // Get comprehensive analytics (enhanced)
    getComprehensiveAnalytics: builder.query({
      query: (params = {}) => ({
        url: "/api/analytics/comprehensive",
        method: "GET",
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          granularity: params.granularity || "day", // 'day', 'week', 'month'
        },
      }),
      providesTags: ["Analytics"],
    }),

    // Get system analytics
    getSystemAnalytics: builder.query({
      query: (params = {}) => ({
        url: "/api/analytics/dashboard",
        method: "GET",
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          granularity: params.granularity || "day", // 'day', 'week', 'month'
        },
      }),
      providesTags: ["Analytics"],
    }),

    // Get user analytics
    getUserAnalytics: builder.query({
      query: (params = {}) => ({
        url: "/api/analytics/users",
        method: "GET",
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          role: params.role || "",
          period: params.period || "30d",
        },
      }),
      providesTags: ["Analytics"],
    }),

    // Get course analytics
    getCourseAnalytics: builder.query({
      query: (params = {}) => ({
        url: "/api/analytics/courses",
        method: "GET",
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          courseId: params.courseId || "",
          period: params.period || "30d",
        },
      }),
      providesTags: ["Analytics"],
    }),

    // Get engagement analytics
    getEngagementAnalytics: builder.query({
      query: (params = {}) => ({
        url: "/api/analytics/engagement",
        method: "GET",
        params: {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          period: params.period || "30d",
        },
      }),
      providesTags: ["Analytics"],
    }),

    // Generate custom report
    generateCustomReport: builder.mutation({
      query: (reportConfig) => ({
        url: "/api/analytics/reports/generate",
        method: "POST",
        data: reportConfig,
      }),
      invalidatesTags: ["Analytics"],
    }),

    // Export analytics data
    exportAnalytics: builder.mutation({
      query: (params) => ({
        url: "/api/analytics/export",
        method: "POST",
        data: params,
        responseType: "blob",
      }),
    }),

    // === DATA MANAGEMENT ENDPOINTS ===

    // Initiate database backup
    createDatabaseBackup: builder.mutation({
      query: (options = {}) => ({
        url: "/api/data-management/backup",
        method: "POST",
        data: {
          includeFiles: options.includeFiles || false,
          compression: options.compression || true,
          encryption: options.encryption || false,
        },
      }),
      invalidatesTags: ["DataManagement"],
    }),

    // Get backup history
    getBackupHistory: builder.query({
      query: (params = {}) => ({
        url: "/api/data-management/backup/history",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 10,
        },
      }),
      providesTags: ["DataManagement"],
    }),

    // Restore from backup
    restoreFromBackup: builder.mutation({
      query: (backupId) => ({
        url: `/api/data-management/backup/${backupId}/restore`,
        method: "POST",
      }),
      invalidatesTags: ["DataManagement"],
    }),

    // Delete backup
    deleteBackup: builder.mutation({
      query: (backupId) => ({
        url: `/api/data-management/backup/${backupId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["DataManagement"],
    }),

    // Get data statistics
    getDataStatistics: builder.query({
      query: () => ({
        url: "/api/data-management/statistics",
        method: "GET",
      }),
      providesTags: ["Analytics"],
    }),

    // Cleanup old data
    cleanupOldData: builder.mutation({
      query: (options = {}) => ({
        url: "/api/data-management/cleanup",
        method: "POST",
        data: {
          auditLogs: options.auditLogs || false,
          backups: options.backups || false,
          auditLogsDays: options.auditLogsDays || 90,
          backupsDays: options.backupsDays || 30,
          dryRun: options.dryRun || false,
        },
      }),
    }),

    // Get system health status
    getSystemHealth: builder.query({
      query: () => ({
        url: "/api/analytics/health",
        method: "GET",
      }),
      refetchOnMountOrArgChange: 30, // Refetch every 30 seconds
    }),

    // Get server metrics
    getServerMetrics: builder.query({
      query: (params = {}) => ({
        url: "/api/analytics/system/server-metrics",
        method: "GET",
        params: {
          period: params.period || "1h",
        },
      }),
    }),

    // Get database metrics
    getDatabaseMetrics: builder.query({
      query: () => ({
        url: "/api/analytics/system/database-metrics",
        method: "GET",
      }),
    }),

    // Get system alerts
    getSystemAlerts: builder.query({
      query: () => ({
        url: "/api/analytics/system/alerts",
        method: "GET",
      }),
    }),

    // Get system performance history
    getSystemPerformanceHistory: builder.query({
      query: (params = {}) => ({
        url: "/api/analytics/system/performance-history",
        method: "GET",
        params: {
          period: params.period || "24h",
        },
      }),
    }),

    // === BULK OPERATIONS ENDPOINTS ===

    // Get bulk operation history
    getBulkOperationHistory: builder.query({
      query: (params = {}) => ({
        url: "/api/bulk-operations/history",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          operation: params.operation || "",
          status: params.status || "",
          dateFrom: params.dateFrom || "",
          dateTo: params.dateTo || "",
          sortBy: params.sortBy || "createdAt",
          order: params.order || "desc",
        },
      }),
      providesTags: ["BulkOperation"],
    }),

    // Bulk enroll users
    bulkEnrollUsers: builder.mutation({
      query: ({ userIds, courseIds = [], departmentId, enrollmentType = 'course', notify = true }) => ({
        url: "/api/bulk-operations/enroll",
        method: "POST",
        data: { userIds, courseIds, departmentId, enrollmentType, notify },
      }),
      invalidatesTags: ["BulkOperation", "User"],
    }),

    // Bulk send emails
    bulkSendEmails: builder.mutation({
      query: ({
        recipients = [],
        recipientType = 'users',
        userIds = [],
        roles = [],
        departmentIds = [],
        subject,
        content,
        template = null,
        templateData = {}
      }) => ({
        url: "/api/bulk-operations/email",
        method: "POST",
        data: {
          recipients,
          recipientType,
          userIds,
          roles,
          departmentIds,
          subject,
          content,
          template,
          templateData
        },
      }),
      invalidatesTags: ["BulkOperation"],
    }),

    // Bulk certificate generation
    bulkGenerateCertificates: builder.mutation({
      query: ({
        userIds = [],
        courseId,
        templateId,
        departmentId = null,
        criteria = 'completion'
      }) => ({
        url: "/api/bulk-operations/certificates",
        method: "POST",
        data: { userIds, courseId, templateId, departmentId, criteria },
      }),
      invalidatesTags: ["BulkOperation"],
    }),

    // === ROLES & PERMISSIONS ENDPOINTS ===

    // Get all roles and permissions
    getRolesAndPermissions: builder.query({
      query: () => ({
        url: "/api/roles-permissions",
        method: "GET",
      }),
      providesTags: ["RolesPermissions"],
    }),

    // Create custom role
    createRole: builder.mutation({
      query: (roleData) => ({
        url: "/api/roles-permissions/roles",
        method: "POST",
        data: roleData,
      }),
      invalidatesTags: ["RolesPermissions"],
    }),

    // Update role permissions
    updateRole: builder.mutation({
      query: ({ id, ...updateData }) => ({
        url: `/api/roles-permissions/roles/${id}`,
        method: "PATCH",
        data: updateData,
      }),
      invalidatesTags: ["RolesPermissions"],
    }),

    // Delete custom role
    deleteRole: builder.mutation({
      query: (roleId) => ({
        url: `/api/roles-permissions/roles/${roleId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["RolesPermissions"],
    }),

    // Assign role to user
    assignRole: builder.mutation({
      query: ({ userId, roleId }) => ({
        url: `/api/roles-permissions/assign`,
        method: "POST",
        data: { userId, roleId },
      }),
      invalidatesTags: ["User", "RolesPermissions"],
    }),

    // Bulk assign roles
    bulkAssignRoles: builder.mutation({
      query: ({ userIds, roleId }) => ({
        url: `/api/roles-permissions/bulk-assign`,
        method: "POST",
        data: { userIds, roleId },
      }),
      invalidatesTags: ["User", "RolesPermissions", "BulkOperation"],
    }),

    // Get users by role
    getUsersByRole: builder.query({
      query: ({ roleId, ...params }) => ({
        url: `/api/roles-permissions/roles/${roleId}/users`,
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          search: params.search || "",
        },
      }),
      providesTags: ["RolesPermissions", "User"],
    }),

    // === DATA EXPORT/IMPORT ENDPOINTS ===

    // Export system data
    exportSystemData: builder.mutation({
      query: (exportConfig) => ({
        url: "/api/data-management/export",
        method: "POST",
        data: exportConfig,
        responseType: "blob",
      }),
      invalidatesTags: ["DataManagement"],
    }),

    // Import system data
    importSystemData: builder.mutation({
      query: (formData) => ({
        url: "/api/data-management/import",
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      }),
      invalidatesTags: ["DataManagement"],
    }),

    // Get data export/import history
    getDataOperationHistory: builder.query({
      query: (params = {}) => ({
        url: "/api/data-management/history",
        method: "GET",
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          operation: params.operation || "", // 'export', 'import', 'backup', 'restore'
          sortBy: params.sortBy || "createdAt",
          order: params.order || "desc",
        },
      }),
      providesTags: ["DataManagement"],
    }),

    // === MAINTENANCE ENDPOINTS ===

    // Enable/Disable maintenance mode
    toggleMaintenanceMode: builder.mutation({
      query: ({ enabled, message, estimatedDuration }) => ({
        url: "/system/maintenance",
        method: "POST",
        data: { enabled, message, estimatedDuration },
      }),
    }),

    // Clear system cache
    clearSystemCache: builder.mutation({
      query: (cacheType = "all") => ({
        url: "/system/cache/clear",
        method: "POST",
        data: { type: cacheType }, // 'all', 'users', 'courses', 'sessions'
      }),
    }),

    // Run system cleanup
    runSystemCleanup: builder.mutation({
      query: (options = {}) => ({
        url: "/system/cleanup",
        method: "POST",
        data: {
          cleanupExpiredSessions: options.cleanupExpiredSessions || true,
          cleanupTempFiles: options.cleanupTempFiles || true,
          cleanupLogs: options.cleanupLogs || false,
          cleanupOrphanedData: options.cleanupOrphanedData || false,
        },
      }),
    }),
  }),
});

export const {
  // User Management
  useGetAllUsersQuery,
  useGetSoftDeletedUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  usePermanentDeleteUserMutation,
  useRestoreUserMutation,
  useBulkUserOperationMutation,

  // Audit Logs
  useGetAllAuditLogsQuery,
  useGetAuditLogByIdQuery,
  useDeleteAuditLogMutation,
  useExportAuditLogsMutation,

  // System Settings
  useGetSystemSettingsQuery,
  useUpdateSystemSettingsMutation,
  useResetSystemSettingsMutation,

  // Analytics
  useGetComprehensiveAnalyticsQuery,
  useGetSystemAnalyticsQuery,
  useGetUserAnalyticsQuery,
  useGetCourseAnalyticsQuery,
  useGetEngagementAnalyticsQuery,
  useGenerateCustomReportMutation,
  useExportAnalyticsMutation,

  // Data Management
  useCreateDatabaseBackupMutation,
  useGetBackupHistoryQuery,
  useRestoreFromBackupMutation,
  useDeleteBackupMutation,
  useGetDataStatisticsQuery,
  useGetDataOperationHistoryQuery,
  useCleanupOldDataMutation,

  // System Health Monitoring
  useGetSystemHealthQuery,
  useGetServerMetricsQuery,
  useGetDatabaseMetricsQuery,
  useGetSystemAlertsQuery,
  useGetSystemPerformanceHistoryQuery,

  // Bulk Operations
  useGetBulkOperationHistoryQuery,
  useBulkEnrollUsersMutation,
  useBulkSendEmailsMutation,
  useBulkGenerateCertificatesMutation,

  // Roles & Permissions
  useGetRolesAndPermissionsQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useAssignRoleMutation,
  useBulkAssignRolesMutation,
  useGetUsersByRoleQuery,

  // Data Export/Import
  useExportSystemDataMutation,
  useImportSystemDataMutation,

  // Maintenance
  useToggleMaintenanceModeMutation,
  useClearSystemCacheMutation,
  useRunSystemCleanupMutation,
} = superAdminApi;
