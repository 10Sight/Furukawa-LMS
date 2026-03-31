import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
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
const CmsLayout = lazy(() => import("./Layout/CmsLayout.jsx").then(m => ({ default: m.CmsLayout })));

const AddQuestionPaper = lazy(() => import("./pages/CMS/AddQuestionPaper.jsx"));
const Daily5MRecording = lazy(() => import("./pages/CMS/Daily5MRecording.jsx"));
const Daily5MApprovalStatus = lazy(() => import("./pages/CMS/Daily5MApprovalStatus.jsx"));
const Daily5MDashboard = lazy(() => import("./pages/CMS/Daily5MDashboard.jsx"));
const DashboardHome = lazy(() => import("./pages/Dashboard/DashboardHome.jsx"));
const Attendance = lazy(() => import("./pages/Dashboard/Attendance.jsx"));
const UserManagement = lazy(() => import("./pages/Dashboard/UserManagement.jsx"));
const SetRequirements = lazy(() => import("./pages/Dashboard/SetRequirements.jsx"));
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


const AdminSettings = lazy(() => import("./pages/Admin/Settings"));

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
const StudentDepartment = lazy(() => import("./pages/Student/Department.jsx"));
const DepartmentCourse = lazy(() => import("./pages/Student/DepartmentCourse.jsx"));
const LessonDetail = lazy(() => import("./pages/Student/LessonDetail.jsx"));
const TakeQuiz = lazy(() => import("./pages/Student/TakeQuiz.jsx"));
const CourseReport = lazy(() => import("./pages/Student/CourseReport.jsx"));
const Reports = lazy(() => import("./pages/Student/Reports.jsx"));
const StudentCertificates = lazy(() => import("./pages/Student/Certificates.jsx"));
const ResourcePreview = lazy(() => import("./pages/Student/ResourcePreview.jsx"));
const StudentOnJobTraining = lazy(() => import("./pages/Student/OnJobTraining.jsx"));
const StudentFeedback = lazy(() => import("./pages/Student/Feedback.jsx"));

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
                {user?.isAdmin || user?.role === 'SUPERADMIN' || (user?.role === 'CUSTOM' && user?.customRole?.targetLayout?.toLowerCase() === 'admin') ? (
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
            <Route path="attempt-requests" element={<AdminAttemptRequests />} />
            <Route path="analytics" element={<Analytics pageName="Analytics" />} />
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
            <Route path="role-manager" element={<RoleManager />} />
            <Route path="manage-role/:roleId" element={<RoleUserManager />} />
            <Route path="all-users" element={<AllUsersManagement />} />
            <Route path="mentors" element={<Mentor />} />
            <Route path="supervisors" element={<Supervisor />} />
            <Route path="incharges" element={<Incharge />} />
            <Route path="line-requirements" element={<LineRequirementManager />} />
            <Route path="resource-preview/:resourceId" element={<ResourcePreview />} />
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
            <Route path="daily-5m-recording" element={<Daily5MRecording />} />
            <Route path="approvals/status" element={<Daily5MApprovalStatus />} />
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
            <Route path="assignment-monitoring" element={<AssignmentMonitoring />} />
            <Route path="certificate-issuance" element={<CertificateIssuance />} />
            <Route path="attempt-requests" element={<InstructorAttemptRequests />} />
            <Route path="resource-preview/:resourceId" element={<ResourcePreview />} />
            <Route path="skill-matrix" element={<InstructorSkillMatrix />} />
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
            <Route path="department" element={<StudentDepartment />} />
            <Route path="course" element={<DepartmentCourse />} />
            <Route path="lesson/:lessonId" element={<LessonDetail />} />
            <Route path="quiz/:quizId" element={<TakeQuiz />} />
            <Route path="reports" element={<Reports />} />
            <Route path="report/:courseId" element={<CourseReport />} />
            <Route path="certificates" element={<StudentCertificates />} />
            <Route path="on-job-training" element={<StudentOnJobTraining />} />
            <Route path="resource-preview/:resourceId" element={<ResourcePreview />} />
            <Route path="feedback" element={<StudentFeedback />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
