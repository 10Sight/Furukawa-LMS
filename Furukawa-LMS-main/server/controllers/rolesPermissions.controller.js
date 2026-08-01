import { executeQuery } from "../db/mssqlHelper.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import CustomRole from "../models/customRole.model.js";

// Define system permissions
const SYSTEM_PERMISSIONS = {
  // User Management
  USER_CREATE: "user:create",
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_SUSPEND: "user:suspend",
  USER_ACTIVATE: "user:activate",
  USER_IMPORT_EXCEL: "user:import_excel",
  USER_IMPORT_LOGS: "user:import_logs",
  USER_CHANGE_STATUS: "user:change_status",

  // Course Management
  COURSE_CREATE: "course:create",
  COURSE_READ: "course:read",
  COURSE_UPDATE: "course:update",
  COURSE_DELETE: "course:delete",
  COURSE_PUBLISH: "course:publish",

  // Module Management
  MODULE_CREATE: "module:create",
  MODULE_READ: "module:read",
  MODULE_UPDATE: "module:update",
  MODULE_DELETE: "module:delete",

  // Lesson Management
  LESSON_CREATE: "lesson:create",
  LESSON_READ: "lesson:read",
  LESSON_UPDATE: "lesson:update",
  LESSON_DELETE: "lesson:delete",

  // Resource Management
  RESOURCE_CREATE: "resource:create",
  RESOURCE_READ: "resource:read",
  RESOURCE_UPDATE: "resource:update",
  RESOURCE_DELETE: "resource:delete",

  // Department Management
  DEPARTMENT_CREATE: "department:create",
  DEPARTMENT_READ: "department:read",
  DEPARTMENT_UPDATE: "department:update",
  DEPARTMENT_DELETE: "department:delete",
  DEPARTMENT_MANAGE_STUDENTS: "department:manage_students",

  // Section Management
  SECTION_CREATE: "section:create",
  SECTION_READ: "section:read",
  SECTION_UPDATE: "section:update",
  SECTION_DELETE: "section:delete",

  // Quiz Management
  QUIZ_CREATE: "quiz:create",
  QUIZ_READ: "quiz:read",
  QUIZ_UPDATE: "quiz:update",
  QUIZ_DELETE: "quiz:delete",
  QUIZ_GRADE: "quiz:grade",

  // Assignment Management
  ASSIGNMENT_CREATE: "assignment:create",
  ASSIGNMENT_READ: "assignment:read",
  ASSIGNMENT_UPDATE: "assignment:update",
  ASSIGNMENT_DELETE: "assignment:delete",
  ASSIGNMENT_GRADE: "assignment:grade",

  // Certificate Management
  CERTIFICATE_CREATE: "certificate:create",
  CERTIFICATE_READ: "certificate:read",
  CERTIFICATE_UPDATE: "certificate:update",
  CERTIFICATE_DELETE: "certificate:delete",
  CERTIFICATE_ISSUE: "certificate:issue",

  // Analytics & Reports
  ANALYTICS_READ: "analytics:read",
  ANALYTICS_EXPORT: "analytics:export",
  REPORTS_GENERATE: "reports:generate",

  // System Administration
  SYSTEM_SETTINGS: "system:settings",
  SYSTEM_BACKUP: "system:backup",
  SYSTEM_RESTORE: "system:restore",
  SYSTEM_MAINTENANCE: "system:maintenance",

  // Bulk Operations
  BULK_ENROLLMENT: "bulk:enrollment",
  BULK_EMAIL: "bulk:email",
  BULK_CERTIFICATES: "bulk:certificates",

  // Audit & Logs
  AUDIT_READ: "audit:read",
  AUDIT_DELETE: "audit:delete",

  // Role Management
  ROLE_CREATE: "role:create",
  ROLE_READ: "role:read",
  ROLE_UPDATE: "role:update",
  ROLE_DELETE: "role:delete",
  ROLE_ASSIGN: "role:assign",

  // CMS Management
  DAILY_5M_APPROVE: "daily5m:approve",
  DAILY_5M_READ: "daily5m:read",
  DAILY_5M_UPDATE: "daily5m:update",
  DAILY_5M_EDIT_SUBMITTED: "daily5m:edit_submitted",
  DAILY_5M_DELETE: "daily5m:delete",

  // 16-Day Monitoring Management
  SIXTEEN_DAY_EDIT_LAYOUT: "sixteen_day:edit_layout",
  SIXTEEN_DAY_MANAGE: "sixteen_day:manage",
  SIXTEEN_DAY_VERIFY: "sixteen_day:verify",
  SIXTEEN_DAY_APPROVE: "sixteen_day:approve",
  SIXTEEN_DAY_VERIFY_EDUCATION: "sixteen_day:verify_education",
  SIXTEEN_DAY_EDIT_SUBMITTED: "sixteen_day:edit_submitted",

  // 3-Day Monitoring Management
  THREE_DAY_EDIT_LAYOUT: "three_day:edit_layout",
  THREE_DAY_MANAGE: "three_day:manage",
  THREE_DAY_VERIFY: "three_day:verify",
  THREE_DAY_APPROVE: "three_day:approve",

  // Mentee Feedback Management
  MENTEE_FEEDBACK_MANAGE: "mentee_feedback:manage",
  MENTEE_FEEDBACK_VIEW: "mentee_feedback:view",
  MENTEE_FEEDBACK_EDIT_SUBMITTED: "mentee_feedback:edit_submitted",

  // Multi Skilling Management
  MULTI_SKILLING_MANAGE: "multi_skilling:manage",
  MULTI_SKILLING_EDIT_LAYOUT: "multi_skilling:edit_layout",
  MULTI_SKILLING_VIEW_HISTORY: "multi_skilling:view_history",

  // Skill Upgradation Management
  SKILL_UPGRADATION_MANAGE: "skill_upgradation:manage",
  SKILL_UPGRADATION_EDIT_LAYOUT: "skill_upgradation:edit_layout",
  SKILL_UPGRADATION_VIEW_HISTORY: "skill_upgradation:view_history",
  SKILL_UPGRADATION_CREATE: "skill_upgradation:create",
  SKILL_UPGRADATION_READ: "skill_upgradation:read",
  SKILL_UPGRADATION_UPDATE: "skill_upgradation:update",
  SKILL_UPGRADATION_DELETE: "skill_upgradation:delete",

  HANDOVER_SHEET_EDIT_LAYOUT: "handover_sheet:edit_layout",
  HANDOVER_SHEET_READ: "handover_sheet:read",
  HANDOVER_SHEET_MANAGE: "handover_sheet:manage",
  HANDOVER_SHEET_APPROVE: "handover_sheet:approve",
  HANDOVER_SHEET_DELETE: "handover_sheet:delete",
  HANDOVER_SHEET_EDIT_SAVED: "handover_sheet:edit_saved",
  DOJO_HANDOVER_SHEET: "dojo:handover_sheet",
  DOJO_SIXTEENDAY_MONITORING: "dojo:sixteenday_monitoring",

  // 10-Cycle Sheet Management
  TEN_CYCLE_MANAGE: "ten_cycle:manage",
  TEN_CYCLE_VERIFY: "ten_cycle:verify",
  TEN_CYCLE_APPROVE: "ten_cycle:approve",
  TEN_CYCLE_CREATE: "ten_cycle:create",
  TEN_CYCLE_READ: "ten_cycle:read",
  TEN_CYCLE_UPDATE: "ten_cycle:update",
  TEN_CYCLE_DELETE: "ten_cycle:delete",

  // DOJO Hiring Management
  DOJO_HIRING_CREATE: "dojo_hiring:create",
  DOJO_HIRING_READ: "dojo_hiring:read",
  DOJO_HIRING_UPDATE: "dojo_hiring:update",
  DOJO_HIRING_DELETE: "dojo_hiring:delete",

  // Test Paper Management
  TEST_PAPER_READ: "test_paper:read",
  TEST_PAPER_CREATE: "test_paper:create",
  TEST_PAPER_ACCESS_ALL: "test_paper:access_all",
  TEST_PAPER_EDIT: "test_paper:edit",
  TEST_PAPER_DELETE: "test_paper:delete",
  TEST_PAPER_SKILL_UPGRADATION: "test_paper:skill_upgradation",
  TEST_PAPER_ISSUE_CERTIFICATE: "test_paper:issue_certificate",
  TEST_PAPER_IS_DOJO: "test_paper:is_dojo",
  TEST_PAPER_IS_HANDOVER: "test_paper:is_handover",
  TEST_PAPER_IS_THEORETICAL: "test_paper:is_theoretical",
  TEST_PAPER_IS_MULTI_SKILLING: "test_paper:is_multi_skilling",
  TEST_PAPER_HANDOVER_TARGETING: "test_paper:handover_targeting",
  DOJO_ALL_TEST_DEPARTMENT: "dojo:all_test_department",

  // Learning Management
  LEARNING_READ: "learning:read",
  LEARNING_CREATE: "learning:create",
  LEARNING_UPDATE: "learning:update",
  LEARNING_DELETE: "learning:delete",

  // Skill Matrix Approvals
  SKILL_MATRIX_QA_APPROVE: "skill_matrix:qa_approve",
  SKILL_MATRIX_SAFETY_APPROVE: "skill_matrix:safety_approve",
  SKILL_MATRIX_PROCESS_APPROVE: "skill_matrix:process_approve",

  // On Job Training (OJT) Management
  ON_JOB_TRAINING_READ: "on_job_training:read",
  ON_JOB_TRAINING_CREATE: "on_job_training:create",
  ON_JOB_TRAINING_UPDATE: "on_job_training:update",
  ON_JOB_TRAINING_DELETE: "on_job_training:delete",
  ON_JOB_TRAINING_CHECKED_BY: "on_job_training:checked_by",
  ON_JOB_TRAINING_APPROVED_BY: "on_job_training:approved_by",

  // Abnormal Condition Management
  ABNORMAL_CONDITION_READ: "abnormal_condition:read",
  ABNORMAL_CONDITION_CREATE: "abnormal_condition:create",
  ABNORMAL_CONDITION_UPDATE: "abnormal_condition:update",
  ABNORMAL_CONDITION_DELETE: "abnormal_condition:delete",
  ABNORMAL_CONDITION_APPROVE: "abnormal_condition:approve",

  // DOJO Evaluation Test Management
  DOJO_EVALUATION_TEST_CREATE: "dojo_evaluation_test:create",
  DOJO_EVALUATION_TEST_TAKE: "dojo_evaluation_test:take",
  DOJO_EVALUATION_TEST_APPROVE: "dojo_evaluation_test:approve",
  DOJO_EVALUATION_TEST_CONFIRM: "dojo_evaluation_test:confirm",
  DOJO_EVALUATION_TEST_VIEW: "dojo_evaluation_test:view",
  DOJO_EVALUATION_TEST_EDIT_SUBMITTED: "dojo_evaluation_test:edit_submitted",

  // MPS Portal Management
  MPS_ATTENDANCE_READ: "mps_attendance:read",
  MPS_ATTENDANCE_UPLOAD: "mps_attendance:upload_excel",
  MPS_REQUIREMENT_ADD_EMAILS: "mps_requirement:add_emails",
  MPS_REQUIREMENT_UPLOAD: "mps_requirement:upload_excel",
  MPS_EMAIL_REPORTS_TRIGGER: "mps_email_reports:trigger_mail",
  MPS_EMAIL_REPORTS_ADD: "mps_email_reports:add_mail",
  MPS_REQUIREMENT_VIEW_ALL_SECTIONS: "mps_requirement:view_all_sections",
  LINE_REQUIREMENT_READ: "line_requirement:read",
  LINE_REQUIREMENT_UPDATE: "line_requirement:update",

  // Settings Management
  SETTINGS_CHANGE_PASSWORD: "settings:change_password",
  SETTINGS_EMAIL_CONFIG: "settings:email_config",

  // Contractor Management
  CONTRACTOR_CREATE: "contractor:create",
  CONTRACTOR_READ: "contractor:read",
  CONTRACTOR_UPDATE: "contractor:update",
  CONTRACTOR_DELETE: "contractor:delete",

  // Skill Evaluation Check Sheet Management
  EVALUATION_MANAGE: "evaluation:manage",
  EVALUATION_CREATE: "evaluation:create",
  EVALUATION_READ: "evaluation:read",
  EVALUATION_UPDATE: "evaluation:update",
  EVALUATION_DELETE: "evaluation:delete",

  // Operator Observance Management
  OPERATOR_OBSERVANCE_MANAGE: "operator_observance:manage",
  OPERATOR_OBSERVANCE_CREATE: "operator_observance:create",
  OPERATOR_OBSERVANCE_READ: "operator_observance:read",
  OPERATOR_OBSERVANCE_UPDATE: "operator_observance:update",
  OPERATOR_OBSERVANCE_DELETE: "operator_observance:delete",

  // Mentor Management
  MENTOR_CREATE: "mentor:create",
  MENTOR_READ: "mentor:read",
  MENTOR_UPDATE: "mentor:update",
  MENTOR_DELETE: "mentor:delete",

  // Revision Management
  REVISION_READ: "revision:read",
  REVISION_CREATE: "revision:create",
  REVISION_UPDATE: "revision:update",
  DEPT_REVISION_LOGS_READ: "dept_revision_logs:read",
};

// Define default role permissions
const DEFAULT_ROLES = {
  STUDENT: {
    name: "Operator",
    description: "Basic operator access to courses and assignments",
    permissions: [
      SYSTEM_PERMISSIONS.COURSE_READ,
      SYSTEM_PERMISSIONS.MODULE_READ,
      SYSTEM_PERMISSIONS.LESSON_READ,
      SYSTEM_PERMISSIONS.RESOURCE_READ,
      SYSTEM_PERMISSIONS.QUIZ_READ,
      SYSTEM_PERMISSIONS.ASSIGNMENT_READ,
      SYSTEM_PERMISSIONS.CERTIFICATE_READ,
      SYSTEM_PERMISSIONS.DAILY_5M_READ,
      SYSTEM_PERMISSIONS.LEARNING_READ,
      SYSTEM_PERMISSIONS.ON_JOB_TRAINING_READ,
      SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_READ
    ],
    isSystemRole: true,
    color: "#3B82F6"
  },
  INSTRUCTOR: {
    name: "Instructor",
    description: "Instructor access to manage courses and students",
    permissions: [
      // Course Management
      SYSTEM_PERMISSIONS.COURSE_CREATE,
      SYSTEM_PERMISSIONS.COURSE_READ,
      SYSTEM_PERMISSIONS.COURSE_UPDATE,
      SYSTEM_PERMISSIONS.COURSE_DELETE,
      SYSTEM_PERMISSIONS.COURSE_PUBLISH,
      // Module Management
      SYSTEM_PERMISSIONS.MODULE_CREATE,
      SYSTEM_PERMISSIONS.MODULE_READ,
      SYSTEM_PERMISSIONS.MODULE_UPDATE,
      SYSTEM_PERMISSIONS.MODULE_DELETE,
      // Lesson Management
      SYSTEM_PERMISSIONS.LESSON_CREATE,
      SYSTEM_PERMISSIONS.LESSON_READ,
      SYSTEM_PERMISSIONS.LESSON_UPDATE,
      SYSTEM_PERMISSIONS.LESSON_DELETE,
      // Resource Management
      SYSTEM_PERMISSIONS.RESOURCE_CREATE,
      SYSTEM_PERMISSIONS.RESOURCE_READ,
      SYSTEM_PERMISSIONS.RESOURCE_UPDATE,
      SYSTEM_PERMISSIONS.RESOURCE_DELETE,
      // Department Management
      SYSTEM_PERMISSIONS.DEPARTMENT_CREATE,
      SYSTEM_PERMISSIONS.DEPARTMENT_READ,
      SYSTEM_PERMISSIONS.DEPARTMENT_UPDATE,
      SYSTEM_PERMISSIONS.DEPARTMENT_MANAGE_STUDENTS,
      // Section Management
      SYSTEM_PERMISSIONS.SECTION_READ,
      // Assessment Management
      SYSTEM_PERMISSIONS.QUIZ_CREATE,
      SYSTEM_PERMISSIONS.QUIZ_READ,
      SYSTEM_PERMISSIONS.QUIZ_UPDATE,
      SYSTEM_PERMISSIONS.QUIZ_DELETE,
      SYSTEM_PERMISSIONS.QUIZ_GRADE,
      SYSTEM_PERMISSIONS.ASSIGNMENT_CREATE,
      SYSTEM_PERMISSIONS.ASSIGNMENT_READ,
      SYSTEM_PERMISSIONS.ASSIGNMENT_UPDATE,
      SYSTEM_PERMISSIONS.ASSIGNMENT_DELETE,
      SYSTEM_PERMISSIONS.ASSIGNMENT_GRADE,
      // Certificate Management
      SYSTEM_PERMISSIONS.CERTIFICATE_CREATE,
      SYSTEM_PERMISSIONS.CERTIFICATE_READ,
      SYSTEM_PERMISSIONS.CERTIFICATE_ISSUE,
      // Analytics & User Management
      SYSTEM_PERMISSIONS.ANALYTICS_READ,
      SYSTEM_PERMISSIONS.USER_READ,
      SYSTEM_PERMISSIONS.DAILY_5M_READ,
      SYSTEM_PERMISSIONS.DAILY_5M_UPDATE,
      SYSTEM_PERMISSIONS.SIXTEEN_DAY_EDIT_LAYOUT,
      SYSTEM_PERMISSIONS.THREE_DAY_EDIT_LAYOUT,
      SYSTEM_PERMISSIONS.MULTI_SKILLING_MANAGE,
      SYSTEM_PERMISSIONS.MULTI_SKILLING_EDIT_LAYOUT,
      SYSTEM_PERMISSIONS.SKILL_UPGRADATION_MANAGE,
      SYSTEM_PERMISSIONS.SKILL_UPGRADATION_EDIT_LAYOUT,
      SYSTEM_PERMISSIONS.SKILL_UPGRADATION_VIEW_HISTORY,
      SYSTEM_PERMISSIONS.SKILL_UPGRADATION_CREATE,
      SYSTEM_PERMISSIONS.SKILL_UPGRADATION_READ,
      SYSTEM_PERMISSIONS.SKILL_UPGRADATION_UPDATE,
      SYSTEM_PERMISSIONS.SKILL_UPGRADATION_DELETE,
      SYSTEM_PERMISSIONS.HANDOVER_SHEET_READ,
      SYSTEM_PERMISSIONS.HANDOVER_SHEET_MANAGE,
      SYSTEM_PERMISSIONS.LEARNING_READ,
      SYSTEM_PERMISSIONS.ON_JOB_TRAINING_READ,
      SYSTEM_PERMISSIONS.ON_JOB_TRAINING_CREATE,
      SYSTEM_PERMISSIONS.ON_JOB_TRAINING_UPDATE,
      SYSTEM_PERMISSIONS.ON_JOB_TRAINING_DELETE,
      SYSTEM_PERMISSIONS.ON_JOB_TRAINING_CHECKED_BY,
      SYSTEM_PERMISSIONS.ON_JOB_TRAINING_APPROVED_BY,
      SYSTEM_PERMISSIONS.TEST_PAPER_SKILL_UPGRADATION,
      SYSTEM_PERMISSIONS.TEST_PAPER_ISSUE_CERTIFICATE,
      SYSTEM_PERMISSIONS.TEST_PAPER_IS_DOJO,
      SYSTEM_PERMISSIONS.TEST_PAPER_IS_HANDOVER,
      SYSTEM_PERMISSIONS.TEST_PAPER_IS_THEORETICAL,
      SYSTEM_PERMISSIONS.TEST_PAPER_IS_MULTI_SKILLING,
      SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_CREATE,
      SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_TAKE,
      SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_APPROVE,
      SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_CONFIRM,
      SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_VIEW,
      SYSTEM_PERMISSIONS.DOJO_HIRING_READ,
      SYSTEM_PERMISSIONS.DOJO_HIRING_CREATE,
      SYSTEM_PERMISSIONS.DOJO_HIRING_UPDATE,
      SYSTEM_PERMISSIONS.DOJO_HIRING_DELETE,
      SYSTEM_PERMISSIONS.SETTINGS_CHANGE_PASSWORD,
      // Evaluation Check Sheet Management
      SYSTEM_PERMISSIONS.EVALUATION_MANAGE,
      SYSTEM_PERMISSIONS.EVALUATION_CREATE,
      SYSTEM_PERMISSIONS.EVALUATION_READ,
      SYSTEM_PERMISSIONS.EVALUATION_UPDATE,
      SYSTEM_PERMISSIONS.EVALUATION_DELETE,
      // Operator Observance Management
      SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_MANAGE,
      SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_CREATE,
      SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_READ,
      SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_UPDATE,
      SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_DELETE,
      // Mentor Management
      SYSTEM_PERMISSIONS.MENTOR_READ,
      // Revision Management
      SYSTEM_PERMISSIONS.REVISION_READ,
      SYSTEM_PERMISSIONS.DEPT_REVISION_LOGS_READ,
    ],
    isSystemRole: true,
    color: "#10B981"
  },
  ADMIN: {
    name: "Admin",
    description: "Administrator access to system management",
    permissions: [
      ...Object.values(SYSTEM_PERMISSIONS).filter(p =>
        !p.includes('system:') &&
        !p.includes('role:')
      ),
      SYSTEM_PERMISSIONS.AUDIT_READ,
      SYSTEM_PERMISSIONS.ROLE_READ,
      SYSTEM_PERMISSIONS.ROLE_CREATE,
      SYSTEM_PERMISSIONS.ROLE_UPDATE,
      SYSTEM_PERMISSIONS.ROLE_DELETE,
      SYSTEM_PERMISSIONS.BULK_ENROLLMENT,
      SYSTEM_PERMISSIONS.BULK_EMAIL,
      SYSTEM_PERMISSIONS.BULK_CERTIFICATES,
      SYSTEM_PERMISSIONS.SETTINGS_CHANGE_PASSWORD,
      SYSTEM_PERMISSIONS.SETTINGS_EMAIL_CONFIG
    ],
    isSystemRole: true,
    color: "#F59E0B"
  },
  SUPERADMIN: {
    name: "SuperAdmin",
    description: "Full system access and control",
    permissions: Object.values(SYSTEM_PERMISSIONS),
    isSystemRole: true,
    color: "#EF4444"
  }
};

// Get all roles and permissions
export const getRolesAndPermissions = asyncHandler(async (req, res) => {
  try {
    // Get all available permissions grouped by category
    const permissions = {
      "User Management": [
        { id: SYSTEM_PERMISSIONS.USER_CREATE, name: "Create Users", description: "Create new user accounts" },
        { id: SYSTEM_PERMISSIONS.USER_READ, name: "View Users", description: "View user information and profiles" },
        { id: SYSTEM_PERMISSIONS.USER_UPDATE, name: "Update Users", description: "Edit user information and profiles" },
        { id: SYSTEM_PERMISSIONS.USER_DELETE, name: "Delete Users", description: "Permanently delete user accounts" },
        { id: SYSTEM_PERMISSIONS.USER_SUSPEND, name: "Suspend Users", description: "Suspend user accounts" },
        { id: SYSTEM_PERMISSIONS.USER_ACTIVATE, name: "Activate Users", description: "Activate suspended accounts" },
        { id: SYSTEM_PERMISSIONS.USER_IMPORT_EXCEL, name: "Import Excel Data", description: "Import users from Excel files" },
        { id: SYSTEM_PERMISSIONS.USER_IMPORT_LOGS, name: "View Import Logs", description: "View history and details of user imports" },
        { id: SYSTEM_PERMISSIONS.USER_CHANGE_STATUS, name: "Change User Status", description: "Change status of user accounts (Present, On Leave, Left)" }
      ],
      "Course Management": [
        { id: SYSTEM_PERMISSIONS.COURSE_CREATE, name: "Create Courses", description: "Create new courses" },
        { id: SYSTEM_PERMISSIONS.COURSE_READ, name: "View Courses", description: "View course content and information" },
        { id: SYSTEM_PERMISSIONS.COURSE_UPDATE, name: "Update Courses", description: "Edit course content and settings" },
        { id: SYSTEM_PERMISSIONS.COURSE_DELETE, name: "Delete Courses", description: "Delete courses from system" },
        { id: SYSTEM_PERMISSIONS.COURSE_PUBLISH, name: "Publish Courses", description: "Publish courses to students" }
      ],
      "Module Management": [
        { id: SYSTEM_PERMISSIONS.MODULE_CREATE, name: "Create Modules", description: "Create new course modules" },
        { id: SYSTEM_PERMISSIONS.MODULE_READ, name: "View Modules", description: "View module content and information" },
        { id: SYSTEM_PERMISSIONS.MODULE_UPDATE, name: "Update Modules", description: "Edit module content and settings" },
        { id: SYSTEM_PERMISSIONS.MODULE_DELETE, name: "Delete Modules", description: "Delete modules from courses" }
      ],
      "Lesson Management": [
        { id: SYSTEM_PERMISSIONS.LESSON_CREATE, name: "Create Lessons", description: "Create new lessons in modules" },
        { id: SYSTEM_PERMISSIONS.LESSON_READ, name: "View Lessons", description: "View lesson content and information" },
        { id: SYSTEM_PERMISSIONS.LESSON_UPDATE, name: "Update Lessons", description: "Edit lesson content and settings" },
        { id: SYSTEM_PERMISSIONS.LESSON_DELETE, name: "Delete Lessons", description: "Delete lessons from modules" }
      ],
      "Resource Management": [
        { id: SYSTEM_PERMISSIONS.RESOURCE_CREATE, name: "Create Resources", description: "Upload and create learning resources" },
        { id: SYSTEM_PERMISSIONS.RESOURCE_READ, name: "View Resources", description: "View uploaded resources" },
        { id: SYSTEM_PERMISSIONS.RESOURCE_UPDATE, name: "Update Resources", description: "Edit and update resources" },
        { id: SYSTEM_PERMISSIONS.RESOURCE_DELETE, name: "Delete Resources", description: "Delete uploaded resources" }
      ],
      "Department Management": [
        { id: SYSTEM_PERMISSIONS.DEPARTMENT_CREATE, name: "Create Departments", description: "Create new student departments" },
        { id: SYSTEM_PERMISSIONS.DEPARTMENT_READ, name: "View Departments", description: "View department information" },
        { id: SYSTEM_PERMISSIONS.DEPARTMENT_UPDATE, name: "Update Departments", description: "Edit department information" },
        { id: SYSTEM_PERMISSIONS.DEPARTMENT_DELETE, name: "Delete Departments", description: "Delete student departments" },
        { id: SYSTEM_PERMISSIONS.DEPARTMENT_MANAGE_STUDENTS, name: "Manage Students", description: "Add/remove students from departments" }
      ],
      "Section Management": [
        { id: SYSTEM_PERMISSIONS.SECTION_CREATE, name: "Create Sections", description: "Create new sections within a department" },
        { id: SYSTEM_PERMISSIONS.SECTION_READ, name: "View Sections", description: "View section information and their lines" },
        { id: SYSTEM_PERMISSIONS.SECTION_UPDATE, name: "Update Sections", description: "Edit section information" },
        { id: SYSTEM_PERMISSIONS.SECTION_DELETE, name: "Delete Sections", description: "Delete sections and their lines" }
      ],
      "Test & Assessment Management": [
        { id: SYSTEM_PERMISSIONS.QUIZ_CREATE, name: "Create Quizzes", description: "Create new quizzes and tests" },
        { id: SYSTEM_PERMISSIONS.QUIZ_READ, name: "View Quizzes", description: "View quiz content and results" },
        { id: SYSTEM_PERMISSIONS.QUIZ_UPDATE, name: "Update Quizzes", description: "Edit quiz content and settings" },
        { id: SYSTEM_PERMISSIONS.QUIZ_DELETE, name: "Delete Quizzes", description: "Delete quizzes from system" },
        { id: SYSTEM_PERMISSIONS.QUIZ_GRADE, name: "Grade Quizzes", description: "Grade student quiz attempts" },
        { id: SYSTEM_PERMISSIONS.ASSIGNMENT_CREATE, name: "Create Assignments", description: "Create new assignments" },
        { id: SYSTEM_PERMISSIONS.ASSIGNMENT_READ, name: "View Assignments", description: "View assignment content and submissions" },
        { id: SYSTEM_PERMISSIONS.ASSIGNMENT_UPDATE, name: "Update Assignments", description: "Edit assignment content" },
        { id: SYSTEM_PERMISSIONS.ASSIGNMENT_DELETE, name: "Delete Assignments", description: "Delete assignments" },
        { id: SYSTEM_PERMISSIONS.ASSIGNMENT_GRADE, name: "Grade Assignments", description: "Grade student submissions" }
      ],
      "Certificate Management": [
        { id: SYSTEM_PERMISSIONS.CERTIFICATE_CREATE, name: "Create Templates", description: "Create certificate templates" },
        { id: SYSTEM_PERMISSIONS.CERTIFICATE_READ, name: "View Certificates", description: "View issued certificates" },
        { id: SYSTEM_PERMISSIONS.CERTIFICATE_UPDATE, name: "Update Templates", description: "Edit certificate templates" },
        { id: SYSTEM_PERMISSIONS.CERTIFICATE_DELETE, name: "Delete Certificates", description: "Delete certificates and templates" },
        { id: SYSTEM_PERMISSIONS.CERTIFICATE_ISSUE, name: "Issue Certificates", description: "Issue certificates to students" }
      ],
      "Analytics & Reports": [
        { id: SYSTEM_PERMISSIONS.ANALYTICS_READ, name: "View Analytics", description: "Access system analytics and reports" },
        { id: SYSTEM_PERMISSIONS.ANALYTICS_EXPORT, name: "Export Analytics", description: "Export analytics data" },
        { id: SYSTEM_PERMISSIONS.REPORTS_GENERATE, name: "Generate Reports", description: "Generate custom reports" }
      ],
      "Bulk Operations": [
        { id: SYSTEM_PERMISSIONS.BULK_ENROLLMENT, name: "Bulk Enrollment", description: "Enroll multiple users at once" },
        { id: SYSTEM_PERMISSIONS.BULK_EMAIL, name: "Bulk Email", description: "Send bulk email campaigns" },
        { id: SYSTEM_PERMISSIONS.BULK_CERTIFICATES, name: "Bulk Certificates", description: "Generate certificates in bulk" }
      ],
      "System Administration": [
        { id: SYSTEM_PERMISSIONS.SYSTEM_SETTINGS, name: "System Settings", description: "Modify system configuration" },
        { id: SYSTEM_PERMISSIONS.SYSTEM_BACKUP, name: "System Backup", description: "Create system backups" },
        { id: SYSTEM_PERMISSIONS.SYSTEM_RESTORE, name: "System Restore", description: "Restore from backups" },
        { id: SYSTEM_PERMISSIONS.SYSTEM_MAINTENANCE, name: "Maintenance Mode", description: "Enable/disable maintenance mode" }
      ],
      "Audit & Security": [
        { id: SYSTEM_PERMISSIONS.AUDIT_READ, name: "View Audit Logs", description: "Access system audit logs" },
        { id: SYSTEM_PERMISSIONS.AUDIT_DELETE, name: "Delete Audit Logs", description: "Delete audit log entries" }
      ],
      "Role Management": [
        { id: SYSTEM_PERMISSIONS.ROLE_CREATE, name: "Create Roles", description: "Create new user roles" },
        { id: SYSTEM_PERMISSIONS.ROLE_READ, name: "View Roles", description: "View role information" },
        { id: SYSTEM_PERMISSIONS.ROLE_UPDATE, name: "Update Roles", description: "Edit role permissions" },
        { id: SYSTEM_PERMISSIONS.ROLE_DELETE, name: "Delete Roles", description: "Delete custom roles" },
        { id: SYSTEM_PERMISSIONS.ROLE_ASSIGN, name: "Assign Roles", description: "Assign roles to users" }
      ],
      "Daily 5M Recording": [
        { id: SYSTEM_PERMISSIONS.DAILY_5M_APPROVE, name: "Approve Daily 5M", description: "Approve or decline daily 5M recording sessions" },
        { id: SYSTEM_PERMISSIONS.DAILY_5M_READ, name: "View Daily 5M", description: "View daily 5M recording data" },
        { id: SYSTEM_PERMISSIONS.DAILY_5M_UPDATE, name: "Update Daily 5M", description: "Edit daily 5M recording data" },
        { id: SYSTEM_PERMISSIONS.DAILY_5M_EDIT_SUBMITTED, name: "Edit Submitted Daily 5M", description: "Edit daily 5M records even after approval/submission" },
        { id: SYSTEM_PERMISSIONS.DAILY_5M_DELETE, name: "Delete Daily 5M", description: "Permanently delete daily 5M recording records" }
      ],
      "16-Day Monitoring": [
        { id: SYSTEM_PERMISSIONS.SIXTEEN_DAY_EDIT_LAYOUT, name: "Edit 16-Day Monitoring Layout", description: "Modify the structure and categories of 16-day monitoring sheets" },
        { id: SYSTEM_PERMISSIONS.SIXTEEN_DAY_MANAGE, name: "Manage 16-Day Monitoring", description: "Manage 16-day monitoring records" },
        { id: SYSTEM_PERMISSIONS.SIXTEEN_DAY_VERIFY, name: "Verify 16-Day Monitoring", description: "Verify 16-day monitoring records (Area Incharge sign-off)" },
        { id: SYSTEM_PERMISSIONS.SIXTEEN_DAY_APPROVE, name: "Approve 16-Day Monitoring", description: "Approve 16-day monitoring records (Dept. Head sign-off)" },
        { id: SYSTEM_PERMISSIONS.SIXTEEN_DAY_VERIFY_EDUCATION, name: "Verify 16-Day Monitoring (Education Cell)", description: "Verify 16-day monitoring records as Education Cell" },
        { id: SYSTEM_PERMISSIONS.SIXTEEN_DAY_EDIT_SUBMITTED, name: "Edit Submitted 16-Day Monitoring", description: "Edit and save 16-day monitoring sheets that have already been submitted" },
        { id: SYSTEM_PERMISSIONS.DOJO_SIXTEENDAY_MONITORING, name: "Access All in 16-Day Monitoring", description: "Allows unrestricted access to all departments, sections, lines, and stations in 16-Day Monitoring" }
      ],
      "3-Day Monitoring": [
        { id: SYSTEM_PERMISSIONS.THREE_DAY_EDIT_LAYOUT, name: "Edit 3-Day Monitoring Layout", description: "Modify the structure and categories of 3-day monitoring sheets" },
        { id: SYSTEM_PERMISSIONS.THREE_DAY_MANAGE, name: "Manage 3-Day Monitoring", description: "Manage 3-day monitoring records" },
        { id: SYSTEM_PERMISSIONS.THREE_DAY_VERIFY, name: "Verify 3-Day Monitoring", description: "Verify 3-day monitoring records (Area Incharge sign-off)" },
        { id: SYSTEM_PERMISSIONS.THREE_DAY_APPROVE, name: "Approve 3-Day Monitoring", description: "Approve 3-day monitoring records (Dept. Head sign-off)" }
      ],
      "Mentee Feedback": [
        { id: SYSTEM_PERMISSIONS.MENTEE_FEEDBACK_MANAGE, name: "Manage Mentee Feedback", description: "Fill out and manage mentee feedback monitoring sheets" },
        { id: SYSTEM_PERMISSIONS.MENTEE_FEEDBACK_VIEW, name: "View Mentee Feedback", description: "View mentee feedback monitoring sheets" },
        { id: SYSTEM_PERMISSIONS.MENTEE_FEEDBACK_EDIT_SUBMITTED, name: "Edit Submitted Mentee Feedback", description: "Edit and save mentee feedback sheets that have already been submitted" }
      ],
      "Multi Skilling": [
        { id: SYSTEM_PERMISSIONS.MULTI_SKILLING_MANAGE, name: "Manage Multi Skilling", description: "Fill out and manage multi skilling training plans" },
        { id: SYSTEM_PERMISSIONS.MULTI_SKILLING_EDIT_LAYOUT, name: "Edit Multi Skilling Layout", description: "Modify the table configuration and structure of multi skilling sheets" },
        { id: SYSTEM_PERMISSIONS.MULTI_SKILLING_VIEW_HISTORY, name: "View Multi Skilling History", description: "View the history of layout changes for multi skilling sheets" }
      ],
      "Skill Upgradation": [
        { id: SYSTEM_PERMISSIONS.SKILL_UPGRADATION_MANAGE, name: "Manage Skill Upgradation (Full Access)", description: "Super-permission: full create, read, update, and delete access to skill upgradation plans" },
        { id: SYSTEM_PERMISSIONS.SKILL_UPGRADATION_CREATE, name: "Create Skill Upgradation Plan", description: "Create new skill upgradation plans for a department/section/year" },
        { id: SYSTEM_PERMISSIONS.SKILL_UPGRADATION_READ, name: "View Skill Upgradation Plans", description: "View and read existing skill upgradation plans" },
        { id: SYSTEM_PERMISSIONS.SKILL_UPGRADATION_UPDATE, name: "Edit Skill Upgradation Plan", description: "Edit and save changes to existing skill upgradation plans" },
        { id: SYSTEM_PERMISSIONS.SKILL_UPGRADATION_DELETE, name: "Delete Skill Upgradation Plan", description: "Permanently delete skill upgradation plan records" },
        { id: SYSTEM_PERMISSIONS.SKILL_UPGRADATION_EDIT_LAYOUT, name: "Edit Skill Upgradation Layout", description: "Modify the table configuration and structure of skill upgradation sheets" },
        { id: SYSTEM_PERMISSIONS.SKILL_UPGRADATION_VIEW_HISTORY, name: "View Skill Upgradation History", description: "View the history of layout changes for skill upgradation sheets" }
      ],
      "Handover Sheet": [
        { id: SYSTEM_PERMISSIONS.HANDOVER_SHEET_READ, name: "View Handover Sheet", description: "View handover sheet records" },
        { id: SYSTEM_PERMISSIONS.HANDOVER_SHEET_MANAGE, name: "Manage Handover Sheet", description: "Fill out, save, and submit handover sheets" },
        { id: SYSTEM_PERMISSIONS.HANDOVER_SHEET_APPROVE, name: "Approve Handover Sheet", description: "Approve or Reject handover sheet entries" },
        { id: SYSTEM_PERMISSIONS.HANDOVER_SHEET_EDIT_LAYOUT, name: "Edit Handover Sheet Layout", description: "Modify the table configuration and structure of handover sheets" },
        { id: SYSTEM_PERMISSIONS.DOJO_HANDOVER_SHEET, name: "Access All in Handover Sheet", description: "Allows unrestricted access to all departments, sections, sub-sections, and stations in Handover Sheets" },
        { id: SYSTEM_PERMISSIONS.HANDOVER_SHEET_DELETE, name: "Delete Handover Sheet", description: "Permanently delete handover sheet records" },
        { id: SYSTEM_PERMISSIONS.HANDOVER_SHEET_EDIT_SAVED, name: "Edit Saved Handover Sheet", description: "Edit handover sheets that have already been saved or submitted" }
      ],
      "10-Cycle Sheet": [
        { id: SYSTEM_PERMISSIONS.TEN_CYCLE_MANAGE, name: "Manage 10-Cycle Sheet (Full Access)", description: "Super-permission: full create, read, update, and delete access to 10-cycle sheets" },
        { id: SYSTEM_PERMISSIONS.TEN_CYCLE_CREATE, name: "Create 10-Cycle Sheet", description: "Create new 10-cycle sheets" },
        { id: SYSTEM_PERMISSIONS.TEN_CYCLE_READ, name: "View 10-Cycle Sheet", description: "View and read existing 10-cycle sheets" },
        { id: SYSTEM_PERMISSIONS.TEN_CYCLE_UPDATE, name: "Edit 10-Cycle Sheet", description: "Edit and save changes to existing 10-cycle sheets" },
        { id: SYSTEM_PERMISSIONS.TEN_CYCLE_DELETE, name: "Delete 10-Cycle Sheet", description: "Permanently delete 10-cycle sheet records" },
        { id: SYSTEM_PERMISSIONS.TEN_CYCLE_VERIFY, name: "Verify 10-Cycle Sheet", description: "Verify 10-cycle sheets (Co-ordinator sign-off)" },
        { id: SYSTEM_PERMISSIONS.TEN_CYCLE_APPROVE, name: "Approve 10-Cycle Sheet", description: "Approve 10-cycle sheets (HOD sign-off)" }
      ],
      "DOJO Hiring": [
        { id: SYSTEM_PERMISSIONS.DOJO_HIRING_READ, name: "View DOJO Hiring", description: "View the list of temporary candidates and their status" },
        { id: SYSTEM_PERMISSIONS.DOJO_HIRING_CREATE, name: "Onboard Candidates", description: "Onboard new temporary candidates into the pipeline" },
        { id: SYSTEM_PERMISSIONS.DOJO_HIRING_UPDATE, name: "Update Candidates", description: "Edit candidate information" },
        { id: SYSTEM_PERMISSIONS.DOJO_HIRING_DELETE, name: "Delete Candidates", description: "Remove temporary candidates from the pipeline" }
      ],
      "Test Paper Management": [
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_READ, name: "View Test Papers", description: "Access and view the list of test papers" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_CREATE, name: "Create/Manage Test Papers", description: "Create or modify test paper entries" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_ACCESS_ALL, name: "Access All Test Papers", description: "View all test papers and use all department/section/line/sub-section/level filters freely" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_EDIT, name: "Edit Test Papers", description: "Allows editing of existing test papers" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_DELETE, name: "Delete Test Papers", description: "Allows deleting of existing test papers" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_SKILL_UPGRADATION, name: "Toggle Skill Upgradation", description: "Allows enabling/disabling skill upgradation for test papers" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_ISSUE_CERTIFICATE, name: "Toggle Issue Certificate", description: "Allows enabling/disabling automatic certificate generation for test papers" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_IS_DOJO, name: "Toggle Is Dojo Quiz", description: "Allows marking test papers as Dojo quizzes" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_IS_HANDOVER, name: "Toggle Is Handover Quiz", description: "Allows marking test papers as Handover quizzes" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_IS_THEORETICAL, name: "Toggle Is Theoretical Quiz", description: "Allows marking test papers as Theoretical quizzes" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_IS_MULTI_SKILLING, name: "Toggle Is Multi Skilling Quiz", description: "Allows marking test papers as Multi Skilling quizzes" },
        { id: SYSTEM_PERMISSIONS.TEST_PAPER_HANDOVER_TARGETING, name: "Toggle Handover Sheet Targeting", description: "Allows configuring Handover Sheet Targeting on Add/Edit Test Paper screens" },
        { id: SYSTEM_PERMISSIONS.DOJO_ALL_TEST_DEPARTMENT, name: "DOJO Access All Test Departments", description: "Unlocks all departments/sections on the Add/Edit Test Paper screens, bypassing the assigned department restriction" }
      ],
      "Improvement Evidence Management": [
        { id: SYSTEM_PERMISSIONS.LEARNING_READ, name: "View Improvement Evidence", description: "View the improvement evidence dashboard and statistics" },
        { id: SYSTEM_PERMISSIONS.LEARNING_CREATE, name: "Create Improvement Evidence", description: "Create new before & after improvement evidence comparisons" },
        { id: SYSTEM_PERMISSIONS.LEARNING_UPDATE, name: "Update Improvement Evidence", description: "Edit existing improvement evidence comparison entries" },
        { id: SYSTEM_PERMISSIONS.LEARNING_DELETE, name: "Delete Improvement Evidence", description: "Remove improvement evidence comparison entries from the system" }
      ],
      "Skill Evaluation Management": [
        { id: SYSTEM_PERMISSIONS.SKILL_MATRIX_QA_APPROVE, name: "QA In-charge Approval", description: "Approve or reject the Skill Evaluation as QA In-charge" },
        { id: SYSTEM_PERMISSIONS.SKILL_MATRIX_SAFETY_APPROVE, name: "Safety In-charge Approval", description: "Approve or reject the Skill Evaluation as Safety In-charge" },
        { id: SYSTEM_PERMISSIONS.SKILL_MATRIX_PROCESS_APPROVE, name: "Process In-charge Approval", description: "Approve or reject the Skill Evaluation as Process In-charge" }
      ],
      "On Job Training (OJT) Management": [
        { id: SYSTEM_PERMISSIONS.ON_JOB_TRAINING_READ, name: "View OJT", description: "Access and view On the Job Training sheets" },
        { id: SYSTEM_PERMISSIONS.ON_JOB_TRAINING_CREATE, name: "Create OJT", description: "Create new On the Job Training sheets" },
        { id: SYSTEM_PERMISSIONS.ON_JOB_TRAINING_UPDATE, name: "Manage/Update OJT", description: "Modify, edit or score On the Job Training sheets" },
        { id: SYSTEM_PERMISSIONS.ON_JOB_TRAINING_DELETE, name: "Delete OJT", description: "Delete On the Job Training sheets" },
        { id: SYSTEM_PERMISSIONS.ON_JOB_TRAINING_CHECKED_BY, name: "Checked By sign-off", description: "Sign off On the Job Training sheets as Checked By" },
        { id: SYSTEM_PERMISSIONS.ON_JOB_TRAINING_APPROVED_BY, name: "Approved By sign-off", description: "Sign off On the Job Training sheets as Approved By" }
      ],
      "Abnormal Condition Management": [
        { id: SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_READ, name: "View Abnormal Conditions", description: "View Abnormal Condition sheets" },
        { id: SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_CREATE, name: "Create Abnormal Conditions", description: "Create new Abnormal Condition sheets" },
        { id: SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_UPDATE, name: "Update Abnormal Conditions", description: "Edit Abnormal Condition sheets" },
        { id: SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_DELETE, name: "Delete Abnormal Conditions", description: "Delete Abnormal Condition sheets" },
        { id: SYSTEM_PERMISSIONS.ABNORMAL_CONDITION_APPROVE, name: "Approve Abnormal Conditions", description: "Approve or Reject Abnormal Condition sheets as Head, QA" }
      ],
      "DOJO Evaluation Test": [
        { id: SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_CREATE, name: "Create DOJO Evaluation Test", description: "Create and manage DOJO evaluation test papers" },
        { id: SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_TAKE, name: "Take DOJO Evaluation Test", description: "Attempt and submit DOJO evaluation tests" },
        { id: SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_APPROVE, name: "Approve DOJO Evaluation Test", description: "Approve submitted DOJO evaluation tests" },
        { id: SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_CONFIRM, name: "Confirm DOJO Evaluation Test", description: "Confirm/verify submitted DOJO evaluation tests" },
        { id: SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_VIEW, name: "View DOJO Evaluation Test", description: "View list and details of DOJO evaluation tests and attempts" },
        { id: SYSTEM_PERMISSIONS.DOJO_EVALUATION_TEST_EDIT_SUBMITTED, name: "Edit Submitted DOJO Evaluation Results", description: "Edit evaluation results and performance dates for columns already saved/submitted" }
      ],
      "MPS Portal": [
        { id: SYSTEM_PERMISSIONS.MPS_ATTENDANCE_READ, name: "View Attendance", description: "View attendance records and logs" },
        { id: SYSTEM_PERMISSIONS.MPS_ATTENDANCE_UPLOAD, name: "Upload Attendance Excel", description: "Upload and import attendance data from Excel files" },
        { id: SYSTEM_PERMISSIONS.MPS_REQUIREMENT_ADD_EMAILS, name: "Add Emails to Requirements", description: "Add email configurations for line requirements notifications" },
        { id: SYSTEM_PERMISSIONS.MPS_REQUIREMENT_UPLOAD, name: "Upload Requirements Excel", description: "Upload line requirements from Excel templates" },
        { id: SYSTEM_PERMISSIONS.MPS_EMAIL_REPORTS_TRIGGER, name: "Trigger Email Reports", description: "Manually trigger the sending of email reports" },
        { id: SYSTEM_PERMISSIONS.MPS_EMAIL_REPORTS_ADD, name: "Add Email to Reports", description: "Add new email recipients to report configurations" },
        { id: SYSTEM_PERMISSIONS.MPS_REQUIREMENT_VIEW_ALL_SECTIONS, name: "View All Sections Set Requirement", description: "Allows view-only access to all sections on Set Requirement page, even if not assigned" }
      ],
      "Line Requirement Management": [
        { id: SYSTEM_PERMISSIONS.LINE_REQUIREMENT_READ, name: "View Line Requirements", description: "View line requirements page and records" },
        { id: SYSTEM_PERMISSIONS.LINE_REQUIREMENT_UPDATE, name: "Edit Line Requirements", description: "Create, update, or edit line requirements" }
      ],
      "Revision Management": [
        { id: SYSTEM_PERMISSIONS.REVISION_READ, name: "View Revision Table", description: "View the document revision table and sheet override history" },
        { id: SYSTEM_PERMISSIONS.REVISION_CREATE, name: "Create Department Overrides", description: "Add department-level revision overrides for a sheet" },
        { id: SYSTEM_PERMISSIONS.REVISION_UPDATE, name: "Update Revisions", description: "Edit default or department-override revision records" },
        { id: SYSTEM_PERMISSIONS.DEPT_REVISION_LOGS_READ, name: "View Department Revision Logs", description: "View the department revision logs page" }
      ],
      "Settings Management": [
        { id: SYSTEM_PERMISSIONS.SETTINGS_CHANGE_PASSWORD, name: "Change Password", description: "Allow user to change their own login password from the Settings page" },
        { id: SYSTEM_PERMISSIONS.SETTINGS_EMAIL_CONFIG, name: "Email Configuration", description: "View and modify system email configuration settings" }
      ],
      "Contractor Management": [
        { id: SYSTEM_PERMISSIONS.CONTRACTOR_READ, name: "View Contractors", description: "Access and view the list of contractors" },
        { id: SYSTEM_PERMISSIONS.CONTRACTOR_CREATE, name: "Create Contractors", description: "Create new contractor records" },
        { id: SYSTEM_PERMISSIONS.CONTRACTOR_UPDATE, name: "Update Contractors", description: "Edit existing contractor records" },
        { id: SYSTEM_PERMISSIONS.CONTRACTOR_DELETE, name: "Delete Contractors", description: "Delete contractor records" }
      ],
      "Evaluation Check Sheet Management": [
        { id: SYSTEM_PERMISSIONS.EVALUATION_MANAGE, name: "Manage Evaluation (Full Access)", description: "Super-permission: full create, read, update, and delete access to skill evaluation check sheets" },
        { id: SYSTEM_PERMISSIONS.EVALUATION_CREATE, name: "Create Evaluation Sheet", description: "Create new skill evaluation check sheets for operators" },
        { id: SYSTEM_PERMISSIONS.EVALUATION_READ, name: "View Evaluation Sheets", description: "View and read skill evaluation check sheets, including the monitoring tab" },
        { id: SYSTEM_PERMISSIONS.EVALUATION_UPDATE, name: "Edit Evaluation Sheet", description: "Edit and save changes to existing skill evaluation check sheets" },
        { id: SYSTEM_PERMISSIONS.EVALUATION_DELETE, name: "Delete Evaluation Sheet", description: "Permanently delete skill evaluation check sheet records" }
      ],
      "Operator Observance Management": [
        { id: SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_MANAGE, name: "Manage Operator Observance (Full Access)", description: "Super-permission: full create, read, update, and delete access to operator observance sheets" },
        { id: SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_CREATE, name: "Create Operator Observance Sheet", description: "Create new operator observance sheets" },
        { id: SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_READ, name: "View Operator Observance Sheets", description: "View and read operator observance sheets" },
        { id: SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_UPDATE, name: "Edit Operator Observance Sheet", description: "Edit and save changes to existing operator observance sheets" },
        { id: SYSTEM_PERMISSIONS.OPERATOR_OBSERVANCE_DELETE, name: "Delete Operator Observance Sheet", description: "Permanently delete operator observance sheet records" }
      ],
      "Mentor Management": [
        { id: SYSTEM_PERMISSIONS.MENTOR_READ, name: "View Mentors", description: "Access and view the list of mentors, stats, and assigned mentees" },
        { id: SYSTEM_PERMISSIONS.MENTOR_CREATE, name: "Create Mentors", description: "Create new mentor records" },
        { id: SYSTEM_PERMISSIONS.MENTOR_UPDATE, name: "Update Mentors", description: "Edit mentor details and assignment limits" },
        { id: SYSTEM_PERMISSIONS.MENTOR_DELETE, name: "Delete Mentors", description: "Delete or remove mentor records" }
      ]
    };

    // Map system roles from constants
    const roles = Object.entries(DEFAULT_ROLES).map(([id, r]) => ({
      id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystemRole: true,
      color: r.color,
      userCount: 0
    }));

    // Get custom roles from DB
    const customRoles = await CustomRole.findAll();
    const dbRoles = customRoles.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      allowedPages: r.allowedPages,
      generateManagementPage: r.generateManagementPage,
      targetLayout: r.targetLayout,
      isSystemRole: r.isSystem,
      color: r.color,
      userCount: 0
    }));

    const allRoles = [...roles, ...dbRoles];

    // Get user count for each role via SQL
    for (const role of allRoles) {
      if (typeof role.id === 'string') {
        // System role
        const [rows] = await executeQuery("SELECT COUNT(*) as cnt FROM users WHERE role = ?", [role.id]);
        role.userCount = rows[0].cnt;
      } else {
        // DB Role (id is INT)
        const [rows] = await executeQuery("SELECT COUNT(*) as cnt FROM users WHERE customRoleId = ?", [role.id]);
        role.userCount = rows[0].cnt;
      }
    }

    res.json(new ApiResponse(200, {
      permissions,
      roles: allRoles,
      systemPermissions: SYSTEM_PERMISSIONS
    }, "Roles and permissions fetched successfully"));

  } catch (error) {
    throw new ApiError("Failed to fetch roles and permissions", 500);
  }
});

// Create custom role
export const createCustomRole = asyncHandler(async (req, res) => {
  try {
    const {
      name, description, permissions = [], color = "#6B7280",
      targetLayout = 'custom', allowedPages = [], generateManagementPage = false
    } = req.body;

    if (!name) throw new ApiError("Role name is required", 400);

    const systemKey = name.toUpperCase().replace(/\s+/g, '_');
    if (DEFAULT_ROLES[systemKey]) throw new ApiError("A system role with this name already exists", 400);

    const existing = await CustomRole.findByName(name);
    if (existing) throw new ApiError("A role with this name already exists", 409);

    const validPermissions = Object.values(SYSTEM_PERMISSIONS);
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) throw new ApiError(`Invalid permissions: ${invalidPermissions.join(", ")}`, 400);

    const newRole = await CustomRole.create({ name, description, color, permissions, allowedPages, generateManagementPage, targetLayout });

    const auditLogger = (await import("../utils/auditLogger.js")).default;
    await auditLogger(req.user.id, 'CREATE_ROLE',
      { roleName: name, permissions: permissions.length, roleId: newRole.id },
      { resourceType: 'CustomRole', resourceId: newRole.id, req }
    );

    res.status(201).json(new ApiResponse(201, newRole, "Role created successfully"));

  } catch (error) {
    throw new ApiError(error.message || "Failed to create role", error.statusCode || 500);
  }
});

// Update role permissions
export const updateRolePermissions = asyncHandler(async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions, name, description, color, targetLayout, allowedPages, generateManagementPage } = req.body;

    if (DEFAULT_ROLES[roleId]) throw new ApiError("System roles cannot be modified", 403);

    const customRole = await CustomRole.findById(roleId);
    if (!customRole) throw new ApiError("Role not found", 404);

    if (permissions !== undefined) {
      const validPermissions = Object.values(SYSTEM_PERMISSIONS);
      const invalid = permissions.filter(p => !validPermissions.includes(p));
      if (invalid.length > 0) throw new ApiError(`Invalid permissions: ${invalid.join(", ")}`, 400);
    }

    const updated = await CustomRole.update(roleId, {
      name, description, color, permissions, targetLayout, allowedPages, generateManagementPage
    });

    const auditLogger = (await import("../utils/auditLogger.js")).default;
    await auditLogger(req.user.id, 'UPDATE_ROLE',
      { roleId, roleName: updated.name, permissionsChanged: permissions?.length ?? 0 },
      { resourceType: 'CustomRole', resourceId: roleId, req }
    );

    res.json(new ApiResponse(200, updated, "Role updated successfully"));
  } catch (error) {
    throw new ApiError(error.message || "Failed to update role", error.statusCode || 500);
  }
});

// Delete custom role
export const deleteCustomRole = asyncHandler(async (req, res) => {
  try {
    const { roleId } = req.params;

    if (DEFAULT_ROLES[roleId]) throw new ApiError("System roles cannot be deleted", 403);

    const customRole = await CustomRole.findById(roleId);
    if (!customRole) throw new ApiError("Role not found", 404);

    await CustomRole.delete(roleId); // internally enforces zero-user constraint

    const auditLogger = (await import("../utils/auditLogger.js")).default;
    await auditLogger(req.user.id, 'DELETE_ROLE',
      { roleId, roleName: customRole.name },
      { resourceType: 'CustomRole', resourceId: roleId, req }
    );

    res.json(new ApiResponse(200, {}, "Role deleted successfully"));
  } catch (error) {
    throw new ApiError(error.message || "Failed to delete role", error.statusCode || 500);
  }
});

// Assign role to user
export const assignRoleToUser = asyncHandler(async (req, res) => {
  try {
    const { userId, roleId } = req.body;
    if (!userId || !roleId) throw new ApiError("User ID and Role ID are required", 400);

    const [users] = await executeQuery("SELECT * FROM users WHERE id = ?", [userId]);
    if (users.length === 0) throw new ApiError("User not found", 404);
    const user = users[0];

    const oldRole = user.role;
    let roleName;

    if (DEFAULT_ROLES[roleId]) {
      if (roleId === 'SUPERADMIN' && req.user.role !== 'SUPERADMIN') {
        throw new ApiError("Insufficient permissions to assign SuperAdmin role", 403);
      }
      const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(roleId) ? 1 : 0;
      const isTrainer = roleId === 'INSTRUCTOR' ? 1 : 0;
      const isEmployee = roleId === 'STUDENT' ? 1 : 0;
      await executeQuery(
        "UPDATE users SET role = ?, customRoleId = NULL, isAdmin = ?, isTrainer = ?, isEmployee = ? WHERE id = ?",
        [roleId, isAdmin, isTrainer, isEmployee, userId]
      );
      roleName = DEFAULT_ROLES[roleId].name;
    } else {
      const customRole = await CustomRole.findById(roleId);
      if (!customRole) throw new ApiError("Role not found", 404);
      const flags = { isAdmin: 0, isTrainer: 0, isEmployee: 0 };
      switch ((customRole.targetLayout || '').toLowerCase()) {
        case 'admin': case 'superadmin': flags.isAdmin = 1; break;
        case 'trainer': case 'instructor': flags.isTrainer = 1; break;
        case 'student': case 'employee': flags.isEmployee = 1; break;
      }
      await executeQuery(
        "UPDATE users SET role = 'CUSTOM', customRoleId = ?, isAdmin = ?, isTrainer = ?, isEmployee = ? WHERE id = ?",
        [roleId, flags.isAdmin, flags.isTrainer, flags.isEmployee, userId]
      );
      roleName = customRole.name;
    }

    const auditLogger = (await import("../utils/auditLogger.js")).default;
    await auditLogger(req.user.id, 'ASSIGN_ROLE', {
      targetUserId: userId, targetUserName: user.fullName, oldRole, newRole: roleId, roleName
    });

    res.json(new ApiResponse(200, {
      userId, userEmail: user.email, userName: user.fullName, oldRole, newRole: roleId, roleName
    }, "Role assigned successfully"));

  } catch (error) {
    throw new ApiError(error.message || "Failed to assign role", error.statusCode || 500);
  }
});

// Bulk assign roles
export const bulkAssignRoles = asyncHandler(async (req, res) => {
  try {
    const { userIds, roleId } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) throw new ApiError("User IDs array is required", 400);
    if (!roleId) throw new ApiError("Role ID is required", 400);

    if (roleId === 'SUPERADMIN' && req.user.role !== 'SUPERADMIN') {
      throw new ApiError("Insufficient permissions to assign SuperAdmin role", 403);
    }

    let roleName;
    let isSystemRole = !!DEFAULT_ROLES[roleId];
    let flags = { isAdmin: 0, isTrainer: 0, isEmployee: 0 };

    if (isSystemRole) {
      roleName = DEFAULT_ROLES[roleId].name;
      flags.isAdmin = ['ADMIN', 'SUPERADMIN'].includes(roleId) ? 1 : 0;
      flags.isTrainer = roleId === 'INSTRUCTOR' ? 1 : 0;
      flags.isEmployee = roleId === 'STUDENT' ? 1 : 0;
    } else {
      const customRole = await CustomRole.findById(roleId);
      if (!customRole) throw new ApiError("Role not found", 404);
      roleName = customRole.name;
      switch ((customRole.targetLayout || '').toLowerCase()) {
        case 'admin': case 'superadmin': flags.isAdmin = 1; break;
        case 'trainer': case 'instructor': flags.isTrainer = 1; break;
        case 'student': case 'employee': flags.isEmployee = 1; break;
      }
    }

    const placeholders = userIds.map(() => '?').join(',');
    const [users] = await executeQuery(`SELECT * FROM users WHERE id IN (${placeholders})`, userIds);
    if (users.length !== userIds.length) throw new ApiError("Some users not found", 404);

    const results = { successful: [], failed: [] };

    for (const user of users) {
      try {
        const oldRole = user.role;
        if (isSystemRole) {
          await executeQuery(
            "UPDATE users SET role = ?, customRoleId = NULL, isAdmin = ?, isTrainer = ?, isEmployee = ? WHERE id = ?",
            [roleId, flags.isAdmin, flags.isTrainer, flags.isEmployee, user.id]
          );
        } else {
          await executeQuery(
            "UPDATE users SET role = 'CUSTOM', customRoleId = ?, isAdmin = ?, isTrainer = ?, isEmployee = ? WHERE id = ?",
            [roleId, flags.isAdmin, flags.isTrainer, flags.isEmployee, user.id]
          );
        }
        results.successful.push({ userId: user.id, userEmail: user.email, userName: user.fullName, oldRole, newRole: roleId });
      } catch (err) {
        results.failed.push({ userId: user.id, userEmail: user.email, error: err.message });
      }
    }

    const auditLogger = (await import("../utils/auditLogger.js")).default;
    await auditLogger(req.user.id, 'BULK_ASSIGN_ROLES', {
      roleId, roleName, totalUsers: userIds.length,
      successful: results.successful.length, failed: results.failed.length
    });

    res.json(new ApiResponse(200, {
      results, summary: { total: userIds.length, successful: results.successful.length, failed: results.failed.length }
    }, "Bulk role assignment completed"));

  } catch (error) {
    throw new ApiError(error.message || "Failed to bulk assign roles", error.statusCode || 500);
  }
});

// Get users by role
export const getUsersByRole = asyncHandler(async (req, res) => {
  try {
    const { roleId } = req.params;
    const { page = 1, limit = 20, search = "" } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let roleName;
    let whereSQL;
    let baseParams;

    if (DEFAULT_ROLES[roleId]) {
      roleName = DEFAULT_ROLES[roleId].name;
      whereSQL = "role = ?";
      baseParams = [roleId];
    } else {
      const customRole = await CustomRole.findById(roleId);
      if (!customRole) throw new ApiError("Role not found", 404);
      roleName = customRole.name;
      whereSQL = "customRoleId = ?";
      baseParams = [roleId];
    }

    let params = [...baseParams];
    if (search) {
      whereSQL += " AND (fullName LIKE ? OR email LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const [cntRows] = await executeQuery(`SELECT COUNT(*) as cnt FROM users WHERE ${whereSQL}`, params);
    const totalUsers = cntRows[0].cnt;

    const [users] = await executeQuery(`
        SELECT id, fullName, email, createdAt, status
        FROM users
        WHERE ${whereSQL}
        ORDER BY createdAt DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
    `, [...params, offset, parseInt(limit)]);

    res.json(new ApiResponse(200, {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        limit: parseInt(limit)
      },
      role: { id: roleId, name: roleName }
    }, "Users fetched successfully"));

  } catch (error) {
    throw new ApiError(error.message || "Failed to get users by role", error.statusCode || 500);
  }
});

export { SYSTEM_PERMISSIONS, DEFAULT_ROLES };

// ============================================================
// CUSTOM ROLES (page-level permissions)
// ============================================================

/** GET /api/custom-roles — list all custom roles */
export const listCustomRoles = asyncHandler(async (req, res) => {
  const roles = await CustomRole.findAll();
  res.json(new ApiResponse(200, roles, "Custom roles fetched successfully"));
});

/** POST /api/custom-roles — create a new role */
export const createNewCustomRole = asyncHandler(async (req, res) => {
  const { name, description, color, allowedPages, permissions, generateManagementPage, targetLayout } = req.body;
  if (!name) throw new ApiError("Role name is required", 400);

  const exists = await CustomRole.findByName(name);
  if (exists) throw new ApiError("A role with this name already exists", 409);

  const role = await CustomRole.create({ name, description, color, allowedPages, permissions, generateManagementPage, targetLayout });
  res.status(201).json(new ApiResponse(201, role, "Custom role created successfully"));
});

/** PUT /api/custom-roles/:id — update a role */
export const updateCustomRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = await CustomRole.findById(id);
  if (!role) throw new ApiError("Role not found", 404);
  // Allow editing system roles if they are in the custom_roles table
  // (Core roles like SUPERADMIN/ADMIN are not in this table)

  const updated = await CustomRole.update(id, req.body);
  res.json(new ApiResponse(200, updated, "Custom role updated successfully"));
});

/** DELETE /api/custom-roles/:id — delete a role */
export const deleteNewCustomRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = await CustomRole.findById(id);
  if (!role) throw new ApiError("Role not found", 404);
  if (role.isSystem) throw new ApiError("Cannot delete system roles", 403);
  await CustomRole.delete(id);
  res.json(new ApiResponse(200, {}, "Custom role deleted successfully"));
});

/** POST /api/custom-roles/:id/assign — assign role to a user */
export const assignCustomRoleToUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, setAsPrimary } = req.body;
  if (!userId) throw new ApiError("userId is required", 400);

  const role = await CustomRole.findById(id);
  if (!role) throw new ApiError("Role not found", 404);

  // Update customRoleId
  await executeQuery("UPDATE users SET customRoleId = ? WHERE id = ?", [id, userId]);

  // If setAsPrimary is true, update the user's system role and flags based on targetLayout
  if (setAsPrimary && role.targetLayout) {
    let updateSQL = "UPDATE users SET role = 'CUSTOM'";
    const flags = {
      isAdmin: 0,
      isTrainer: 0,
      isEmployee: 0
    };

    switch (role.targetLayout.toLowerCase()) {
      case 'admin':
      case 'superadmin':
        flags.isAdmin = 1;
        break;
      case 'trainer':
      case 'instructor':
        flags.isTrainer = 1;
        break;
      case 'student':
      case 'employee':
        flags.isEmployee = 1;
        break;
    }

    updateSQL += `, isAdmin = ${flags.isAdmin}, isTrainer = ${flags.isTrainer}, isEmployee = ${flags.isEmployee} WHERE id = ?`;
    await executeQuery(updateSQL, [userId]);
  }

  res.json(new ApiResponse(200, { userId, roleId: id, roleName: role.name }, "Role assigned to user successfully"));
});

/** DELETE /api/custom-roles/unassign/:userId — remove custom role from a user */
export const unassignCustomRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  await executeQuery("UPDATE users SET customRoleId = NULL WHERE id = ?", [userId]);
  res.json(new ApiResponse(200, {}, "Custom role unassigned from user"));
});
