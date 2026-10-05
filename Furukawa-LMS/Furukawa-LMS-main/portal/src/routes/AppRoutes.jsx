import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import Highcharts from 'highcharts';
Highcharts.setOptions({ accessibility: { enabled: false } });
import { Navigate } from "react-router-dom";

// Lazy-load layouts and pages to reduce initial bundle size
const HomeLayout = lazy(() => import("../components/layout/HomeLayout.jsx").then(m => ({ default: m.HomeLayout })));
const InstructorLayout = lazy(() => import("../components/layout/InstructorLayout.jsx").then(m => ({ default: m.InstructorLayout })));
const SuperAdminLayout = lazy(() => import("../components/layout/SuperAdminLayout.jsx").then(m => ({ default: m.SuperAdminLayout })));
const StudentLayout = lazy(() => import("../components/layout/StudentLayout.jsx").then(m => ({ default: m.StudentLayout })));
const Home = lazy(() => import("../pages/dashboard/admin/Home.jsx"));
const Login = lazy(() => import("../pages/login/Login.jsx"));
const LandingPage = lazy(() => import("../pages/home/LandingPage.jsx"));
const DashboardLayout = lazy(() => import("../components/layout/DashboardLayout.jsx"));
const FmeDashboardPage = lazy(() => import("../pages/cms/FmeDashboardPage.jsx"));
const CmsLayout = lazy(() => import("../components/layout/CmsLayout.jsx").then(m => ({ default: m.CmsLayout })));
const CustomRoleLayout = lazy(() => import("../components/layout/CustomRoleLayout.jsx").then(m => ({ default: m.CustomRoleLayout })));
const DailyMeetingLayout = lazy(() => import("../components/layout/DailyMeetingLayout.jsx").then(m => ({ default: m.DailyMeetingLayout })));

const AddQuestionPaper = lazy(() => import("../pages/assessments/question-papers/AddQuestionPaper.jsx"));
const Daily5MRecording = lazy(() => import("../pages/production/daily-5m/Daily5MRecording.jsx"));
const Daily5MDashboard = lazy(() => import("../pages/production/daily-5m/Daily5MDashboard.jsx"));
const DailyMeeting = lazy(() => import("../pages/meetings/DailyMeeting.jsx"));
const MisPortalHub = lazy(() => import("../pages/meetings/MisPortalHub.jsx"));
const MonthlyMeetingReport = lazy(() => import("../pages/meetings/MonthlyMeetingReport.jsx"));
const DashboardHome = lazy(() => import("../pages/dashboard/admin/DashboardHome.jsx"));
const Attendance = lazy(() => import("../pages/attendance/Attendance.jsx"));
const UserManagement = lazy(() => import("../pages/users/admin/UserManagement.jsx"));
const SetRequirements = lazy(() => import("../pages/requirements/SetRequirements.jsx"));
const ReportClubbing = lazy(() => import("../pages/reports/admin/ReportClubbing.jsx"));
const EmailReports = lazy(() => import("../pages/reports/admin/EmailReports.jsx"));
const RequirementUpdateLogs = lazy(() => import("../pages/requirements/RequirementUpdateLogs.jsx"));

import ProtectedRoute from "./guards/ProtectedRoute.jsx";
import PublicRoute from "./guards/PublicRoute.jsx";
import RequireAccess from "./guards/RequireAccess.jsx";

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Lazy load heavy page components for code splitting
// Admin Pages
const Instructor = lazy(() => import("../pages/users/admin/Instructor.jsx"));
const Course = lazy(() => import("../pages/courses/admin/Course.jsx"));
const AddModulePage = lazy(() => import("../pages/courses/admin/AddModulePage.jsx"));
const EditModulePage = lazy(() => import("../pages/courses/admin/EditModulePage.jsx"));
const AddCourse = lazy(() => import("../pages/courses/admin/AddCourse.jsx"));
const Departments = lazy(() => import("../pages/departments/admin/Departments.jsx"));
const Students = lazy(() => import("../pages/users/admin/Students.jsx"));
const StudentComparison = lazy(() => import("../pages/users/admin/StudentComparison.jsx"));
const DepartmentDetail = lazy(() => import("../pages/departments/admin/DepartmentDetail.jsx"));
const LineDetail = lazy(() => import("../pages/departments/admin/LineDetail.jsx"));
const SubSectionDetail = lazy(() => import("../pages/departments/admin/SubSectionDetail.jsx"));
const MachineDetail = lazy(() => import("../pages/departments/admin/MachineDetail.jsx"));
const CourseDetailPage = lazy(() => import("../pages/courses/admin/CourseDetailPage.jsx"));
const AddQuizPage = lazy(() => import("../pages/assessments/admin/AddQuizPage.jsx"));
const EditQuizPage = lazy(() => import("../pages/assessments/admin/EditQuizPage.jsx"));
const AddAssignmentPage = lazy(() => import("../pages/assessments/admin/AddAssignmentPage.jsx"));
const AddResourcePage = lazy(() => import("../pages/courses/admin/AddResourcePage.jsx"));
const AddLessonPage = lazy(() => import("../pages/courses/admin/AddLessonPage.jsx"));
const EditLessonPage = lazy(() => import("../pages/courses/admin/EditLessonPage.jsx"));
const InstructorDetail = lazy(() => import("../pages/users/admin/InstructorDetail.jsx"));
const StudentDetail = lazy(() => import("../pages/users/admin/StudentDetail.jsx"));
const OperatorImportLogs = lazy(() => import("../pages/users/admin/OperatorImportLogs.jsx"));
const Analytics = lazy(() => import("../pages/reports/admin/Analytics.jsx"));
const ExamHistory = lazy(() => import("../pages/assessments/admin/ExamHistory.jsx"));
const AdminQuizMonitoring = lazy(() => import("../pages/assessments/admin/QuizMonitoring.jsx"));
const QuizAttemptReviewPage = lazy(() => import("../pages/assessments/admin/QuizAttemptReviewPage.jsx"));
const TestPaper = lazy(() => import("../pages/training/monitoring/test-paper/index.js"));
const AddTestPaper = lazy(() => import("../pages/training/monitoring/test-paper/AddTestPaper.jsx"));
const EditTestPaper = lazy(() => import("../pages/training/monitoring/test-paper/EditTestPaper.jsx"));
const AdminAttemptRequests = lazy(() => import("../pages/assessments/admin/AttemptRequests.jsx"));
const StudentLevelManagement = lazy(() => import("../pages/skills/admin/StudentLevelManagement.jsx"));
const CertificateTemplates = lazy(() => import("../pages/certificates/admin/CertificateTemplates.jsx"));
const AuditLogs = lazy(() => import("../pages/reports/admin/AuditLogs.jsx"));
const CourseLevelSettings = lazy(() => import("../pages/courses/admin/CourseLevelSettings.jsx"));
const SkillMatrix = lazy(() => import("../pages/skills/skill-evaluation/SkillMatrixPage.jsx"));
const OnboardingID = lazy(() => import("../pages/users/admin/OnboardingID.jsx"));
const Report = lazy(() => import("../pages/reports/admin/Report.jsx"));
const Cycle10 = lazy(() => import("../pages/training/monitoring/cycle-10/index.js"));
const Cycle10LayoutEditor = lazy(() => import("../pages/training/monitoring/cycle-10/Cycle10LayoutEditor.jsx"));
const DailyProductionReport = lazy(() => import("../pages/production/DailyProductionReport.jsx"));
const RoleManager = lazy(() => import("../pages/users/admin/RoleManager.jsx"));
const RoleUserManager = lazy(() => import("../pages/users/admin/RoleUserManager.jsx"));
const Mentor = lazy(() => import("../pages/users/admin/Mentor.jsx"));
const MentorDetail = lazy(() => import("../pages/users/admin/MentorDetail.jsx"));
const Supervisor = lazy(() => import("../pages/users/admin/Supervisor.jsx"));
const Incharge = lazy(() => import("../pages/users/admin/Incharge.jsx"));
const LineRequirementManager = lazy(() => import("../pages/requirements/LineRequirementManager.jsx"));
const RevisionTable = lazy(() => import("../pages/reports/admin/RevisionTable.jsx"));
const RevisionSheetHistory = lazy(() => import("../pages/reports/admin/RevisionSheetHistory.jsx"));
const DPRManage = lazy(() => import("../pages/production/DPRManage.jsx"));
const SixteenDayMonitoring = lazy(() => import("../pages/training/monitoring/sixteen-day/index.js"));
const SixteenDayMonitoringLayoutEditor = lazy(() => import("../pages/training/monitoring/sixteen-day/SixteenDayMonitoringLayoutEditor.jsx"));
const ThreeDayMonitoring = lazy(() => import("../pages/training/monitoring/three-day/ThreeDayMonitoring.jsx"));
const HandoverSheetPage = lazy(() => import("../pages/training/monitoring/handover-sheet/HandoverSheetPage.jsx"));
const AbnormalCondition = lazy(() => import("../pages/training/admin/AbnormalCondition.jsx"));
const MultiSkilling = lazy(() => import("../pages/skills/multi-skilling/MultiSkillingPage.jsx"));
const DojoHiring = lazy(() => import("../pages/dojo-hiring/DojoHiringPage.jsx"));
const DojoCandidateDetail = lazy(() => import("../pages/dojo-hiring/DojoCandidateDetail.jsx"));
const OnJobTraining = lazy(() => import("../pages/training/monitoring/ojt/OnJobTraining.jsx"));
const OJTShareView = lazy(() => import("../pages/public/OJTShareView.jsx"));
const Contractors = lazy(() => import("../pages/users/admin/Contractors.jsx"));
const ContractorDetail = lazy(() => import("../pages/users/admin/ContractorDetail.jsx"));
const DesignationsPage = lazy(() => import("../pages/users/admin/DesignationsPage.jsx"));
const DesignationUsersPage = lazy(() => import("../pages/users/admin/DesignationUsersPage.jsx"));


const AdminSettings = lazy(() => import("../pages/settings/admin/Settings.jsx"));
const Learning = lazy(() => import("../pages/learning/Learning.jsx"));
const CreateLearningComparison = lazy(() => import("../pages/learning/CreateLearningComparison.jsx"));
const LearningComparisonDetail = lazy(() => import("../pages/learning/LearningComparisonDetail.jsx"));
const EditLearningComparison = lazy(() => import("../pages/learning/EditLearningComparison.jsx"));
const EvaluationTestList = lazy(() => import("../pages/assessments/evaluation-tests/EvaluationTestList.jsx"));
const EvaluationTestBuilder = lazy(() => import("../pages/assessments/evaluation-tests/EvaluationTestBuilder.jsx"));
const EvaluationTestAttemptPage = lazy(() => import("../pages/assessments/evaluation-tests/EvaluationTestAttemptPage.jsx"));
const EvaluationTestOperatorsPage = lazy(() => import("../pages/assessments/evaluation-tests/EvaluationTestOperatorsPage.jsx"));

// Instructor Pages
const InstructorDashboard = lazy(() => import("../pages/dashboard/instructor/Dashboard.jsx"));
const InstructorCourses = lazy(() => import("../pages/courses/instructor/Courses.jsx"));
const InstructorDepartments = lazy(() => import("../pages/departments/instructor/Departments.jsx"));
const InstructorStudents = lazy(() => import("../pages/users/instructor/Students.jsx"));
const InstructorStudentDetail = lazy(() => import("../pages/users/instructor/StudentDetail.jsx"));
const InstructorCourseDetailPage = lazy(() => import("../pages/courses/instructor/InstructorCourseDetailPage.jsx"));
const QuizMonitoring = lazy(() => import("../pages/assessments/instructor/QuizMonitoring.jsx"));
const AssignmentMonitoring = lazy(() => import("../pages/assessments/instructor/AssignmentMonitoring.jsx"));
const CertificateIssuance = lazy(() => import("../pages/certificates/instructor/CertificateIssuance.jsx"));
const InstructorAttemptRequests = lazy(() => import("../pages/assessments/instructor/AttemptRequests.jsx"));
const InstructorSkillMatrix = lazy(() => import("../pages/skills/instructor/SkillMatrix.jsx"));

// SuperAdmin Pages
const SuperAdminDashboard = lazy(() => import("../pages/dashboard/super-admin/Dashboard.jsx"));
const AllUsersManagement = lazy(() => import("../pages/users/super-admin/AllUsersManagement.jsx"));
const CreateAdmin = lazy(() => import("../pages/users/super-admin/CreateAdmin.jsx")); // Admin creation page
const SoftDeletedUsersManagement = lazy(() => import("../pages/users/super-admin/SoftDeletedUsersManagement.jsx"));
const SystemAuditLogs = lazy(() => import("../pages/reports/super-admin/SystemAuditLogs.jsx"));
const SystemSettings = lazy(() => import("../pages/settings/super-admin/SystemSettings.jsx"));
const AdvancedAnalytics = lazy(() => import("../pages/reports/super-admin/AdvancedAnalytics.jsx"));
const DataManagement = lazy(() => import("../pages/settings/super-admin/DataManagement.jsx"));
const RolesPermissions = lazy(() => import("../pages/users/super-admin/RolesPermissions.jsx"));
const SystemMonitoring = lazy(() => import("../pages/settings/super-admin/SystemMonitoring.jsx"));
const BulkOperations = lazy(() => import("../pages/settings/super-admin/BulkOperations.jsx"));
const CertificateManagement = lazy(() => import("../pages/certificates/super-admin/CertificateManagement.jsx"));

// Student Pages
const StudentDashboard = lazy(() => import("../pages/dashboard/student/Dashboard.jsx"));
const StudentProfile = lazy(() => import("../pages/account/Profile.jsx"));
const LessonDetail = lazy(() => import("../pages/courses/student/LessonDetail.jsx"));
const TakeQuiz = lazy(() => import("../pages/assessments/student/TakeQuiz.jsx"));
const Reports = lazy(() => import("../pages/reports/student/Reports.jsx"));
const StudentCertificates = lazy(() => import("../pages/certificates/student/Certificates.jsx"));
const ResourcePreview = lazy(() => import("../pages/courses/student/ResourcePreview.jsx"));
const StudentOnJobTraining = lazy(() => import("../pages/training/student/OnJobTraining.jsx"));
const StudentFeedback = lazy(() => import("../pages/account/Feedback.jsx"));
const NotFound = lazy(() => import("../pages/system/NotFound.jsx"));
const AccessDenied = lazy(() => import("../pages/system/AccessDenied.jsx"));

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

const AppRoutes = () => {
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
            <Route path="10-cycle/layout" element={<Cycle10LayoutEditor />} />
            <Route path="daily-production-report" element={<DailyProductionReport />} />
            <Route path="dpr-manage" element={<DPRManage />} />
            <Route path="on-job-training" element={<OnJobTraining />} />
            <Route path="16-day-monitoring/:studentId?" element={<SixteenDayMonitoring />} />
            <Route path="16-day-monitoring/layout" element={<SixteenDayMonitoringLayoutEditor />} />
            <Route path="3-day-monitoring/:studentId?" element={<ThreeDayMonitoring />} />
            <Route path="handover-sheet" element={<HandoverSheetPage />} />
            <Route path="multi-skilling" element={<MultiSkilling />} />
            <Route path="dojo-hiring" element={<DojoHiring />} />
            <Route path="dojo-hiring/:studentId" element={<DojoCandidateDetail />} />
            <Route path="role-manager" element={<RoleManager />} />
            <Route path="manage-role/:roleId" element={<RoleUserManager />} />
            <Route path="all-users" element={<AllUsersManagement />} />
            <Route path="mentors" element={<Mentor />} />
            <Route path="mentors/:mentorId" element={<MentorDetail />} />
            <Route path="supervisors" element={<Supervisor />} />
            <Route path="incharges" element={<Incharge />} />
            <Route path="line-requirements" element={<LineRequirementManager />} />
            <Route path="revision-table" element={
              <RequireAccess allow={["revision:read", "dept_revision_logs:read"]}>
                <RevisionTable />
              </RequireAccess>
            } />
            <Route path="revision-table/:sheetKey" element={
              <RequireAccess allow={["revision:read", "dept_revision_logs:read"]}>
                <RevisionSheetHistory />
              </RequireAccess>
            } />
            <Route path="revision-table/:sheetKey/layout" element={
              <RequireAccess allow={["revision:read", "dept_revision_logs:read", "revision:update", "ten_cycle:edit_layout", "ten_cycle:manage"]}>
                <Cycle10LayoutEditor />
              </RequireAccess>
            } />
            <Route path="revision-table/sixteen-day-monitoring/layout" element={
              <RequireAccess allow={["revision:read", "dept_revision_logs:read", "revision:update", "sixteen_day:edit_layout", "sixteen_day:manage"]}>
                <SixteenDayMonitoringLayoutEditor />
              </RequireAccess>
            } />
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
            <Route path="data-management" element={<DataManagement />} />
            <Route path="soft-deleted-users" element={<SoftDeletedUsersManagement />} />
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
            <Route path="ptm" element={<FmeDashboardPage key="ptm" page="ptm" />} />
            <Route path="pdca" element={<FmeDashboardPage key="pdca" page="pdca" />} />
            <Route path="process-audit" element={<FmeDashboardPage key="process-audit" page="process-audit" />} />
          </Route>

          {/* Daily Meeting Layout Routes */}
          <Route
            path="/daily-meeting"
            element={
              <ProtectedRoute>
                <DailyMeetingLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MisPortalHub />} />
            <Route path="morning-meeting" element={<DailyMeeting />} />
            <Route path="monthly-report" element={<MonthlyMeetingReport />} />
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
            <Route path="10-cycle/layout" element={<Cycle10LayoutEditor />} />
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
            <Route path="16-day-monitoring/layout" element={<SixteenDayMonitoringLayoutEditor />} />
            <Route path="3-day-monitoring" element={<ThreeDayMonitoring />} />
            <Route path="handover-sheet" element={<HandoverSheetPage />} />
            <Route path="abnormal-condition" element={<AbnormalCondition />} />
            <Route path="daily-meeting" element={<MisPortalHub />} />
            <Route path="daily-meeting/morning-meeting" element={<DailyMeeting />} />
            <Route path="daily-meeting/monthly-report" element={<MonthlyMeetingReport />} />
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

export default AppRoutes;
