import { configureStore } from "@reduxjs/toolkit";

// Slice imports
import authSliceReducer from './slices/AuthSlice';
import userSliceReducer from './slices/UserSlice';
import courseSliceReducer from './slices/CourseSlice';
import localizationReducer from './slices/LocalizationSlice';
import themeSliceReducer from './slices/ThemeSlice';

// API imports
import { authApi } from "./api/AuthApi";
import { userApi } from "./api/UserApi";
import { instructorApi } from "./api/InstructorApi";
import { courseApi } from "./api/CourseApi";
import { assignmentApi } from "./api/AssignmentApi";
import { departmentApi } from "./api/DepartmentApi";
import { quizApi } from "./api/QuizApi";
import { enrollmentApi } from "./api/EnrollmentApi";
import { progressApi } from "./api/ProgressApi";
import { submissionApi } from "./api/SubmissionApi";
import { certificateApi } from "./api/CertificateApi";
import { certificateTemplateApi } from "./api/CertificateTemplateApi";
import { auditApi } from "./api/AuditApi";
import { attemptedQuizApi } from "./api/AttemptedQuizApi";
import { resourceApi } from "./api/resourceApi";
import { moduleApi } from "./api/moduleApi";
import { lessonApi } from "./api/LessonApi";
import { analyticsApi } from "./api/AnalyticsApi";
import { superAdminApi } from "./api/SuperAdminApi";
import courseLevelConfigApi from "./api/CourseLevelConfigApi";
import { onJobTrainingApi } from "./api/OnJobTrainingApi";
import { LineApi } from "./api/LineApi";
import { MachineApi } from "./api/MachineApi";
import { skillMatrixApi } from "./api/SkillMatrixApi";
import { dashboardApi } from "./api/DashboardApi";
import { DailyProductionReportApi } from "./api/DailyProductionReportApi";
import { sectionApi } from "./api/SectionApi";
import { SubSectionApi } from "./api/SubSectionApi";
import { reportClubApi } from "./api/ReportClubApi";
import { multiSkillingApi } from "./api/MultiSkillingApi";
import { adminHomeApi } from "./api/AdminHomeApi";
import { AbnormalConditionApi } from "./api/AbnormalConditionApi";
import { EvaluationTestApi } from "./api/EvaluationTestApi";
import { contractorApi } from "./api/ContractorApi";
import { leftRequestApi } from "./api/LeftRequestApi";
import { monthlyMeetingReportApi } from "./api/MonthlyMeetingReportApi";



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
