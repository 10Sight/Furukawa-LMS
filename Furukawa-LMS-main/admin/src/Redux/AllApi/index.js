// Auth API exports
export {
    authApi,
    useUserRegisterMutation,
    useUserLoginMutation,
    useUserLogoutMutation,
    useGetUserProfileQuery,
    useForgotPasswordMutation,
    useResetPasswordMutation,
} from './AuthApi';

// User API exports
export {
    userApi,
    useGetAllUsersQuery,
    useGetUserByIdQuery,
    useUpdateProfileMutation,
    useUpdateAvatarMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
} from './UserApi';

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
} from './InstructorApi';

// Course API exports
export {
    courseApi,
    useCreateCourseMutation,
    useGetCoursesQuery,
    useGetCourseByIdQuery,
    useUpdateCourseMutation,
    useDeleteCourseMutation,
    useTogglePublishCourseMutation,
} from './CourseApi';

// Assignment API exports
export {
    assignmentApi,
    useCreateAssignmentMutation,
    useGetAllAssignmentsQuery,
    useGetAssignmentByIdQuery,
    useUpdateAssignmentMutation,
    useDeleteAssignmentMutation,
} from './AssignmentApi';

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
} from './DepartmentApi';

// Quiz API exports
export {
    quizApi,
    useCreateQuizMutation,
    useGetAllQuizzesQuery,
    useGetQuizByIdQuery,
    useUpdateQuizMutation,
    useDeleteQuizMutation,
} from './QuizApi';

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
} from './EnrollmentApi';

// Progress API exports
export {
    progressApi,
    useInitializeProgressMutation,
    useUpdateProgressMutation,
    useUpgradeLevelMutation,
    useGetMyProgressQuery,
    useGetCourseProgressQuery,
    useGetStudentProgressQuery,
} from './ProgressApi';

// Submission API exports
export {
    submissionApi,
    useCreateSubmissionMutation,
    useResubmitAssignmentMutation,
    useGetSubmissionByAssignmentQuery,
    useGetMySubmissionsQuery,
    useGradeSubmissionMutation,
    useGetStudentSubmissionsQuery,
} from './SubmissionApi';

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
} from './CertificateApi';

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
} from './CertificateTemplateApi';

// Audit API exports
export {
    auditApi,
    useGetAllAuditsQuery,
    useGetAuditByIdQuery,
    useDeleteAuditMutation,
} from './AuditApi';

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
} from './AttemptedQuizApi';

// Analytics API exports
export {
    analyticsApi,
    useGetDashboardStatsQuery,
    useGetUserStatsQuery,
    useGetCourseStatsQuery,
    useGetEngagementStatsQuery,
} from './AnalyticsApi';

// Resource API exports
export {
    resourceApi,
    useCreateResourceMutation,
    useGetResourcesByModuleQuery,
    useDeleteResourceMutation,
    useUpdateResourceMutation,
} from './resourceApi';

// Module API exports
export {
    moduleApi,
    useCreateModuleMutation,
    useGetModulesByCourseQuery,
    useUpdateModuleMutation,
    useDeleteModuleMutation,
} from './moduleApi';

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
} from './LessonApi';

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
    useCreateDatabaseBackupMutation,
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
} from './SuperAdminApi';

// OnJobTraining API exports
export {
    onJobTrainingApi,
    useGetStudentOJTsQuery,
    useGetOnJobTrainingByIdQuery,
    useGetAllOnJobTrainingsQuery,
    useCreateOnJobTrainingMutation,
    useUpdateOnJobTrainingMutation,
} from './OnJobTrainingApi';

// Line API exports
export {
    LineApi,
    useCreateLineMutation,
    useGetLinesByDepartmentQuery,
    useUpdateLineMutation,
    useDeleteLineMutation,
} from './LineApi';

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
} from './MachineApi';

// SkillMatrix API exports
export {
    skillMatrixApi,
    useSaveSkillMatrixMutation,
    useGetSkillMatrixQuery,
} from './SkillMatrixApi';

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
} from './CourseLevelConfigApi';

// MultiSkilling API exports
export {
    multiSkillingApi,
    useGetMultiSkillingPlanQuery,
    useSaveMultiSkillingPlanMutation,
    useGetMultiSkillingConfigQuery,
    useSaveMultiSkillingConfigMutation,
    useGetMultiSkillingHistoryQuery,
} from './MultiSkillingApi';
