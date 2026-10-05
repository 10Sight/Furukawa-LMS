// Auth API exports
export {
    authApi,
    useUserRegisterMutation,
    useUserLoginMutation,
    useUserLogoutMutation,
    useGetUserProfileQuery,
    useForgotPasswordMutation,
    useResetPasswordMutation,
} from "../AuthApi.js";

// User API exports
export {
    userApi,
    useGetAllUsersQuery,
    useGetUserByIdQuery,
    useUpdateProfileMutation,
    useUpdateAvatarMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
} from "../UserApi.js";

// Designation API exports
export {
    designationApi,
    useGetUniqueDesignationsQuery,
    useGetDesignationsWithCountsQuery,
    useShutterDesignationMutation,
    useUnshutterDesignationMutation,
} from "../DesignationApi.js";

// Instructor API exports
export {
    instructorApi,
    useGetAllInstructorsQuery,
    useGetInstructorByIdQuery,
    useGetAllStudentsQuery,
    useCreateInstructorMutation,
    useUpdateInstructorMutation,
    useDeleteInstructorMutation,
    useUpdateInstructorStatusMutation,
} from "../InstructorApi.js";

// Course API exports
export {
    courseApi,
    useCreateCourseMutation,
    useGetCoursesQuery,
    useGetCourseByIdQuery,
    useUpdateCourseMutation,
    useDeleteCourseMutation,
} from "../CourseApi.js";

// Assignment API exports
export {
    assignmentApi,
    useCreateAssignmentMutation,
    useGetAllAssignmentsQuery,
    useGetAssignmentByIdQuery,
    useUpdateAssignmentMutation,
    useDeleteAssignmentMutation,
} from "../AssignmentApi.js";

// Department API exports
export {
    departmentApi,
    useCreateDepartmentMutation,
    useAssignInstructorMutation,
    useAddStudentToDepartmentMutation,
    useRemoveStudentFromDepartmentMutation,
    useGetAllDepartmentsQuery,
    useGetDepartmentByIdQuery,
    useUpdateDepartmentMutation,
    useDeleteDepartmentMutation,
    useGetDepartmentProgressQuery,
    useGetDepartmentSubmissionsQuery,
    useGetDepartmentAttemptsQuery,
    useGetSoftDeletedDepartmentsQuery,
    useRestoreDepartmentMutation,
    useCancelDepartmentMutation,
    useGetMyDepartmentsQuery,
    useLazyExportDepartmentsQuery,
} from "./DepartmentRefetchApi.js";

// Quiz API exports
export {
    quizApi,
    useCreateQuizMutation,
    useGetAllQuizzesQuery,
    useGetQuizByIdQuery,
    useUpdateQuizMutation,
    useDeleteQuizMutation,
} from "../QuizApi.js";

// Enrollment API exports
export {
    enrollmentApi,
    useEnrollStudentMutation,
    useUnenrollStudentMutation,
    useGetAllEnrollmentsQuery,
    useGetStudentEnrollmentsQuery,
    useGetCourseEnrollmentsQuery,
    useUpdateEnrollmentMutation,
    useDeleteEnrollmentMutation,
} from "../EnrollmentApi.js";

// Progress API exports
export {
    progressApi,
    useInitializeProgressMutation,
    useUpdateProgressMutation,
    useUpgradeLevelMutation,
    useGetMyProgressQuery,
    useGetCourseProgressQuery,
    useGetStudentProgressQuery,
} from "../ProgressApi.js";

// Submission API exports
export {
    submissionApi,
    useCreateSubmissionMutation,
    useResubmitAssignmentMutation,
    useGetSubmissionByAssignmentQuery,
    useGetMySubmissionsQuery,
    useGradeSubmissionMutation,
    useGetStudentSubmissionsQuery,
} from "../SubmissionApi.js";

// Certificate API exports
export {
    certificateApi,
    useIssueCertificateMutation,
    useGetCertificateByIdQuery,
    useGetStudentCertificatesQuery,
    useGetCourseCertificatesQuery,
    useRevokeCertificateMutation,
    useCheckCertificateEligibilityQuery,
    useIssueCertificateWithTemplateMutation,
    useGenerateCertificatePreviewMutation,
} from "../CertificateApi.js";

// Certificate Template API exports
export {
    certificateTemplateApi,
    useCreateCertificateTemplateMutation,
    useGetCertificateTemplatesQuery,
    useGetCertificateTemplateByIdQuery,
    useGetDefaultCertificateTemplateQuery,
    useUpdateCertificateTemplateMutation,
    useDeleteCertificateTemplateMutation,
    useSetDefaultCertificateTemplateMutation,
} from "../CertificateTemplateApi.js";

// Audit API exports
export {
    auditApi,
    useGetAllAuditsQuery,
    useGetAuditByIdQuery,
    useDeleteAuditMutation,
    useLogActionMutation,
} from "../AuditApi.js";

// Attempted Quiz API exports
export {
    attemptedQuizApi,
    useAttemptQuizMutation,
    useGetMyAttemptsQuery,
    useGetAttemptsQuizQuery,
    useGetAttemptByIdQuery,
    useDeleteAttemptMutation,
    useGetStudentAttemptsQuery,
    useStartQuizQuery,
    useSubmitQuizMutation,
    useGetQuizAttemptStatusQuery,
} from "../AttemptedQuizApi.js";

// Analytics API exports
export {
    analyticsApi,
    useGetDashboardStatsQuery,
    useGetUserStatsQuery,
    useGetCourseStatsQuery,
    useGetEngagementStatsQuery,
} from "../AnalyticsApi.js";

// Resource API exports
export {
    resourceApi,
    useCreateResourceMutation,
    useGetResourcesByModuleQuery,
    useDeleteResourceMutation,
    useUpdateResourceMutation,
} from "../resourceApi.js";

// Module API exports
export {
    moduleApi,
    useCreateModuleMutation,
    useGetModulesByCourseQuery,
    useUpdateModuleMutation,
    useDeleteModuleMutation,
} from "../moduleApi.js";

// Lesson API exports
export {
    lessonApi,
    useCreateLessonMutation,
    useGetLessonsByModuleQuery,
    useGetLessonByIdQuery,
    useUpdateLessonMutation,
    useDeleteLessonMutation,
    useAddLessonSlideMutation,
    useUpdateLessonSlideMutation,
    useDeleteLessonSlideMutation,
    useReorderLessonSlidesMutation,
} from "../LessonApi.js";

// SuperAdmin API exports
export {
    superAdminApi,
    useGetAllUsersQuery as useSuperAdminGetAllUsersQuery,
    useGetSoftDeletedUsersQuery,
    useCreateUserMutation as useSuperAdminCreateUserMutation,
    useUpdateUserMutation as useSuperAdminUpdateUserMutation,
    usePermanentDeleteUserMutation,
    useRestoreUserMutation,
    useBulkUserOperationMutation,
    useGetAllAuditLogsQuery,
    useGetAuditLogByIdQuery as useSuperAdminGetAuditLogByIdQuery,
    useDeleteAuditLogMutation as useSuperAdminDeleteAuditLogMutation,
    useExportAuditLogsMutation,
    useGetSystemSettingsQuery,
    useUpdateSystemSettingsMutation,
    useResetSystemSettingsMutation,
    useGetSystemAnalyticsQuery,
    useGetUserAnalyticsQuery,
    useGetCourseAnalyticsQuery as useSuperAdminGetCourseAnalyticsQuery,
    useGenerateCustomReportMutation,
    useExportAnalyticsMutation,
    useGetBackupHistoryQuery,
    useRestoreFromBackupMutation,
    useDeleteBackupMutation,
    useGetSystemHealthQuery,
    useGetBulkOperationHistoryQuery,
    useBulkEnrollUsersMutation,
    useBulkSendEmailsMutation,
    useBulkGenerateCertificatesMutation,
    useGetRolesAndPermissionsQuery,
    useCreateRoleMutation,
    useUpdateRoleMutation,
    useDeleteRoleMutation,
    useAssignRoleMutation,
    useBulkAssignRolesMutation,
    useGetUsersByRoleQuery,
    useGetDataStatisticsQuery,
    useCleanupOldDataMutation,
    useGetServerMetricsQuery,
    useGetDatabaseMetricsQuery,
    useGetSystemAlertsQuery,
    useGetSystemPerformanceHistoryQuery,
    useGetComprehensiveAnalyticsQuery,
    useGetEngagementAnalyticsQuery,
    useExportSystemDataMutation,
    useImportSystemDataMutation,
    useGetDataOperationHistoryQuery,
    useToggleMaintenanceModeMutation,
    useClearSystemCacheMutation,
    useRunSystemCleanupMutation,
} from "../SuperAdminApi.js";

// OnJobTraining API exports
export {
    onJobTrainingApi,
    useGetStudentOJTsQuery,
    useGetOnJobTrainingByIdQuery,
    useGetAllOnJobTrainingsQuery,
    useCreateOnJobTrainingMutation,
    useUpdateOnJobTrainingMutation,
} from "../OnJobTrainingApi.js";

// Line API exports
export {
    LineApi,
    useCreateLineMutation,
    useGetLinesByDepartmentQuery,
    useUpdateLineMutation,
    useDeleteLineMutation,
} from "../LineApi.js";

// Machine API exports
export {
    MachineApi,
    useCreateMachineMutation,
    useGetMachinesBySubSectionQuery,
    useGetMachinesByLineQuery,
    useUpdateMachineMutation,
    useUpdateMachineStatusMutation,
    useDeleteMachineMutation,
    useAssignEmployeeMutation,
    useRemoveEmployeeMutation,
    useGetMachineEmployeesQuery,
    useGetMachineByIdQuery,
} from "../MachineApi.js";

// SkillMatrix API exports
export {
    skillMatrixApi,
    useSaveSkillMatrixMutation,
    useGetSkillMatrixQuery,
    useGetSkillMatrixEfficiencyQuery,
    useGetSkillMatrixEfficiencySummaryQuery,
} from "../SkillMatrixApi.js";

// CourseLevelConfig API exports
export {
    useGetActiveConfigQuery,
    useGetAllConfigsQuery,
    useGetConfigByIdQuery,
    useCreateConfigMutation,
    useUpdateConfigMutation,
    useDeleteConfigMutation,
    useSetAsDefaultMutation,
    useValidateCompatibilityMutation,
    useMigrateLevelsMutation,
} from "../CourseLevelConfigApi.js";

// MultiSkilling API exports
export {
    multiSkillingApi,
    useGetMultiSkillingPlanQuery,
    useSaveMultiSkillingPlanMutation,
    useGetMultiSkillingConfigQuery,
    useSaveMultiSkillingConfigMutation,
    useGetMultiSkillingHistoryQuery,
} from "../MultiSkillingApi.js";

// AbnormalCondition API exports
export {
    AbnormalConditionApi,
    useGetAbnormalConditionSheetQuery,
    useLazyGetAbnormalConditionSheetQuery,
    useCreateAbnormalConditionSheetMutation,
    useUpdateAbnormalConditionSheetMutation,
    useApproveAbnormalConditionEntryMutation,
    useDeleteAbnormalConditionSheetMutation,
} from "../AbnormalConditionApi.js";
