import { configureStore } from "@reduxjs/toolkit";

// Slice imports
import authSliceReducer from "../slices/AuthSlice.js";
import userSliceReducer from "../slices/UserSlice.js";
import courseSliceReducer from "../slices/CourseSlice.js";
import localizationReducer from "../slices/LocalizationSlice.js";
import themeSliceReducer from "../slices/ThemeSlice.js";

// API imports
import { authApi } from "../../../services/api/AuthApi.js";
import { userApi } from "../../../services/api/UserApi.js";
import { instructorApi } from "../../../services/api/InstructorApi.js";
import { courseApi } from "../../../services/api/CourseApi.js";
import { assignmentApi } from "../../../services/api/AssignmentApi.js";
import { departmentApi } from "../../../services/api/variants/DepartmentRefetchApi.js";
import { quizApi } from "../../../services/api/QuizApi.js";
import { enrollmentApi } from "../../../services/api/EnrollmentApi.js";
import { progressApi } from "../../../services/api/ProgressApi.js";
import { submissionApi } from "../../../services/api/SubmissionApi.js";
import { certificateApi } from "../../../services/api/CertificateApi.js";
import { certificateTemplateApi } from "../../../services/api/CertificateTemplateApi.js";
import { auditApi } from "../../../services/api/AuditApi.js";
import { attemptedQuizApi } from "../../../services/api/AttemptedQuizApi.js";
import { resourceApi } from "../../../services/api/resourceApi.js";
import { moduleApi } from "../../../services/api/moduleApi.js";
import { lessonApi } from "../../../services/api/LessonApi.js";
import { analyticsApi } from "../../../services/api/AnalyticsApi.js";
import { superAdminApi } from "../../../services/api/SuperAdminApi.js";
import courseLevelConfigApi from "../../../services/api/CourseLevelConfigApi.js";
import { onJobTrainingApi } from "../../../services/api/OnJobTrainingApi.js";
import { LineApi } from "../../../services/api/LineApi.js";
import { MachineApi } from "../../../services/api/MachineApi.js";
import { skillMatrixApi } from "../../../services/api/SkillMatrixApi.js";
import { dashboardApi } from "../../../services/api/DashboardApi.js";
import { DailyProductionReportApi } from "../../../services/api/DailyProductionReportApi.js";
import { sectionApi } from "../../../services/api/SectionApi.js";
import { SubSectionApi } from "../../../services/api/SubSectionApi.js";
import { reportClubApi } from "../../../services/api/ReportClubApi.js";
import { multiSkillingApi } from "../../../services/api/MultiSkillingApi.js";
import { adminHomeApi } from "../../../services/api/AdminHomeApi.js";
import { AbnormalConditionApi } from "../../../services/api/AbnormalConditionApi.js";
import { EvaluationTestApi } from "../../../services/api/EvaluationTestApi.js";
import { contractorApi } from "../../../services/api/ContractorApi.js";
import { leftRequestApi } from "../../../services/api/LeftRequestApi.js";
import { monthlyMeetingReportApi } from "../../../services/api/MonthlyMeetingReportApi.js";



const store = configureStore({
    reducer: {
        // Slice reducers
        auth: authSliceReducer,
        user: userSliceReducer,
        course: courseSliceReducer,
        localization: localizationReducer,
        theme: themeSliceReducer,

        // API reducers
        [authApi.reducerPath]: authApi.reducer,
        [userApi.reducerPath]: userApi.reducer,
        [instructorApi.reducerPath]: instructorApi.reducer,
        [courseApi.reducerPath]: courseApi.reducer,
        [assignmentApi.reducerPath]: assignmentApi.reducer,
        [departmentApi.reducerPath]: departmentApi.reducer,
        [quizApi.reducerPath]: quizApi.reducer,
        [enrollmentApi.reducerPath]: enrollmentApi.reducer,
        [progressApi.reducerPath]: progressApi.reducer,
        [submissionApi.reducerPath]: submissionApi.reducer,
        [certificateApi.reducerPath]: certificateApi.reducer,
        [certificateTemplateApi.reducerPath]: certificateTemplateApi.reducer,
        [auditApi.reducerPath]: auditApi.reducer,
        [attemptedQuizApi.reducerPath]: attemptedQuizApi.reducer,
        [resourceApi.reducerPath]: resourceApi.reducer,
        [moduleApi.reducerPath]: moduleApi.reducer,
        [lessonApi.reducerPath]: lessonApi.reducer,
        [analyticsApi.reducerPath]: analyticsApi.reducer,
        [superAdminApi.reducerPath]: superAdminApi.reducer,
        [courseLevelConfigApi.reducerPath]: courseLevelConfigApi.reducer,
        [onJobTrainingApi.reducerPath]: onJobTrainingApi.reducer,
        [LineApi.reducerPath]: LineApi.reducer,
        [MachineApi.reducerPath]: MachineApi.reducer,
        [skillMatrixApi.reducerPath]: skillMatrixApi.reducer,
        [dashboardApi.reducerPath]: dashboardApi.reducer,
        [DailyProductionReportApi.reducerPath]: DailyProductionReportApi.reducer,
        [sectionApi.reducerPath]: sectionApi.reducer,
        [SubSectionApi.reducerPath]: SubSectionApi.reducer,
        [reportClubApi.reducerPath]: reportClubApi.reducer,
        [multiSkillingApi.reducerPath]: multiSkillingApi.reducer,
        [adminHomeApi.reducerPath]: adminHomeApi.reducer,
        [AbnormalConditionApi.reducerPath]: AbnormalConditionApi.reducer,
        [EvaluationTestApi.reducerPath]: EvaluationTestApi.reducer,
        [contractorApi.reducerPath]: contractorApi.reducer,
        [leftRequestApi.reducerPath]: leftRequestApi.reducer,
        [monthlyMeetingReportApi.reducerPath]: monthlyMeetingReportApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            authApi.middleware,
            userApi.middleware,
            instructorApi.middleware,
            courseApi.middleware,
            assignmentApi.middleware,
            departmentApi.middleware,
            quizApi.middleware,
            enrollmentApi.middleware,
            progressApi.middleware,
            submissionApi.middleware,
            certificateApi.middleware,
            certificateTemplateApi.middleware,
            auditApi.middleware,
            attemptedQuizApi.middleware,
            resourceApi.middleware,
            moduleApi.middleware,
            lessonApi.middleware,
            analyticsApi.middleware,
            superAdminApi.middleware,
            courseLevelConfigApi.middleware,
            onJobTrainingApi.middleware,
            LineApi.middleware,
            MachineApi.middleware,
            skillMatrixApi.middleware,
            dashboardApi.middleware,
            DailyProductionReportApi.middleware,
            sectionApi.middleware,
            SubSectionApi.middleware,
            reportClubApi.middleware,
            multiSkillingApi.middleware,
            adminHomeApi.middleware,
            AbnormalConditionApi.middleware,
            EvaluationTestApi.middleware,
            contractorApi.middleware,
            leftRequestApi.middleware,
            monthlyMeetingReportApi.middleware,
        ),
});

export default store
