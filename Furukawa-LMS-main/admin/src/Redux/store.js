import { configureStore } from "@reduxjs/toolkit";

// Slice imports
import authSliceReducer from './Slice/AuthSlice';
import userSliceReducer from './Slice/UserSlice';
import courseSliceReducer from './Slice/CourseSlice';
import localizationReducer from './Slice/LocalizationSlice';
import themeSliceReducer from './Slice/ThemeSlice';

// API imports
import { authApi } from "./AllApi/AuthApi";
import { userApi } from "./AllApi/UserApi";
import { instructorApi } from "./AllApi/InstructorApi";
import { courseApi } from "./AllApi/CourseApi";
import { assignmentApi } from "./AllApi/AssignmentApi";
import { departmentApi } from "./AllApi/DepartmentApi";
import { quizApi } from "./AllApi/QuizApi";
import { enrollmentApi } from "./AllApi/EnrollmentApi";
import { progressApi } from "./AllApi/ProgressApi";
import { submissionApi } from "./AllApi/SubmissionApi";
import { certificateApi } from "./AllApi/CertificateApi";
import { certificateTemplateApi } from "./AllApi/CertificateTemplateApi";
import { auditApi } from "./AllApi/AuditApi";
import { attemptedQuizApi } from "./AllApi/AttemptedQuizApi";
import { resourceApi } from "./AllApi/resourceApi";
import { moduleApi } from "./AllApi/moduleApi";
import { lessonApi } from "./AllApi/LessonApi";
import { analyticsApi } from "./AllApi/AnalyticsApi";
import { superAdminApi } from "./AllApi/SuperAdminApi";
import courseLevelConfigApi from "./AllApi/CourseLevelConfigApi";
import { onJobTrainingApi } from "./AllApi/OnJobTrainingApi";
import { LineApi } from "./AllApi/LineApi";
import { MachineApi } from "./AllApi/MachineApi";
import { skillMatrixApi } from "./AllApi/SkillMatrixApi";
import { dashboardApi } from "./AllApi/DashboardApi";
import { DailyProductionReportApi } from "./AllApi/DailyProductionReportApi";
import { sectionApi } from "./AllApi/SectionApi";
import { SubSectionApi } from "./AllApi/SubSectionApi";
import { reportClubApi } from "./AllApi/ReportClubApi";
import { multiSkillingApi } from "./AllApi/MultiSkillingApi";
import { adminHomeApi } from "./AllApi/AdminHomeApi";
import { AbnormalConditionApi } from "./AllApi/AbnormalConditionApi";
import { EvaluationTestApi } from "./AllApi/EvaluationTestApi";


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
        ),
});

export default store
