import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useGetBackupHistoryQuery,
  useRestoreFromBackupMutation,
  useDeleteBackupMutation,
  useGetDataStatisticsQuery,
  useGetDataOperationHistoryQuery
} from "../../Redux/AllApi/SuperAdminApi";
import {
  Database,
  Download,
  Upload,
  RefreshCcw,
  Archive,
  AlertTriangle,
  Clock,
  HardDrive,
  BarChart3,
  FileText,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Users,
  BookOpen,
  Award,
  Activity,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";

const DataManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // API Hooks
  const [restoreBackup, { isLoading: restoring }] = useRestoreFromBackupMutation();
  const [deleteBackup, { isLoading: deleting }] = useDeleteBackupMutation();

  // Data Queries
  const { data: backupHistory, isLoading: loadingBackups, refetch: refetchBackups } = useGetBackupHistoryQuery({
    page: 1,
    limit: 10
  });
  const { data: dataStats, isLoading: loadingStats, refetch: refetchStats } = useGetDataStatisticsQuery();
  const { data: operationHistory, isLoading: loadingOperations } = useGetDataOperationHistoryQuery({
    page: 1,
    limit: 10
  });

  // Available collections for export/import
  const availableCollections = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'departments', label: 'Departments', icon: Users },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'quizzes', label: 'Quizzes', icon: FileText },
    { id: 'assignments', label: 'Assignments', icon: FileText },
    { id: 'certificates', label: 'Certificates', icon: Award },
    { id: 'audits', label: 'Audit Logs', icon: Activity }
  ];

  // Restore from backup
  const handleRestoreBackup = async (backupId) => {
    try {
      await restoreBackup({
        backupId,
        confirmRestore: true
      }).unwrap();
      toast.success('Backup restored successfully');
      setShowRestoreConfirm(null);
      refetchStats();
    } catch (error) {
      toast.error(error.data?.message || 'Failed to restore backup');
    }
  };

  // Delete backup
  const handleDeleteBackup = async (backupId) => {
    try {
      await deleteBackup(backupId).unwrap();
      toast.success('Backup deleted successfully');
      setShowDeleteConfirm(null);
      refetchBackups();
    } catch (error) {
      toast.error(error.data?.message || 'Failed to delete backup');
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Get operation status icon
  const getOperationStatusIcon = (action) => {
    switch (action) {
      case 'CREATE_BACKUP':
        return <Archive className="h-4 w-4 text-blue-600" />;
      case 'RESTORE_BACKUP':
        return <RefreshCcw className="h-4 w-4 text-green-600" />;
      case 'EXPORT_DATA':
        return <Download className="h-4 w-4 text-purple-600" />;
      case 'IMPORT_DATA':
        return <Upload className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'backups', label: 'Backups', icon: Archive },
    { id: 'operations', label: 'Operation History', icon: Clock }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive database backup and restore utilities
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              refetchStats();
              refetchBackups();
            }}
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Data Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {dataStats?.data?.statistics && Object.entries(dataStats.data.statistics)
                .filter(([key]) => availableCollections.some(c => c.id === key))
                .map(([key, stats]) => {
                const collection = availableCollections.find(c => c.id === key);
                const Icon = collection?.icon || HardDrive;
                return (
                  <div key={key} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 capitalize">{key}</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {stats.total.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {stats.recent} recent
                        </p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-full">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* System Summary */}
            {dataStats?.data?.summary && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">System Summary</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-indigo-600">
                      {dataStats.data.summary.totalCollections}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Total Collections</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {dataStats.data.summary.totalRecords.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Total Records</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-600">
                      {formatFileSize(dataStats.data.summary.estimatedSize)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Estimated Size</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="space-y-6">
            {/* Backup History */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Backup History</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Native SQL Server .bak files found in C:\DojoBackup
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {backupHistory?.data?.backups?.map((backup) => (
                      <tr key={backup.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {backup.backup?.id || backup.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(backup.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {backup.backup?.size ? formatFileSize(backup.backup.size) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${backup.fileExists
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                            {backup.fileExists ? 'Available' : 'Missing'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          {backup.fileExists && (
                            <button
                              onClick={() => setShowRestoreConfirm(backup.backup?.id || backup.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Restore
                            </button>
                          )}
                          <button
                            onClick={() => setShowDeleteConfirm(backup.backup?.id || backup.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Operation History</h3>
              <p className="text-sm text-gray-600 mt-1">
                Recent data management operations
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Operation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {operationHistory?.data?.operations?.map((operation) => (
                    <tr key={operation.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getOperationStatusIcon(operation.action)}
                          <span className="ml-2 text-sm font-medium text-gray-900">
                            {operation.action.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {operation.userId?.fullName || 'System'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(operation.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {operation.details?.description ||
                          operation.details?.collections?.join(', ') ||
                          'No details available'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
            onClick={() => !restoring && setShowRestoreConfirm(null)}
          />
          <div className="relative bg-white rounded-lg max-w-md w-full p-6 shadow-xl transform transition-all">
            {restoring ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative mb-4">
                  <Database className="h-12 w-12 text-indigo-600 animate-pulse" />
                  <Loader2 className="absolute -bottom-2 -right-2 h-6 w-6 text-indigo-600 animate-spin bg-white rounded-full p-0.5 shadow-sm" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Restoring Database</h3>
                <p className="text-sm text-gray-500 text-center max-w-xs">
                  Please wait while the system restores the database. This process may take a few moments. Do not refresh or close this page.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Restore</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  This action will replace all current data with the backup data. This cannot be undone.
                  Are you sure you want to proceed?
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowRestoreConfirm(null)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRestoreBackup(showRestoreConfirm)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Confirm Restore
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
            onClick={() => !deleting && setShowDeleteConfirm(null)}
          />
          <div className="relative bg-white rounded-lg max-w-md w-full p-6 shadow-xl transform transition-all">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this backup? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteBackup(showDeleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Backup'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DataManagement;
