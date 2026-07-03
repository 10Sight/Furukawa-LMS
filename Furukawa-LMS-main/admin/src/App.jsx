import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import Highcharts from 'highcharts';
Highcharts.setOptions({ accessibility: { enabled: false } });
import { Navigate } from "react-router-dom";

// Lazy-load layouts and pages to reduce initial bundle size
const HomeLayout = lazy(() => import("./Layout/HomeLayout").then(m => ({ default: m.HomeLayout })));
const InstructorLayout = lazy(() => import("./Layout/InstructorLayout").then(m => ({ default: m.InstructorLayout })));
const SuperAdminLayout = lazy(() => import("./Layout/SuperAdminLayout").then(m => ({ default: m.SuperAdminLayout })));
const StudentLayout = lazy(() => import("./Layout/StudentLayout").then(m => ({ default: m.StudentLayout })));
const Home = lazy(() => import("./pages/Home.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const DashboardLayout = lazy(() => import("./Layout/DashboardLayout.jsx"));
const CmsLayout = lazy(() => import("./Layout/CmsLayout").then(m => ({ default: m.CmsLayout })));
const CustomRoleLayout = lazy(() => import("./Layout/CustomRoleLayout").then(m => ({ default: m.CustomRoleLayout })));

const AddQuestionPaper = lazy(() => import("./pages/CMS/AddQuestionPaper.jsx"));
const Daily5MRecording = lazy(() => import("./pages/CMS/Daily5MRecording.jsx"));
const Daily5MDashboard = lazy(() => import("./pages/CMS/Daily5MDashboard.jsx"));
const DashboardHome = lazy(() => import("./pages/Dashboard/DashboardHome.jsx"));
const Attendance = lazy(() => import("./pages/Dashboard/Attendance.jsx"));
const UserManagement = lazy(() => import("./pages/Dashboard/UserManagement.jsx"));
const SetRequirements = lazy(() => import("./pages/Dashboard/SetRequirements.jsx"));
const ReportClubbing = lazy(() => import("./pages/Dashboard/ReportClubbing.jsx"));
const EmailReports = lazy(() => import("./pages/Dashboard/EmailReports.jsx"));
const RequirementUpdateLogs = lazy(() => import("./pages/Dashboard/RequirementUpdateLogs.jsx"));

import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import RequireAccess from "./components/RequireAccess";

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Lazy load heavy page components for code splitting
// Admin Pages
const Instructor = lazy(() => import("./pages/Admin/Instructor"));
const Course = lazy(() => import("./pages/Admin/Course"));
const AddModulePage = lazy(() => import("./pages/Admin/AddModulePage"));
const EditModulePage = lazy(() => import("./pages/Admin/EditModulePage"));
const AddCourse = lazy(() => import("./pages/Admin/AddCourse"));
const Departments = lazy(() => import("./pages/Admin/Departments"));
const Students = lazy(() => import("./pages/Admin/Students"));
const StudentComparison = lazy(() => import("./pages/Admin/StudentComparison"));
const DepartmentDetail = lazy(() => import("./pages/Admin/DepartmentDetail"));
const LineDetail = lazy(() => import("./pages/Admin/LineDetail"));
const SubSectionDetail = lazy(() => import("./pages/Admin/SubSectionDetail"));
const MachineDetail = lazy(() => import("./pages/Admin/MachineDetail"));
const CourseDetailPage = lazy(() => import("./pages/Admin/CourseDetailPage"));
const AddQuizPage = lazy(() => import("./pages/Admin/AddQuizPage"));
const EditQuizPage = lazy(() => import("./pages/Admin/EditQuizPage"));
const AddAssignmentPage = lazy(() => import("./pages/Admin/AddAssignmentPage"));
const AddResourcePage = lazy(() => import("./pages/Admin/AddResourcePage"));
const AddLessonPage = lazy(() => import("./pages/Admin/AddLessonPage"));
const EditLessonPage = lazy(() => import("./pages/Admin/EditLessonPage"));
const InstructorDetail = lazy(() => import("./pages/Admin/InstructorDetail"));
const StudentDetail = lazy(() => import("./pages/Admin/StudentDetail"));
const OperatorImportLogs = lazy(() => import("./pages/Admin/OperatorImportLogs"));
const Analytics = lazy(() => import("./pages/Admin/Analytics"));
const ExamHistory = lazy(() => import("./pages/Admin/ExamHistory"));
const AdminQuizMonitoring = lazy(() => import("./pages/Admin/QuizMonitoring"));
const QuizAttemptReviewPage = lazy(() => import("./pages/Admin/QuizAttemptReviewPage"));
const TestPaper = lazy(() => import("./pages/Admin/TestPaper"));
const AddTestPaper = lazy(() => import("./pages/Admin/AddTestPaper"));
const EditTestPaper = lazy(() => import("./pages/Admin/EditTestPaper"));
const AdminAttemptRequests = lazy(() => import("./pages/Admin/AttemptRequests"));
const StudentLevelManagement = lazy(() => import("./pages/Admin/StudentLevelManagement"));
const CertificateTemplates = lazy(() => import("./pages/Admin/CertificateTemplates"));
const AuditLogs = lazy(() => import("./pages/Admin/AuditLogs"));
const CourseLevelSettings = lazy(() => import("./pages/Admin/CourseLevelSettings"));
const SkillMatrix = lazy(() => import("./pages/Admin/SkillMatrix"));
const OnboardingID = lazy(() => import("./pages/Admin/OnboardingID"));
const Report = lazy(() => import("./pages/Admin/Report"));
const Cycle10 = lazy(() => import("./pages/Admin/Cycle10"));
const DailyProductionReport = lazy(() => import("./pages/Admin/DailyProductionReport"));
const RoleManager = lazy(() => import("./pages/Admin/RoleManager"));
const RoleUserManager = lazy(() => import("./pages/Admin/RoleUserManager"));
const Mentor = lazy(() => import("./pages/Admin/Mentor"));
const Supervisor = lazy(() => import("./pages/Admin/Supervisor"));
const Incharge = lazy(() => import("./pages/Admin/Incharge"));
const LineRequirementManager = lazy(() => import("./pages/Admin/LineRequirementManager.jsx"));
const DPRManage = lazy(() => import("./pages/Admin/DPRManage"));
const SixteenDayMonitoring = lazy(() => import("./pages/Admin/SixteenDayMonitoring"));
const ThreeDayMonitoring = lazy(() => import("./pages/Admin/ThreeDayMonitoring"));
const HandoverSheetPage = lazy(() => import("./pages/Admin/HandoverSheetPage"));
const AbnormalCondition = lazy(() => import("./pages/Admin/AbnormalCondition"));
const MultiSkilling = lazy(() => import("./pages/Admin/MultiSkilling"));
const DojoHiring = lazy(() => import("./pages/Admin/DojoHiring"));
const DojoCandidateDetail = lazy(() => import("./pages/Admin/DojoCandidateDetail"));
const OnJobTraining = lazy(() => import("./pages/Admin/OnJobTraining"));
const OJTShareView = lazy(() => import("./pages/Public/OJTShareView"));
const Contractors = lazy(() => import("./pages/Admin/Contractors"));
const ContractorDetail = lazy(() => import("./pages/Admin/ContractorDetail"));
const DesignationsPage = lazy(() => import("./pages/Admin/DesignationsPage"));
const DesignationUsersPage = lazy(() => import("./pages/Admin/DesignationUsersPage"));


const AdminSettings = lazy(() => import("./pages/Admin/Settings"));
const Learning = lazy(() => import("./pages/Admin/Learning"));
const CreateLearningComparison = lazy(() => import("./pages/Admin/CreateLearningComparison"));
const LearningComparisonDetail = lazy(() => import("./pages/Admin/LearningComparisonDetail"));
const EditLearningComparison = lazy(() => import("./pages/Admin/EditLearningComparison"));
const EvaluationTestList = lazy(() => import("./pages/Admin/EvaluationTest/EvaluationTestList"));
const EvaluationTestBuilder = lazy(() => import("./pages/Admin/EvaluationTest/EvaluationTestBuilder"));
const EvaluationTestAttemptPage = lazy(() => import("./pages/Admin/EvaluationTest/EvaluationTestAttemptPage"));
const EvaluationTestOperatorsPage = lazy(() => import("./pages/Admin/EvaluationTest/EvaluationTestOperatorsPage"));

// Instructor Pages
const InstructorDashboard = lazy(() => import("./pages/Instructor/Dashboard.jsx"));
const InstructorCourses = lazy(() => import("./pages/Instructor/Courses.jsx"));
const InstructorDepartments = lazy(() => import("./pages/Instructor/Departments.jsx"));
const InstructorStudents = lazy(() => import("./pages/Instructor/Students.jsx"));
const InstructorStudentDetail = lazy(() => import("./pages/Instructor/StudentDetail.jsx"));
const InstructorCourseDetailPage = lazy(() => import("./pages/Instructor/InstructorCourseDetailPage.jsx"));
const QuizMonitoring = lazy(() => import("./pages/Instructor/QuizMonitoring.jsx"));
const AssignmentMonitoring = lazy(() => import("./pages/Instructor/AssignmentMonitoring.jsx"));
const CertificateIssuance = lazy(() => import("./pages/Instructor/CertificateIssuance.jsx"));
const InstructorAttemptRequests = lazy(() => import("./pages/Instructor/AttemptRequests.jsx"));
const InstructorSkillMatrix = lazy(() => import("./pages/Instructor/SkillMatrix.jsx"));

// SuperAdmin Pages
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdmin/Dashboard.jsx"));
const AllUsersManagement = lazy(() => import("./pages/SuperAdmin/AllUsersManagement.jsx"));
const CreateAdmin = lazy(() => import("./pages/SuperAdmin/CreateAdmin.jsx")); // Admin creation page
const SoftDeletedUsersManagement = lazy(() => import("./pages/SuperAdmin/SoftDeletedUsersManagement.jsx"));
const SystemAuditLogs = lazy(() => import("./pages/SuperAdmin/SystemAuditLogs.jsx"));
const SystemSettings = lazy(() => import("./pages/SuperAdmin/SystemSettings.jsx"));
const AdvancedAnalytics = lazy(() => import("./pages/SuperAdmin/AdvancedAnalytics.jsx"));
const DataManagement = lazy(() => import("./pages/SuperAdmin/DataManagement.jsx"));
const RolesPermissions = lazy(() => import("./pages/SuperAdmin/RolesPermissions.jsx"));
const SystemMonitoring = lazy(() => import("./pages/SuperAdmin/SystemMonitoring.jsx"));
const BulkOperations = lazy(() => import("./pages/SuperAdmin/BulkOperations.jsx"));
const CertificateManagement = lazy(() => import("./pages/SuperAdmin/CertificateManagement.jsx"));

// Student Pages
const StudentDashboard = lazy(() => import("./pages/Student/Dashboard.jsx"));
const StudentProfile = lazy(() => import("./pages/Student/Profile.jsx"));
const LessonDetail = lazy(() => import("./pages/Student/LessonDetail.jsx"));
const TakeQuiz = lazy(() => import("./pages/Student/TakeQuiz.jsx"));
const Reports = lazy(() => import("./pages/Student/Reports.jsx"));
const StudentCertificates = lazy(() => import("./pages/Student/Certificates.jsx"));
const ResourcePreview = lazy(() => import("./pages/Student/ResourcePreview.jsx"));
const StudentOnJobTraining = lazy(() => import("./pages/Student/OnJobTraining.jsx"));
const StudentFeedback = lazy(() => import("./pages/Student/Feedback.jsx"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));

const RoleRedirect = () => {
  const { user } = useSelector((state) => state.auth);

  if (user?.isAdmin) return <Navigate to="/admin" replace />;
  if (user?.isTrainer) return <Navigate to="/trainer" replace />;
  if (user?.isEmployee) return <Navigate to="/student" replace />;

  // Fallback if no specific role flag is true, though one should be
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
      <p className="text-gray-600 mb-6">Your account does not have the required permissions to access any dashboard.</p>
      <button
        onClick={() => window.location.href = '/login'}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Back to Login
      </button>
    </div>
  );
};

const App = () => {
  const { user } = useSelector((state) => state.auth);
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public route for login */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* Public, no-login read-only OJT share link */}
          <Route path="/ojt/share/:token" element={<OJTShareView />} />

          {/* Landing Page as default authenticated route */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LandingPage />
              </ProtectedRoute>
            }
          />

          {/* New Manpower Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                {user?.isAdmin || user?.role === 'SUPERADMIN' || user?.role === 'CUSTOM' ? (
                  <DashboardLayout />
                ) : (
                  <Navigate to="/" replace />
                )}
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="onboarding-id" element={<OnboardingID />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="requirements" element={<SetRequirements />} />
            <Route path="requirement-logs" element={<RequirementUpdateLogs />} />
            <Route path="email-reports" element={<EmailReports />} />
            <Route path="line-requirements" element={<LineRequirementManager />} />
            <Route path="role-manager" element={<RoleManager />} />
            <Route path="manage-role/:roleId" element={<RoleUserManager />} />
          </Route>

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <RequireAccess allow="isAdmin">
                  <HomeLayout />
                </RequireAccess>
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="trainers" element={<Instructor pageName="Instructor" />} />
            <Route path="trainers/:id" element={<InstructorDetail />} />
            <Route path="courses" element={<Course pageName="Courses" />} />
            <Route path="courses/:courseId" element={<CourseDetailPage pageName="Add Modules" />} />
            <Route path="add-course" element={<AddCourse />} />
            <Route path="departments" element={<Departments pageName="Departments" />} />
            <Route path="employees" element={<Students pageName="Employees" />} />
            <Route path="employees/import-logs" element={<OperatorImportLogs />} />
            <Route path="employees/comparison" element={<StudentComparison />} />
            <Route path="employees/:studentId" element={<StudentDetail />} />
            <Route path="departments/:departmentId" element={<DepartmentDetail pageName="Department Detail" />} />
            <Route path="departments/:departmentId/lines/:lineId" element={<LineDetail />} />
            <Route path="departments/:departmentId/lines/:lineId/sub-sections/:subSectionId" element={<SubSectionDetail />} />
            <Route path="departments/:departmentId/lines/:lineId/sub-sections/:subSectionId/machines/:machineId" element={<MachineDetail />} />
            <Route path="add-quiz/:courseId" element={<AddQuizPage />} />
            <Route path="edit-quiz/:quizId" element={<EditQuizPage />} />
            <Route path="add-module/:courseId" element={<AddModulePage />} />
            <Route path="edit-module/:moduleId" element={<EditModulePage />} />
            <Route path="add-lesson/:moduleId" element={<AddLessonPage />} />
            <Route path="edit-lesson/:moduleId/:lessonId" element={<EditLessonPage />} />
            <Route path="add-assignment/:courseId" element={<AddAssignmentPage />} />
            <Route path="add-resource/:courseId" element={<AddResourcePage />} />
            <Route path="edit-lesson/:moduleId/:lessonId" element={<EditLessonPage />} />
            <Route path="quiz-monitoring" element={<AdminQuizMonitoring />} />
            <Route path="quiz-monitoring/review/:attemptId" element={<QuizAttemptReviewPage />} />
            <Route path="test-paper" element={<TestPaper />} />
            <Route path="add-test-paper" element={<AddTestPaper />} />
            <Route path="edit-test-paper/:quizId" element={<EditTestPaper />} />
            <Route path="take-test/:quizId" element={<TakeQuiz />} />
            <Route path="attempt-requests" element={<AdminAttemptRequests />} />
            <Route path="analytics" element={<Analytics pageName="Recent Activity" />} />
            <Route path="exam-history" element={<ExamHistory />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="student-levels" element={<StudentLevelManagement />} />
            <Route path="certificate-templates" element={<CertificateTemplates pageName="Certificate Templates" />} />
            <Route path="course-level-settings" element={<CourseLevelSettings />} />
            <Route path="course-level-setting" element={<CourseLevelSettings />} />
            <Route path="skill-matrix" element={<SkillMatrix />} />
            <Route path="report" element={<Report />} />
            <Route path="10-cycle" element={<Cycle10 />} />
            <Route path="daily-production-report" element={<DailyProductionReport />} />
            <Route path="dpr-manage" element={<DPRManage />} />
            <Route path="on-job-training" element={<OnJobTraining />} />
            <Route path="16-day-monitoring/:studentId?" element={<SixteenDayMonitoring />} />
            <Route path="3-day-monitoring/:studentId?" element={<ThreeDayMonitoring />} />
            <Route path="handover-sheet" element={<HandoverSheetPage />} />
            <Route path="multi-skilling" element={<MultiSkilling />} />
            <Route path="dojo-hiring" element={<DojoHiring />} />
            <Route path="dojo-hiring/:studentId" element={<DojoCandidateDetail />} />
            <Route path="role-manager" element={<RoleManager />} />
            <Route path="manage-role/:roleId" element={<RoleUserManager />} />
            <Route path="all-users" element={<AllUsersManagement />} />
            <Route path="mentors" element={<Mentor />} />
            <Route path="supervisors" element={<Supervisor />} />
            <Route path="incharges" element={<Incharge />} />
            <Route path="line-requirements" element={<LineRequirementManager />} />
            <Route path="resource-preview/:resourceId" element={<ResourcePreview />} />
            <Route path="report-clubbing" element={<ReportClubbing />} />
            <Route path="learning" element={<Learning />} />
            <Route path="learning/create" element={<CreateLearningComparison />} />
            <Route path="learning/edit/:id" element={<EditLearningComparison />} />
            <Route path="learning/:id" element={<LearningComparisonDetail />} />
            <Route path="evaluation-test" element={
              <RequireAccess allow="dojo_evaluation_test:view">
                <EvaluationTestList />
              </RequireAccess>
            } />
            <Route path="evaluation-test/:testId/operators" element={
              <RequireAccess allow="dojo_evaluation_test:view">
                <EvaluationTestOperatorsPage />
              </RequireAccess>
            } />
            <Route path="add-evaluation-test" element={
              <RequireAccess allow="dojo_evaluation_test:create">
                <EvaluationTestBuilder />
              </RequireAccess>
            } />
            <Route path="edit-evaluation-test/:id" element={
              <RequireAccess allow="dojo_evaluation_test:create">
                <EvaluationTestBuilder />
              </RequireAccess>
            } />
            <Route path="attempt-evaluation-test/:id" element={
              <RequireAccess allow="dojo_evaluation_test:take">
                <EvaluationTestAttemptPage />
              </RequireAccess>
            } />
            <Route path="view-evaluation-attempt/:attemptId" element={
              <RequireAccess allow="dojo_evaluation_test:view">
                <EvaluationTestAttemptPage isViewMode={true} />
              </RequireAccess>
            } />
            <Route path="contractors" element={<Contractors />} />
            <Route path="contractors/:contractorId" element={<ContractorDetail />} />
            <Route path="designations" element={<DesignationsPage />} />
            <Route path="designations/:designationName" element={<DesignationUsersPage />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* CMS Route */}
          <Route path="/cms" element={
            <ProtectedRoute>
              <CmsLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Daily5MDashboard />} />
            <Route path="add-question-paper" element={<AddQuestionPaper />} />
            <Route path="daily-5m-recording" element={
              <RequireAccess allow="daily5m:read">
                <Daily5MRecording />
              </RequireAccess>
            } />
            <Route path="abnormal-condition" element={<AbnormalCondition />} />
          </Route>

          {/* Instructor routes */}
          <Route
            path="/trainer"
            element={
              <ProtectedRoute>
                <RequireAccess allow="isTrainer">
                  <InstructorLayout />
                </RequireAccess>
              </ProtectedRoute>
            }
          >
            <Route index element={<InstructorDashboard />} />
            <Route path="courses" element={<InstructorCourses />} />
            <Route path="courses/:courseId" element={<InstructorCourseDetailPage />} />
            <Route path="add-module/:courseId" element={<AddModulePage />} />
            <Route path="edit-module/:moduleId" element={<EditModulePage />} />
            <Route path="add-lesson/:moduleId" element={<AddLessonPage />} />
            <Route path="edit-lesson/:moduleId/:lessonId" element={<EditLessonPage />} />
            <Route path="add-quiz/:courseId" element={<AddQuizPage />} />
            <Route path="edit-quiz/:quizId" element={<EditQuizPage />} />
            <Route path="add-assignment/:courseId" element={<AddAssignmentPage />} />
            <Route path="add-resource/:courseId" element={<AddResourcePage />} />
            <Route path="departments" element={<InstructorDepartments />} />
            <Route path="departments/:departmentId/lines/:lineId/sub-sections/:subSectionId/machines/:machineId" element={<MachineDetail />} />
            <Route path="employees" element={<InstructorStudents />} />
            <Route path="employees/import-logs" element={<OperatorImportLogs />} />
            <Route path="employees/:studentId" element={<InstructorStudentDetail />} />
            <Route path="quiz-monitoring" element={<QuizMonitoring />} />
            <Route path="quiz-monitoring/review/:attemptId" element={<QuizAttemptReviewPage />} />
            <Route path="assignment-monitoring" element={<AssignmentMonitoring />} />
            <Route path="certificate-issuance" element={<CertificateIssuance />} />
            <Route path="attempt-requests" element={<InstructorAttemptRequests />} />
            <Route path="resource-preview/:resourceId" element={<ResourcePreview />} />
            <Route path="skill-matrix" element={<InstructorSkillMatrix />} />
            <Route path="on-job-training" element={<OnJobTraining />} />
          </Route>

          {/* SuperAdmin routes */}
          <Route
            path="/superadmin"
            element={
              <ProtectedRoute>
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SuperAdminDashboard />} />

            {/* User Management Routes */}
            <Route path="all-users" element={<AllUsersManagement />} />
            <Route path="line-requirements" element={<LineRequirementManager />} />
            <Route path="add-admin" element={<CreateAdmin />} />
            <Route path="trainers" element={<Instructor pageName="Instructors" />} />
            <Route path="trainers/:id" element={<InstructorDetail />} />
            <Route path="employees" element={<Students pageName="Employees" />} />
            <Route path="employees/import-logs" element={<OperatorImportLogs />} />
            <Route path="employees/comparison" element={<StudentComparison />} />
            <Route path="employees/:studentId" element={<StudentDetail />} />
            <Route path="soft-deleted-users" element={<SoftDeletedUsersManagement />} />
            <Route path="roles-permissions" element={<RolesPermissions />} />

            {/* Content Management Routes */}
            <Route path="courses" element={<Course pageName="Courses" />} />
            <Route path="courses/:courseId" element={<CourseDetailPage pageName="Course Management" />} />
            <Route path="add-course" element={<AddCourse />} />
            <Route path="add-quiz/:courseId" element={<AddQuizPage />} />
            <Route path="add-module/:courseId" element={<AddModulePage />} />
            <Route path="add-lesson/:moduleId" element={<AddLessonPage />} />
            <Route path="add-assignment/:courseId" element={<AddAssignmentPage />} />
            <Route path="add-resource/:courseId" element={<AddResourcePage />} />
            <Route path="edit-lesson/:moduleId/:lessonId" element={<EditLessonPage />} />
            <Route path="departments" element={<Departments pageName="Departments" />} />
            <Route path="departments/:departmentId" element={<DepartmentDetail pageName="Department Detail" />} />
            <Route path="departments/:departmentId/lines/:lineId" element={<LineDetail />} />
            <Route path="departments/:departmentId/lines/:lineId/sub-sections/:subSectionId" element={<SubSectionDetail />} />
            <Route path="departments/:departmentId/lines/:lineId/sub-sections/:subSectionId/machines/:machineId" element={<MachineDetail />} />
            <Route path="certificates" element={<CertificateManagement />} />

            {/* System Management Routes */}
            <Route path="audit-logs" element={<SystemAuditLogs />} />
            <Route path="system-settings" element={<SystemSettings />} />
            <Route path="analytics-reports" element={<AdvancedAnalytics />} />
            <Route path="system-monitoring" element={<SystemMonitoring />} />

            {/* Advanced Operations Routes */}
            <Route path="data-management" element={<DataManagement />} />
            <Route path="bulk-operations" element={<BulkOperations />} />
            <Route path="resource-preview/:resourceId" element={<ResourcePreview />} />

            {/* Legacy Routes for Compatibility */}
            <Route path="student-levels" element={<StudentLevelManagement />} />
            <Route path="certificate-templates" element={<CertificateTemplates pageName="Certificate Templates" />} />
            <Route path="course-level-settings" element={<CourseLevelSettings />} />
            <Route path="course-level-setting" element={<CourseLevelSettings />} />
          </Route>

          {/* Student routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute>
                <RequireAccess allow="isEmployee">
                  <StudentLayout />
                </RequireAccess>
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentDashboard />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="test-paper" element={<TestPaper />} />
            <Route path="quiz/:quizId" element={<TakeQuiz />} />
            <Route path="certificates" element={<StudentCertificates />} />
          </Route>

          {/* Custom Role Portal routes */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <CustomRoleLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />

            {/* Common Admin/Trainer Pages mapped to Portal */}
            <Route path="daily-5m-recording" element={<Daily5MRecording />} />
            <Route path="daily-5m-dashboard" element={<Daily5MDashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="report" element={<Report />} />
            <Route path="skill-matrix" element={<SkillMatrix />} />
            <Route path="all-users" element={<AllUsersManagement />} />
            <Route path="courses" element={<Course pageName="Courses" />} />
            <Route path="courses/:courseId" element={<CourseDetailPage />} />
            <Route path="departments" element={<Departments pageName="Departments" />} />
            <Route path="departments/:departmentId" element={<DepartmentDetail />} />
            <Route path="departments/:departmentId/lines/:lineId" element={<LineDetail />} />
            <Route path="departments/:departmentId/lines/:lineId/sub-sections/:subSectionId" element={<SubSectionDetail />} />
            <Route path="departments/:departmentId/lines/:lineId/sub-sections/:subSectionId/machines/:machineId" element={<MachineDetail />} />
            <Route path="employees" element={<Students pageName="Trainees" />} />
            <Route path="employees/comparison" element={<StudentComparison />} />
            <Route path="employees/:studentId" element={<StudentDetail />} />
            <Route path="trainees" element={<Students pageName="Trainees" />} />
            <Route path="trainees/comparison" element={<StudentComparison />} />
            <Route path="trainees/:studentId" element={<StudentDetail />} />
            <Route path="trainers/:id" element={<InstructorDetail />} />
            <Route path="dojo-hiring/:studentId" element={<DojoCandidateDetail />} />
            <Route path="manage-role/:roleId" element={<RoleUserManager />} />
            <Route path="quiz-monitoring" element={<AdminQuizMonitoring />} />
            <Route path="test-paper" element={<TestPaper />} />
            <Route path="add-test-paper" element={<AddTestPaper />} />
            <Route path="edit-test-paper/:quizId" element={<EditTestPaper />} />
            <Route path="take-test/:quizId" element={<TakeQuiz />} />
            <Route path="attempt-requests" element={<AdminAttemptRequests />} />
            <Route path="10-cycle" element={<Cycle10 />} />
            <Route path="daily-production-report" element={<DailyProductionReport />} />
            <Route path="on-job-training" element={<OnJobTraining />} />
            <Route path="onboarding-id" element={<OnboardingID />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="requirements" element={<SetRequirements />} />
            <Route path="requirement-logs" element={<RequirementUpdateLogs />} />
            <Route path="email-reports" element={<EmailReports />} />
            <Route path="line-requirements" element={<LineRequirementManager />} />
            <Route path="dpr-manage" element={<DPRManage />} />
            <Route path="16-day-monitoring" element={<SixteenDayMonitoring />} />
            <Route path="3-day-monitoring" element={<ThreeDayMonitoring />} />
            <Route path="handover-sheet" element={<HandoverSheetPage />} />
            <Route path="abnormal-condition" element={<AbnormalCondition />} />
            <Route path="learning" element={<Learning />} />
            <Route path="learning/create" element={<CreateLearningComparison />} />
            <Route path="learning/edit/:id" element={<EditLearningComparison />} />
            <Route path="learning/:id" element={<LearningComparisonDetail />} />
            <Route path="designations" element={<DesignationsPage />} />
            <Route path="designations/:designationName" element={<DesignationUsersPage />} />
          </Route>

          {/* Fallback routes */}
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
