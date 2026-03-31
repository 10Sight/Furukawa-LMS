import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Users,
  Mail,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Upload,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Send,
  UserPlus,
  FileText,
  Calendar,
  ChevronDown,
  Plus,
  Trash2,
  Settings,
  Play,
  Pause,
  MoreHorizontal
} from "lucide-react";

// Import API hooks
import {
  useGetBulkOperationHistoryQuery,
  useBulkEnrollUsersMutation,
  useBulkSendEmailsMutation,
  useBulkGenerateCertificatesMutation,
  useGetAllUsersQuery
} from "@/Redux/AllApi/SuperAdminApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";

// shadcn/ui components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const BulkOperations = () => {
  const [activeTab, setActiveTab] = useState("enrollment");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [operationInProgress, setOperationInProgress] = useState(false);

  // Form states
  const [enrollmentForm, setEnrollmentForm] = useState({
    userIds: [],
    courseIds: [],
    departmentId: "",
    enrollmentType: "course",
    notify: true
  });

  const [emailForm, setEmailForm] = useState({
    recipientType: "users",
    userIds: [],
    roles: [],
    departmentIds: [],
    subject: "",
    content: "",
    template: null,
    templateData: {}
  });

  const [certificateForm, setCertificateForm] = useState({
    userIds: [],
    courseId: "",
    templateId: "",
    departmentId: "",
    criteria: "completion"
  });

  // Filter states
  const [historyFilters, setHistoryFilters] = useState({
    operation: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 20
  });

  // API hooks
  const { data: operationHistory, isLoading: historyLoading, refetch: refetchHistory } =
    useGetBulkOperationHistoryQuery(historyFilters);

  const { data: usersData } = useGetAllUsersQuery({ limit: 1000 });
  const { data: departmentsData } = useGetAllDepartmentsQuery({ limit: 1000 });

  const [bulkEnrollUsers, { isLoading: enrollLoading }] = useBulkEnrollUsersMutation();
  const [bulkSendEmails, { isLoading: emailLoading }] = useBulkSendEmailsMutation();
  const [bulkGenerateCertificates, { isLoading: certificateLoading }] = useBulkGenerateCertificatesMutation();

  // Handle bulk enrollment
  const handleBulkEnrollment = async () => {
    if (!enrollmentForm.userIds.length) {
      toast.error("Please select users to enroll");
      return;
    }

    if (!enrollmentForm.courseIds.length && !enrollmentForm.departmentId) {
      toast.error("Please select courses or a department");
      return;
    }

    try {
      setOperationInProgress(true);
      const result = await bulkEnrollUsers(enrollmentForm).unwrap();

      toast.success(
        `Enrollment completed! ${result.summary.successful} successful, ${result.summary.failed} failed, ${result.summary.skipped} skipped`
      );

      // Reset form
      setEnrollmentForm({
        userIds: [],
        courseIds: [],
        departmentId: "",
        enrollmentType: "course",
        notify: true
      });

      refetchHistory();

    } catch (error) {
      toast.error(error?.data?.message || "Failed to perform bulk enrollment");
    } finally {
      setOperationInProgress(false);
    }
  };

  // Handle bulk email sending
  const handleBulkEmail = async () => {
    if (!emailForm.subject || !emailForm.content) {
      toast.error("Please provide subject and content");
      return;
    }

    if (emailForm.recipientType === 'users' && !emailForm.userIds.length) {
      toast.error("Please select users");
      return;
    }

    try {
      setOperationInProgress(true);
      const result = await bulkSendEmails(emailForm).unwrap();

      toast.success(
        `Emails sent! ${result.summary.successful} successful, ${result.summary.failed} failed. Success rate: ${result.summary.successRate}%`
      );

      // Reset form
      setEmailForm({
        recipientType: "users",
        userIds: [],
        roles: [],
        departmentIds: [],
        subject: "",
        content: "",
        template: null,
        templateData: {}
      });

      refetchHistory();

    } catch (error) {
      toast.error(error?.data?.message || "Failed to send bulk emails");
    } finally {
      setOperationInProgress(false);
    }
  };

  // Handle bulk certificate generation
  const handleBulkCertificates = async () => {
    if (!certificateForm.courseId || !certificateForm.templateId) {
      toast.error("Please select course and certificate template");
      return;
    }

    try {
      setOperationInProgress(true);
      const result = await bulkGenerateCertificates(certificateForm).unwrap();

      toast.success(
        `Certificates generated! ${result.summary.successful} successful, ${result.summary.failed} failed, ${result.summary.skipped} skipped`
      );

      // Reset form
      setCertificateForm({
        userIds: [],
        courseId: "",
        templateId: "",
        departmentId: "",
        criteria: "completion"
      });

      refetchHistory();

    } catch (error) {
      toast.error(error?.data?.message || "Failed to generate certificates");
    } finally {
      setOperationInProgress(false);
    }
  };

  // User selection component
  const UserSelector = ({ selectedUserIds, onChange, multiple = true }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);

    const filteredUsers = usersData?.data?.users?.filter(user =>
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const handleUserToggle = (userId) => {
      if (multiple) {
        const newSelection = selectedUserIds.includes(userId)
          ? selectedUserIds.filter(id => id !== userId)
          : [...selectedUserIds, userId];
        onChange(newSelection);
      } else {
        onChange([userId]);
        setShowDropdown(false);
      }
    };

    return (
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
          </div>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {selectedUserIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedUserIds.map(userId => {
              const user = filteredUsers.find(u => (u.id || u._id) === userId);
              return user ? (
                <span key={userId} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                  {user.fullName}
                  <button
                    onClick={() => handleUserToggle(userId)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
          </div>
        )}

        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-gray-500">No users found</div>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id || user._id}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${selectedUserIds.includes(user.id || user._id) ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  onClick={() => handleUserToggle(user.id || user._id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.id || user._id)}
                    onChange={() => { }}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{user.fullName}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">
                    {user.role}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  // Bulk Enrollment Tab
  const EnrollmentTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            Bulk User Enrollment
          </CardTitle>
          <CardDescription>
            Enroll multiple users into courses or departments simultaneously
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2">
              Select Users *
            </Label>
            <UserSelector
              selectedUserIds={enrollmentForm.userIds}
              onChange={(userIds) => setEnrollmentForm(prev => ({ ...prev, userIds }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2">
                Enrollment Type
              </Label>
              <Select
                value={enrollmentForm.enrollmentType}
                onValueChange={(value) => setEnrollmentForm(prev => ({ ...prev, enrollmentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select enrollment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="course">Individual Courses</SelectItem>
                  <SelectItem value="department">Section Enrollment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="notify-enrollment"
                checked={enrollmentForm.notify}
                onCheckedChange={(checked) => setEnrollmentForm(prev => ({ ...prev, notify: checked }))}
              />
              <Label htmlFor="notify-enrollment" className="text-sm font-medium">
                Send notification emails
              </Label>
            </div>
          </div>

          {enrollmentForm.enrollmentType === 'course' && (
            <div>
              <Label className="text-sm font-medium mb-2">
                Select Courses *
              </Label>
              <select
                multiple
                value={enrollmentForm.courseIds}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  setEnrollmentForm(prev => ({ ...prev, courseIds: selectedOptions }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-32"
              >
                <option value="course1">React Fundamentals</option>
                <option value="course2">Node.js Backend Development</option>
                <option value="course3">Database Design</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple courses</p>
            </div>
          )}

          {enrollmentForm.enrollmentType === 'department' && (
            <div>
              <Label className="text-sm font-medium mb-2">
                Select Section *
              </Label>
              <Select
                value={enrollmentForm.departmentId}
                onValueChange={(value) => setEnrollmentForm(prev => ({ ...prev, departmentId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {departmentsData?.data?.departments?.map((dept) => (
                    <SelectItem key={dept.id || dept._id} value={dept.id || dept._id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                  {!departmentsData?.data?.departments?.length && (
                    <SelectItem value="no-dept" disabled>No sections found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleBulkEnrollment}
            disabled={enrollLoading || operationInProgress}
            className="w-full"
            size="lg"
          >
            {enrollLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {enrollLoading ? 'Processing...' : 'Start Bulk Enrollment'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Bulk Email Tab
  const EmailTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-green-500" />
            Bulk Email Campaign
          </CardTitle>
          <CardDescription>
            Send personalized emails to multiple users, roles, or departments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2">
              Recipient Type
            </Label>
            <Select
              value={emailForm.recipientType}
              onValueChange={(value) => setEmailForm(prev => ({ ...prev, recipientType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select recipient type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="users">Specific Users</SelectItem>
                <SelectItem value="roles">By Role</SelectItem>
                <SelectItem value="departments">By Section</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {emailForm.recipientType === 'users' && (
            <div>
              <Label className="text-sm font-medium mb-2">
                Select Users *
              </Label>
              <UserSelector
                selectedUserIds={emailForm.userIds}
                onChange={(userIds) => setEmailForm(prev => ({ ...prev, userIds }))}
              />
            </div>
          )}

          {emailForm.recipientType === 'roles' && (
            <div>
              <Label className="text-sm font-medium mb-2">
                Select Roles *
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {['STUDENT', 'INSTRUCTOR', 'ADMIN'].map(role => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={emailForm.roles.includes(role)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEmailForm(prev => ({ ...prev, roles: [...prev.roles, role] }));
                        } else {
                          setEmailForm(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role) }));
                        }
                      }}
                    />
                    <Label htmlFor={`role-${role}`} className="text-sm">{role}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2">
                Subject *
              </Label>
              <Input
                type="text"
                value={emailForm.subject}
                onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Enter email subject"
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2">
                Message Content *
              </Label>
              <Textarea
                value={emailForm.content}
                onChange={(e) => setEmailForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Enter email content"
                rows={6}
              />
            </div>
          </div>

          <Button
            onClick={handleBulkEmail}
            disabled={emailLoading || operationInProgress}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {emailLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {emailLoading ? 'Sending...' : 'Send Bulk Emails'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Bulk Certificate Tab
  const CertificateTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500" />
            Bulk Certificate Generation
          </CardTitle>
          <CardDescription>
            Generate certificates for multiple users based on course completion or custom criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2">
                Course *
              </Label>
              <Select
                value={certificateForm.courseId}
                onValueChange={(value) => setCertificateForm(prev => ({ ...prev, courseId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="course1">React Fundamentals</SelectItem>
                  <SelectItem value="course2">Node.js Backend Development</SelectItem>
                  <SelectItem value="course3">Database Design</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2">
                Certificate Template *
              </Label>
              <Select
                value={certificateForm.templateId}
                onValueChange={(value) => setCertificateForm(prev => ({ ...prev, templateId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template1">Standard Certificate</SelectItem>
                  <SelectItem value="template2">Advanced Certificate</SelectItem>
                  <SelectItem value="template3">Completion Certificate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2">
                Eligibility Criteria
              </Label>
              <Select
                value={certificateForm.criteria}
                onValueChange={(value) => setCertificateForm(prev => ({ ...prev, criteria: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select criteria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completion">Course Completion</SelectItem>
                  <SelectItem value="enrollment">All Enrolled Users</SelectItem>
                  <SelectItem value="custom">Custom Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2">
                Department (Optional)
              </Label>
              <Select
                value={certificateForm.departmentId}
                onValueChange={(value) => setCertificateForm(prev => ({ ...prev, departmentId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  {departmentsData?.data?.departments?.map((dept) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                  {!departmentsData?.data?.departments?.length && (
                    <SelectItem value="no-dept" disabled>No sections found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {certificateForm.criteria === 'custom' && (
            <div>
              <Label className="text-sm font-medium mb-2">
                Select Specific Users
              </Label>
              <UserSelector
                selectedUserIds={certificateForm.userIds}
                onChange={(userIds) => setCertificateForm(prev => ({ ...prev, userIds }))}
              />
            </div>
          )}

          <Button
            onClick={handleBulkCertificates}
            disabled={certificateLoading || operationInProgress}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
            size="lg"
          >
            {certificateLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Award className="w-4 h-4 mr-2" />
            )}
            {certificateLoading ? 'Generating...' : 'Generate Certificates'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Operation History Tab
  const HistoryTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                Operation History
              </CardTitle>
              <CardDescription>
                View and monitor all bulk operations performed on the system
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => refetchHistory()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Select
              value={historyFilters.operation}
              onValueChange={(value) => setHistoryFilters(prev => ({ ...prev, operation: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Operations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                <SelectItem value="enrollment">Enrollment</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="certificates">Certificates</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={historyFilters.status}
              onValueChange={(value) => setHistoryFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={historyFilters.dateFrom}
              onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              placeholder="From date"
            />

            <Input
              type="date"
              value={historyFilters.dateTo}
              onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              placeholder="To date"
            />
          </div>

          {/* History Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading operations...
                    </TableCell>
                  </TableRow>
                ) : operationHistory?.data?.operations?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No operations found
                    </TableCell>
                  </TableRow>
                ) : (
                  operationHistory?.data?.operations?.map((operation) => (
                    <TableRow key={operation._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {operation.operationType === 'enroll users' && <UserPlus className="w-4 h-4 text-blue-500" />}
                          {operation.operationType === 'send emails' && <Mail className="w-4 h-4 text-green-500" />}
                          {operation.operationType === 'generate certificates' && <Award className="w-4 h-4 text-yellow-500" />}
                          <span className="font-medium capitalize">
                            {operation.operationType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{operation.userId?.fullName}</div>
                          <div className="text-xs text-muted-foreground">{operation.userId?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={operation.status === 'completed' ? 'default' : operation.status === 'failed' ? 'destructive' : 'secondary'}
                          className="flex items-center gap-1 w-fit"
                        >
                          {operation.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                          {operation.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {operation.status === 'in_progress' && <Clock className="w-3 h-3" />}
                          {operation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {operation.summary && (
                          <div className="text-xs space-y-1">
                            <div className="text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {operation.summary.successful || 0}
                            </div>
                            <div className="text-red-600 flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              {operation.summary.failed || 0}
                            </div>
                            {operation.summary.skipped > 0 && (
                              <div className="text-yellow-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {operation.summary.skipped}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(operation.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {operationHistory?.data?.pagination && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Showing {((operationHistory.data.pagination.currentPage - 1) * operationHistory.data.pagination.limit) + 1} to {Math.min(operationHistory.data.pagination.currentPage * operationHistory.data.pagination.limit, operationHistory.data.pagination.totalOperations)} of {operationHistory.data.pagination.totalOperations} operations
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={operationHistory.data.pagination.currentPage === 1}
                >
                  Previous
                </Button>
                <Badge variant="secondary">
                  {operationHistory.data.pagination.currentPage}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={operationHistory.data.pagination.currentPage >= operationHistory.data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const tabs = [
    { id: "enrollment", label: "Bulk Enrollment", icon: UserPlus, component: EnrollmentTab },
    { id: "email", label: "Bulk Emails", icon: Mail, component: EmailTab },
    { id: "certificates", label: "Bulk Certificates", icon: Award, component: CertificateTab },
    { id: "history", label: "Operation History", icon: Clock, component: HistoryTab }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Operations</h1>
          <p className="text-gray-600 mt-1">
            Perform bulk operations on users, send mass emails, and generate certificates
          </p>
        </div>

        <div className="flex items-center gap-2">
          {operationInProgress && (
            <Alert className="bg-blue-50 border-blue-200">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <AlertDescription className="text-blue-800">
                Operation in progress...
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="enrollment" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Bulk Enrollment
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Bulk Emails
          </TabsTrigger>
          <TabsTrigger value="certificates" className="flex items-center gap-2">
            <Award className="w-4 h-4" />
            Bulk Certificates
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Operation History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrollment" className="mt-6">
          <EnrollmentTab />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <EmailTab />
        </TabsContent>

        <TabsContent value="certificates" className="mt-6">
          <CertificateTab />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BulkOperations;
