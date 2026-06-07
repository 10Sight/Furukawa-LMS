import axiosBaseQuery from "@/Helper/axiosBaseQuery";
import { createApi } from "@reduxjs/toolkit/query/react";

export const analyticsApi = createApi({
    reducerPath: "analyticsApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ['Analytics'],
    endpoints: (builder) => ({
        getDashboardStats: builder.query({
            query: () => ({
                url: "/api/analytics/dashboard",
                method: "GET",
            }),
            providesTags: ['Analytics'],
        }),

        getUserStats: builder.query({
            query: ({ period = '30d' } = {}) => ({
                url: "/api/analytics/users",
                method: "GET",
                params: { period }
            }),
            providesTags: ['Analytics'],
        }),

        getCourseStats: builder.query({
            query: ({ period = '30d' } = {}) => ({
                url: "/api/analytics/courses",
                method: "GET",
                params: { period }
            }),
            providesTags: ['Analytics'],
        }),

        getEngagementStats: builder.query({
            query: ({ period = '30d' } = {}) => ({
                url: "/api/analytics/engagement",
                method: "GET",
                params: { period }
            }),
            providesTags: ['Analytics'],
        }),

        // Exam history stats (pass/fail)
        getExamHistoryStats: builder.query({
            query: ({ groupBy = 'month', studentId = '', startDate = '', endDate = '', year = '' } = {}) => ({
                url: "/api/analytics/exams/history",
                method: "GET",
                params: { groupBy, studentId, startDate, endDate, year }
            }),
            providesTags: ['Analytics'],
        }),

        // Export exam history (blob)
        exportExamHistory: builder.query({
            query: ({ groupBy = 'month', studentId = '', startDate = '', endDate = '', year = '', format = 'excel' } = {}) => ({
                url: "/api/analytics/exams/export",
                method: "GET",
                params: { groupBy, studentId, startDate, endDate, year, format },
                responseHandler: (response) => response.data
            }),
            keepUnusedDataFor: 0,
        }),

        // Audit aggregated stats
        getAuditStats: builder.query({
            query: ({ groupBy = 'month', userId = '', startDate = '', endDate = '', year = '' } = {}) => ({
                url: "/api/analytics/audits/stats",
                method: "GET",
                params: { groupBy, userId, startDate, endDate, year }
            }),
            providesTags: ['Analytics'],
        }),

        // Export audit aggregated stats (blob)
        exportAuditStats: builder.query({
            query: ({ groupBy = 'month', userId = '', startDate = '', endDate = '', year = '', format = 'excel' } = {}) => ({
                url: "/api/analytics/audits/export",
                method: "GET",
                params: { groupBy, userId, startDate, endDate, year, format },
                responseHandler: (response) => response.data
            }),
            keepUnusedDataFor: 0,
        }),

        getDepartmentQuizStats: builder.query({
            query: ({ startDate = '', endDate = '', departmentId = '', sectionId = '', lineId = '', subSectionId = '' } = {}) => ({
                url: "/api/analytics/department-quiz-stats",
                method: "GET",
                params: { startDate, endDate, departmentId, sectionId, lineId, subSectionId }
            }),
            providesTags: ['Analytics'],
        }),
    }),
});

export const {
    useGetDashboardStatsQuery,
    useGetUserStatsQuery,
    useGetCourseStatsQuery,
    useGetEngagementStatsQuery,
    useGetExamHistoryStatsQuery,
    useLazyExportExamHistoryQuery,
    useGetAuditStatsQuery,
    useLazyExportAuditStatsQuery,
    useGetDepartmentQuizStatsQuery,
} = analyticsApi;
