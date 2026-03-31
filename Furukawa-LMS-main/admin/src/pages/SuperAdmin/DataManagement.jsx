import React, { useState, useEffect } from "react";
import {
  useCreateDatabaseBackupMutation,
  useGetBackupHistoryQuery,
  useRestoreFromBackupMutation,
  useDeleteBackupMutation,
  useExportSystemDataMutation,
  useImportSystemDataMutation,
  useGetDataStatisticsQuery,
  useGetDataOperationHistoryQuery,
  useCleanupOldDataMutation
} from "../../Redux/AllApi/SuperAdminApi";
import {
  Database,
  Download,
  Upload,
  RefreshCcw,
  Trash2,
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
  TrendingUp,
  Zap
} from "lucide-react";
import { toast } from "react-hot-toast";

const DataManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [backupConfig, setBackupConfig] = useState({
    includeFiles: false,
    compression: true,
    encryption: false,
    description: ''
  });
  const [exportConfig, setExportConfig] = useState({
    collections: [],
    format: 'json',
    includeMetadata: true,
    dateFrom: '',
    dateTo: ''
  });
  const [importConfig, setImportConfig] = useState({
    mode: 'append',
    collections: [],
    validateData: true
  });
  const [cleanupConfig, setCleanupConfig] = useState({
    cleanupAuditLogs: false,
    auditLogRetentionDays: 90,
    cleanupBackups: false,
    backupRetentionDays: 30,
    dryRun: true
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // API Hooks
  const [createBackup, { isLoading: creatingBackup }] = useCreateDatabaseBackupMutation();
  const [restoreBackup, { isLoading: restoring }] = useRestoreFromBackupMutation();
  const [deleteBackup, { isLoading: deleting }] = useDeleteBackupMutation();
  const [exportData, { isLoading: exporting }] = useExportSystemDataMutation();
  const [importData, { isLoading: importing }] = useImportSystemDataMutation();
  const [cleanupData, { isLoading: cleaning }] = useCleanupOldDataMutation();

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

  // Handle file upload
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'application/json') {
        setSelectedFile(file);
      } else {
        toast.error('Please select a JSON file');
        event.target.value = '';
      }
    }
  };

  // Create backup
  const handleCreateBackup = async () => {
    try {
      const result = await createBackup(backupConfig).unwrap();
      toast.success('Backup created successfully');
      refetchBackups();
      setBackupConfig({
        includeFiles: false,
        compression: true,
        encryption: false,
        description: ''
      });
    } catch (error) {
      toast.error(error.data?.message || 'Failed to create backup');
    }
  };

  // Restore from backup
  const handleRestoreBackup = async (backupId) => {
    try {
      await restoreBackup({
        backupId,
        collections: [],
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

  // Export data
  const handleExportData = async () => {
    try {
      const result = await exportData(exportConfig).unwrap();

      // Create download link
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lms_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      toast.error(error.data?.message || 'Failed to export data');
    }
  };

  // Import data
  const handleImportData = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to import');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('dataFile', selectedFile);
      formData.append('mode', importConfig.mode);
      formData.append('validateData', importConfig.validateData);

      const result = await importData(formData).unwrap();
      toast.success(`Import completed: ${result.data.summary.totalImported} imported, ${result.data.summary.totalUpdated} updated`);
      setSelectedFile(null);
      document.getElementById('fileInput').value = '';
      refetchStats();
    } catch (error) {
      toast.error(error.data?.message || 'Failed to import data');
    }
  };

  // Cleanup old data
  const handleCleanupData = async () => {
    try {
      const result = await cleanupData(cleanupConfig).unwrap();

      if (cleanupConfig.dryRun) {
        const auditCount = result.data.results.auditLogs?.toDelete || 0;
        const backupCount = result.data.results.backups?.toDelete || 0;
        toast.success(`Cleanup preview: ${auditCount} audit logs and ${backupCount} backups would be deleted`);
      } else {
        const auditDeleted = result.data.results.auditLogs?.deleted || 0;
        const backupDeleted = result.data.results.backups?.deleted || 0;
        toast.success(`Cleanup completed: ${auditDeleted} audit logs and ${backupDeleted} backups deleted`);
      }
    } catch (error) {
      toast.error(error.data?.message || 'Failed to cleanup data');
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
    { id: 'import-export', label: 'Import/Export', icon: RefreshCcw },
    { id: 'cleanup', label: 'Data Cleanup', icon: Trash2 },
    { id: 'operations', label: 'Operation History', icon: Clock }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
          <p className="text-gray-600 mt-1">
            Comprehensive database backup, restore, export, import, and cleanup utilities
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
              {dataStats?.data?.statistics && Object.entries(dataStats.data.statistics).map(([key, stats]) => {
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
            {/* Create Backup Section */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Create New Backup</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={backupConfig.description}
                      onChange={(e) => setBackupConfig({ ...backupConfig, description: e.target.value })}
                      placeholder="Enter backup description..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center space-x-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={backupConfig.compression}
                        onChange={(e) => setBackupConfig({ ...backupConfig, compression: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Enable compression</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={backupConfig.includeFiles}
                        onChange={(e) => setBackupConfig({ ...backupConfig, includeFiles: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Include files</span>
                    </label>
                  </div>

                  <button
                    onClick={handleCreateBackup}
                    disabled={creatingBackup}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creatingBackup ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Archive className="h-4 w-4 mr-2" />
                    )}
                    Create Backup
                  </button>
                </div>
              </div>
            </div>

            {/* Backup History */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Backup History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Backup ID
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
                      <tr key={backup._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {backup.backup?.id || backup._id}
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
                              onClick={() => setShowRestoreConfirm(backup.backup?.id || backup._id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Restore
                            </button>
                          )}
                          <button
                            onClick={() => setShowDeleteConfirm(backup.backup?.id || backup._id)}
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

        {activeTab === 'import-export' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Export Data */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Download className="h-5 w-5 text-blue-600 mr-2" />
                  Export Data
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Collections to Export
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableCollections.map((collection) => (
                      <label key={collection.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={exportConfig.collections.includes(collection.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExportConfig({
                                ...exportConfig,
                                collections: [...exportConfig.collections, collection.id]
                              });
                            } else {
                              setExportConfig({
                                ...exportConfig,
                                collections: exportConfig.collections.filter(c => c !== collection.id)
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{collection.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
                    <input
                      type="date"
                      value={exportConfig.dateFrom}
                      onChange={(e) => setExportConfig({ ...exportConfig, dateFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
                    <input
                      type="date"
                      value={exportConfig.dateTo}
                      onChange={(e) => setExportConfig({ ...exportConfig, dateTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportConfig.includeMetadata}
                    onChange={(e) => setExportConfig({ ...exportConfig, includeMetadata: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include metadata</span>
                </label>

                <button
                  onClick={handleExportData}
                  disabled={exporting}
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export Data
                </button>
              </div>
            </div>

            {/* Import Data */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Upload className="h-5 w-5 text-green-600 mr-2" />
                  Import Data
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select JSON File
                  </label>
                  <input
                    id="fileInput"
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-1">
                      Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Import Mode
                  </label>
                  <select
                    value={importConfig.mode}
                    onChange={(e) => setImportConfig({ ...importConfig, mode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="append">Append (add/update records)</option>
                    <option value="replace">Replace (clear and import)</option>
                  </select>
                </div>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={importConfig.validateData}
                    onChange={(e) => setImportConfig({ ...importConfig, validateData: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Validate data before import</span>
                </label>

                <button
                  onClick={handleImportData}
                  disabled={importing || !selectedFile}
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Import Data
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cleanup' && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Trash2 className="h-5 w-5 text-red-600 mr-2" />
                Data Cleanup
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Clean up old audit logs and backup files to free up storage space
              </p>
            </div>
            <div className="p-6 space-y-6">
              {/* Audit Logs Cleanup */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={cleanupConfig.cleanupAuditLogs}
                    onChange={(e) => setCleanupConfig({ ...cleanupConfig, cleanupAuditLogs: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Clean up old audit logs
                  </label>
                </div>
                {cleanupConfig.cleanupAuditLogs && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Retention period (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={cleanupConfig.auditLogRetentionDays}
                      onChange={(e) => setCleanupConfig({ ...cleanupConfig, auditLogRetentionDays: parseInt(e.target.value) })}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Audit logs older than this will be deleted
                    </p>
                  </div>
                )}
              </div>

              {/* Backup Cleanup */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={cleanupConfig.cleanupBackups}
                    onChange={(e) => setCleanupConfig({ ...cleanupConfig, cleanupBackups: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Clean up old backup files
                  </label>
                </div>
                {cleanupConfig.cleanupBackups && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Retention period (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={cleanupConfig.backupRetentionDays}
                      onChange={(e) => setCleanupConfig({ ...cleanupConfig, backupRetentionDays: parseInt(e.target.value) })}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Backup files older than this will be deleted
                    </p>
                  </div>
                )}
              </div>

              {/* Dry Run Option */}
              <div className="flex items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <input
                  type="checkbox"
                  checked={cleanupConfig.dryRun}
                  onChange={(e) => setCleanupConfig({ ...cleanupConfig, dryRun: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">
                  Dry run (preview only, don't delete anything)
                </label>
              </div>

              <button
                onClick={handleCleanupData}
                disabled={cleaning || (!cleanupConfig.cleanupAuditLogs && !cleanupConfig.cleanupBackups)}
                className={`inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${cleanupConfig.dryRun
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {cleaning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                {cleanupConfig.dryRun ? 'Preview Cleanup' : 'Execute Cleanup'}
              </button>
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
                    <tr key={operation._id}>
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
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
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
                disabled={restoring}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {restoring ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
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
        </div>
      )}
    </div>
  );
};

export default DataManagement;
