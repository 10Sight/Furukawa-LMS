import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/Helper/axiosBaseQuery";

export const DailyProductionReportApi = createApi({
    reducerPath: "DailyProductionReportApi",
    baseQuery: axiosBaseQuery,
    tagTypes: ["DailyProductionReport", "DailyProductionReportConfig", "DailyProductionReportConfigHistory", "DPRManualStats"],
    endpoints: (builder) => ({
        getDailyProductionReport: builder.query({
            query: (params) => ({
                url: "/api/daily-production-report",
                method: "GET",
                params, // { date, department, line, shift }
            }),
            providesTags: ["DailyProductionReport"],
        }),

        saveDailyProductionReport: builder.mutation({
            query: (data) => ({
                url: "/api/daily-production-report",
                method: "POST",
                data,
            }),
            invalidatesTags: ["DailyProductionReport"],
        }),

        getDPRConfig: builder.query({
            query: (departmentId) => ({
                url: `/api/daily-production-report/config/${departmentId}`,
                method: "GET",
            }),
            providesTags: ["DailyProductionReportConfig"],
        }),

        saveDPRConfig: builder.mutation({
            query: (data) => ({
                url: "/api/daily-production-report/config/save",
                method: "POST",
                data,
            }),
            invalidatesTags: ["DailyProductionReportConfig"],
        }),
        checkDailyProductionReport: builder.mutation({
            query: (data) => ({
                url: "/api/daily-production-report/check",
                method: "POST",
                data,
            }),
            invalidatesTags: ["DailyProductionReport"],
        }),
        getDPRConfigHistory: builder.query({
            query: (departmentId) => ({
                url: `/api/daily-production-report/history/${departmentId}`,
                method: "GET",
            }),
            providesTags: ["DailyProductionReportConfigHistory"],
        }),
        listDailyProductionReports: builder.query({
            query: (params) => ({
                url: "/api/daily-production-report/list",
                method: "GET",
                params,
            }),
            providesTags: ["DailyProductionReport"],
        }),
        deleteDailyProductionReport: builder.mutation({
            query: (id) => ({
                url: `/api/daily-production-report/${id}`,
                method: "DELETE",
            }),
            invalidatesTags: ["DailyProductionReport"],
        }),
        getManpowerStats: builder.query({
            query: (params) => ({
                url: "/api/daily-production-report/manpower-stats",
                method: "GET",
                params, // { date, shift, subSectionIds }
            }),
        }),
        getBatchMachineAssignments: builder.query({
            query: (params) => ({
                url: "/api/daily-production-report/machine-assignments",
                method: "GET",
                params, // { machineIds, date, shift }
            }),
        }),
        getDPRManualStats: builder.query({
            query: (params) => ({
                url: "/api/daily-production-report/manual-stats",
                method: "GET",
                params, // { date }
            }),
            providesTags: ["DPRManualStats"],
        }),
        saveDPRManualStats: builder.mutation({
            query: (data) => ({
                url: "/api/daily-production-report/manual-stats",
                method: "POST",
                data,
            }),
            invalidatesTags: ["DPRManualStats"],
        }),
    }),
});

export const {
    useGetDailyProductionReportQuery,
    useLazyGetDailyProductionReportQuery,
    useSaveDailyProductionReportMutation,
    useCheckDailyProductionReportMutation,
    useGetDPRConfigQuery,
    useSaveDPRConfigMutation,
    useGetDPRConfigHistoryQuery,
    useListDailyProductionReportsQuery,
    useDeleteDailyProductionReportMutation,
    useGetManpowerStatsQuery,
    useLazyGetManpowerStatsQuery,
    useGetBatchMachineAssignmentsQuery,
    useLazyGetBatchMachineAssignmentsQuery,
    useGetDPRManualStatsQuery,
    useSaveDPRManualStatsMutation,
} = DailyProductionReportApi;
